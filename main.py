import os
import json
import uuid
import time
from pathlib import Path

from starlette.applications import Starlette
from starlette.requests import Request
from starlette.responses import HTMLResponse, JSONResponse, StreamingResponse, RedirectResponse
from starlette.routing import Route, Mount
from starlette.staticfiles import StaticFiles
from starlette.templating import Jinja2Templates
from dotenv import load_dotenv
import aiofiles

from services.ai import stream_chat, list_models, PROVIDERS, pollinations_url
from services.email_otp import (
    send_otp_for_register, send_otp_for_login,
    verify_and_create_account, verify_login_otp, check_password, _load_users
)

load_dotenv()

templates = Jinja2Templates(directory="templates")
_sessions = {}
HISTORY_DIR = Path("data/history")

def get_session(request: Request):
    sid = request.cookies.get("onyx_sid")
    if sid and sid in _sessions:
        return _sessions[sid]
    return None

def require_user(request: Request):
    s = get_session(request)
    if not s:
        return None
    return s

# ---------- Pages ----------
async def homepage(request: Request):
    session = get_session(request)
    return templates.TemplateResponse(request, "index.html", {
        "request": request,
        "logged_in": session is not None,
        "email": session.get("email") if session else None,
        "is_premium": session.get("is_premium", False) if session else False,
        "providers": list(PROVIDERS.keys()),
    })

# ---------- Auth ----------
async def auth_register(request: Request):
    body = await request.json()
    email = (body.get("email") or "").strip().lower()
    password = body.get("password") or ""
    if not email or not password or len(password) < 6:
        return JSONResponse({"error": "Email dan password (min 6) wajib"}, status_code=400)
    try:
        await send_otp_for_register(email, password)
        return JSONResponse({"ok": True, "message": "OTP dikirim ke email"})
    except ValueError as e:
        return JSONResponse({"error": str(e)}, status_code=400)
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)

async def auth_verify_register(request: Request):
    body = await request.json()
    email = (body.get("email") or "").strip().lower()
    otp = (body.get("otp") or "").strip()
    if not verify_and_create_account(email, otp):
        return JSONResponse({"error": "OTP salah atau kadaluarsa"}, status_code=400)
    sid = str(uuid.uuid4())
    users = _load_users()
    u = users.get(email, {})
    _sessions[sid] = {"email": email, "is_premium": u.get("is_premium", False)}
    resp = JSONResponse({"ok": True})
    resp.set_cookie("onyx_sid", sid, httponly=True, max_age=60*60*24*30, samesite="lax")
    return resp

async def auth_login(request: Request):
    body = await request.json()
    email = (body.get("email") or "").strip().lower()
    password = body.get("password") or ""
    if not check_password(email, password):
        return JSONResponse({"error": "Email atau password salah"}, status_code=400)
    try:
        await send_otp_for_login(email)
        return JSONResponse({"ok": True, "message": "OTP dikirim"})
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)

async def auth_verify_login(request: Request):
    body = await request.json()
    email = (body.get("email") or "").strip().lower()
    otp = (body.get("otp") or "").strip()
    if not verify_login_otp(email, otp):
        return JSONResponse({"error": "OTP salah atau kadaluarsa"}, status_code=400)
    sid = str(uuid.uuid4())
    users = _load_users()
    u = users.get(email, {})
    _sessions[sid] = {"email": email, "is_premium": u.get("is_premium", False)}
    resp = JSONResponse({"ok": True})
    resp.set_cookie("onyx_sid", sid, httponly=True, max_age=60*60*24*30, samesite="lax")
    return resp

async def auth_logout(request: Request):
    sid = request.cookies.get("onyx_sid")
    if sid and sid in _sessions:
        del _sessions[sid]
    resp = JSONResponse({"ok": True})
    resp.delete_cookie("onyx_sid")
    return resp

# ---------- Chat & Models ----------
async def api_models(request: Request):
    provider = request.query_params.get("provider", "groq")
    return JSONResponse({"models": list_models(provider)})

async def api_chat(request: Request):
    body = await request.json()
    provider = body.get("provider", "groq")
    model = body.get("model", "llama-3.3-70b-versatile")
    messages = body.get("messages", [])
    temperature = float(body.get("temperature", 0.7))
    chat_id = body.get("chat_id") or str(uuid.uuid4())

    async def gen():
        full = ""
        try:
            async for token in stream_chat(provider, model, messages, temperature):
                full += token
                yield f"data: {token}\n\n"
            yield "data: [DONE]\n\n"
            # simpan history sederhana
            session = get_session(request)
            if session:
                save_history(session["email"], chat_id, messages + [{"role": "assistant", "content": full}])
        except Exception as e:
            yield f"data: [ERROR] {e}\n\n"

    return StreamingResponse(gen(), media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "Connection": "keep-alive", "X-Accel-Buffering": "no"})

def save_history(email: str, chat_id: str, messages: list):
    HISTORY_DIR.mkdir(parents=True, exist_ok=True)
    path = HISTORY_DIR / f"{email.replace('@','_')}_{chat_id}.json"
    path.write_text(json.dumps({"id": chat_id, "messages": messages, "updated": time.time()}, indent=2))

async def api_history_list(request: Request):
    session = get_session(request)
    if not session:
        return JSONResponse({"chats": []})
    email = session["email"].replace("@", "_")
    chats = []
    if HISTORY_DIR.exists():
        for f in sorted(HISTORY_DIR.glob(f"{email}_*.json"), key=lambda x: x.stat().st_mtime, reverse=True):
            try:
                data = json.loads(f.read_text())
                preview = ""
                for m in data.get("messages", []):
                    if m.get("role") == "user":
                        preview = m.get("content", "")[:60]
                        break
                chats.append({"id": data.get("id"), "preview": preview or "Chat", "updated": data.get("updated")})
            except Exception:
                pass
    return JSONResponse({"chats": chats[:50]})

async def api_history_get(request: Request):
    session = get_session(request)
    if not session:
        return JSONResponse({"error": "Login dulu"}, status_code=401)
    chat_id = request.query_params.get("id")
    email = session["email"].replace("@", "_")
    path = HISTORY_DIR / f"{email}_{chat_id}.json"
    if not path.exists():
        return JSONResponse({"error": "Tidak ditemukan"}, status_code=404)
    return JSONResponse(json.loads(path.read_text()))

# ---------- Upload & Image ----------
async def api_upload(request: Request):
    form = await request.form()
    file = form.get("file")
    if not file:
        return JSONResponse({"error": "No file"}, status_code=400)
    content = await file.read()
    if len(content) > 10 * 1024 * 1024:
        return JSONResponse({"error": "Max 10MB"}, status_code=400)
    Path("data/uploads").mkdir(parents=True, exist_ok=True)
    ext = (file.filename or "bin").split(".")[-1]
    fname = f"{uuid.uuid4().hex}.{ext}"
    path = f"data/uploads/{fname}"
    async with aiofiles.open(path, "wb") as f:
        await f.write(content)
    return JSONResponse({"ok": True, "filename": file.filename, "path": path, "size": len(content)})

async def api_image(request: Request):
    body = await request.json()
    prompt = (body.get("prompt") or "").strip()
    if not prompt:
        return JSONResponse({"error": "Prompt kosong"}, status_code=400)
    url = pollinations_url(prompt)
    return JSONResponse({"ok": True, "url": url, "prompt": prompt})

# ---------- Connect (Sandingkan) placeholder ----------
async def api_connect_status(request: Request):
    """Status integrasi. Nanti bisa disimpan token user."""
    session = get_session(request)
    connected = {"gmail": True, "spotify": False, "github": False, "notion": False, "slack": False}
    return JSONResponse({"connected": connected})

async def health(request: Request):
    return JSONResponse({"status": "ok", "service": "onyx"})

routes = [
    Route("/", homepage),
    Route("/auth/register", auth_register, methods=["POST"]),
    Route("/auth/verify-register", auth_verify_register, methods=["POST"]),
    Route("/auth/login", auth_login, methods=["POST"]),
    Route("/auth/verify-login", auth_verify_login, methods=["POST"]),
    Route("/auth/logout", auth_logout, methods=["POST"]),
    Route("/api/models", api_models),
    Route("/api/chat", api_chat, methods=["POST"]),
    Route("/api/history", api_history_list),
    Route("/api/history/get", api_history_get),
    Route("/api/upload", api_upload, methods=["POST"]),
    Route("/api/image", api_image, methods=["POST"]),
    Route("/api/connect/status", api_connect_status),
    Route("/health", health),
    Mount("/static", StaticFiles(directory="static"), name="static"),
]

app = Starlette(debug=True, routes=routes)
