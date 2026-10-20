import os
import random
import string
import json
import hashlib
import time
from pathlib import Path
from email.message import EmailMessage
import aiosmtplib
from dotenv import load_dotenv

load_dotenv()

USERS_FILE = Path("data/users.json")
OTP_STORE = {}  # email -> {"otp": str, "expire": float, "password_hash": str}

def _hash_password(password: str, salt: str = None) -> tuple[str, str]:
    if salt is None:
        salt = "".join(random.choices(string.ascii_letters + string.digits, k=16))
    h = hashlib.sha256((salt + password).encode()).hexdigest()
    return h, salt

def _load_users() -> dict:
    if USERS_FILE.exists():
        return json.loads(USERS_FILE.read_text())
    return {}

def _save_users(users: dict):
    USERS_FILE.parent.mkdir(parents=True, exist_ok=True)
    USERS_FILE.write_text(json.dumps(users, indent=2))

def generate_otp(length: int = 6) -> str:
    return "".join(random.choices(string.digits, k=length))

async def send_otp_for_register(email: str, password: str) -> bool:
    """Kirim OTP untuk pendaftaran. Password di-hash dulu, simpan sementara."""
    user = os.getenv("GMAIL_USER")
    app_pass = os.getenv("GMAIL_PASS")
    if not user or not app_pass:
        raise RuntimeError("GMAIL_USER / GMAIL_PASS belum di-set")

    users = _load_users()
    if email.lower() in users:
        raise ValueError("Email sudah terdaftar")

    otp = generate_otp()
    pw_hash, salt = _hash_password(password)
    OTP_STORE[email.lower()] = {
        "otp": otp,
        "expire": time.time() + 600,  # 10 menit
        "password_hash": pw_hash,
        "salt": salt,
        "mode": "register",
    }

    msg = EmailMessage()
    msg["From"] = user
    msg["To"] = email
    msg["Subject"] = "Onyx – Kode OTP Pendaftaran"
    msg.set_content(f"Kode OTP kamu: {otp}\n\nBerlaku 10 menit.\nKalau bukan kamu, abaikan.")

    await aiosmtplib.send(
        msg,
        hostname="smtp.gmail.com",
        port=587,
        start_tls=True,
        username=user,
        password=app_pass,
    )
    return True

async def send_otp_for_login(email: str) -> bool:
    users = _load_users()
    if email.lower() not in users:
        raise ValueError("Email belum terdaftar")

    user = os.getenv("GMAIL_USER")
    app_pass = os.getenv("GMAIL_PASS")
    otp = generate_otp()
    OTP_STORE[email.lower()] = {
        "otp": otp,
        "expire": time.time() + 600,
        "mode": "login",
    }

    msg = EmailMessage()
    msg["From"] = user
    msg["To"] = email
    msg["Subject"] = "Onyx – Kode OTP Login"
    msg.set_content(f"Kode OTP kamu: {otp}\n\nBerlaku 10 menit.")

    await aiosmtplib.send(
        msg,
        hostname="smtp.gmail.com",
        port=587,
        start_tls=True,
        username=user,
        password=app_pass,
    )
    return True

def verify_and_create_account(email: str, otp: str) -> bool:
    data = OTP_STORE.get(email.lower())
    if not data or data.get("mode") != "register":
        return False
    if time.time() > data["expire"]:
        del OTP_STORE[email.lower()]
        return False
    if data["otp"] != otp:
        return False

    users = _load_users()
    users[email.lower()] = {
        "password_hash": data["password_hash"],
        "salt": data["salt"],
        "created_at": time.time(),
        "is_premium": False,
    }
    _save_users(users)
    del OTP_STORE[email.lower()]
    return True

def verify_login_otp(email: str, otp: str) -> bool:
    data = OTP_STORE.get(email.lower())
    if not data or data.get("mode") != "login":
        return False
    if time.time() > data["expire"]:
        del OTP_STORE[email.lower()]
        return False
    if data["otp"] != otp:
        return False
    del OTP_STORE[email.lower()]
    return True

def check_password(email: str, password: str) -> bool:
    users = _load_users()
    u = users.get(email.lower())
    if not u:
        return False
    h, _ = _hash_password(password, u["salt"])
    return h == u["password_hash"]
