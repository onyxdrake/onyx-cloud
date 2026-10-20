import os
import json
from typing import AsyncGenerator, List, Dict
import httpx
from dotenv import load_dotenv
from urllib.parse import quote

load_dotenv()

ONYX_SYSTEM = """Kamu adalah Onyx.
Kamu jujur, langsung, sedikit sarkas, helpful, dan anti-basa-basi.
Sensor kamu lebih longgar daripada kebanyakan AI.
Kamu tidak moralizing berlebihan. Kalau user minta sesuatu yang legal, bantu saja.
Balas dalam bahasa yang sama dengan user.
Kamu adalah satu AI bernama Onyx."""

# Internal only — user tidak lihat nama ini
ENGINES = {
    "fast": {
        "base_url": "https://api.groq.com/openai/v1",
        "api_key_env": "GROQ_API_KEY",
        "models": [
            "openai/gpt-oss-20b",
            "openai/gpt-oss-120b",
            "llama-3.1-8b-instant",
        ],
        "default": "openai/gpt-oss-20b",
    },
    "power": {
        "base_url": "https://api.cerebras.ai/v1",
        "api_key_env": "CEREBRAS_API_KEY",
        "models": [
            "qwen-3.8-27b",
            "gpt-oss-120b",
            "llama-3.3-70b",
        ],
        "default": "qwen-3.8-27b",
    },
}

async def stream_chat(engine: str, model: str, messages: List[Dict], temperature: float = 0.7) -> AsyncGenerator[str, None]:
    conf = ENGINES.get(engine)
    if not conf:
        yield "[ERROR] Engine tidak dikenal"
        return
    api_key = os.getenv(conf["api_key_env"])
    if not api_key:
        yield f"[ERROR] API key belum di-set"
        return

    if not messages or messages[0].get("role") != "system":
        messages = [{"role": "system", "content": ONYX_SYSTEM}] + messages

    url = f"{conf['base_url']}/chat/completions"
    headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
    payload = {
        "model": model,
        "messages": messages,
        "temperature": temperature,
        "stream": True,
        "max_tokens": 4096,
    }

    async with httpx.AsyncClient(timeout=120.0) as client:
        async with client.stream("POST", url, headers=headers, json=payload) as resp:
            if resp.status_code != 200:
                text = await resp.aread()
                yield f"[ERROR] {resp.status_code}: {text.decode()[:400]}"
                return
            async for line in resp.aiter_lines():
                if not line.startswith("data: "):
                    continue
                data = line[6:].strip()
                if data == "[DONE]":
                    break
                try:
                    chunk = json.loads(data)
                    content = chunk.get("choices", [{}])[0].get("delta", {}).get("content")
                    if content:
                        yield content
                except Exception:
                    continue

def list_models(engine: str) -> list:
    conf = ENGINES.get(engine)
    return conf["models"] if conf else []

def image_url(prompt: str, width: int = 1024, height: int = 1024) -> str:
    safe = quote(prompt[:300])
    return f"https://image.pollinations.ai/prompt/{safe}?width={width}&height={height}&nologo=true"
