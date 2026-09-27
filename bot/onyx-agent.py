#!/usr/bin/env python3
"""
Onyx Agent — Jalanin tugas dari server Onyx.
User install di Termux/cmd mereka.
"""
import asyncio
import websockets
import json
import subprocess
import sys
import platform

try:
    import psutil
except ImportError:
    print("Install dulu: pip install psutil")
    sys.exit(1)

SERVER = "ws://127.0.0.1:8081"
USER_ID = sys.argv[1] if len(sys.argv) > 1 else "demo"
TOKEN = sys.argv[2] if len(sys.argv) > 2 else "demo"

async def lapor_resource():
    mem = psutil.virtual_memory()
    disk = psutil.disk_usage('/')
    return {
        "ram_total": round(mem.total / (1024**3), 2),
        "ram_available": round(mem.available / (1024**3), 2),
        "ram_percent": mem.percent,
        "disk_free": round(disk.free / (1024**3), 2),
        "cpu_percent": psutil.cpu_percent(interval=1),
        "os": platform.system(),
        "python": platform.python_version()
    }

async def jalanin(kode, bahasa="python", timeout=30):
    try:
        if bahasa == "python":
            r = subprocess.run(
                ["python3", "-c", kode],
                capture_output=True, text=True, timeout=timeout
            )
        elif bahasa == "bash":
            r = subprocess.run(
                kode, shell=True, capture_output=True, text=True, timeout=timeout
            )
        else:
            return {"error": f"Bahasa {bahasa} gak didukung"}

        return {
            "stdout": r.stdout[:5000],
            "stderr": r.stderr[:5000],
            "code": r.returncode
        }
    except subprocess.TimeoutExpired:
        return {"error": f"Timeout ({timeout} detik)"}
    except Exception as e:
        return {"error": str(e)}

async def main():
    url = f"{SERVER}?userId={USER_ID}&token={TOKEN}"
    print(f"🔌 Konek ke {SERVER}...")
    print(f"👤 User: {USER_ID}")

    while True:
        try:
            async with websockets.connect(url) as ws:
                print("✅ Terhubung ke server Onyx")
                print("📡 Nunggu tugas...\n")

                # Lapor resource
                await ws.send(json.dumps({
                    "type": "resource",
                    "data": await lapor_resource()
                }))

                # Loop tugas
                async for message in ws:
                    data = json.loads(message)

                    if data["type"] == "task":
                        print(f"📥 Tugas: {data['id']}")
                        hasil = await jalanin(
                            data["kode"],
                            data.get("bahasa", "python"),
                            data.get("timeout", 30)
                        )
                        await ws.send(json.dumps({
                            "type": "result",
                            "taskId": data["id"],
                            "result": hasil
                        }))
                        print(f"✅ Selesai: {data['id']}\n")

                    elif data["type"] == "ping":
                        await ws.send(json.dumps({"type": "pong"}))

        except Exception as e:
            print(f"❌ Koneksi putus: {e}")
            print("🔄 Coba lagi dalam 5 detik...")
            await asyncio.sleep(5)

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n👋 Agent dimatiin.")
