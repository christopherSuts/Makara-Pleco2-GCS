import os, json, time, asyncio
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from mavlink_service import MavlinkService
# from sonar_service import SonarService

MAV_EP = os.getenv("MAVLINK_ENDPOINT_WS", "udpin:127.0.0.1:14552")
app = FastAPI(title="Jetson Agent Telemetry")

mav = MavlinkService(MAV_EP)
# sonar = SonarService()
clients = set()

@app.websocket("/telemetry")
async def telemetry(ws: WebSocket):
    await ws.accept()
    clients.add(ws)
    try:
        while True:
            msg = mav.recv_json()
            if msg: await broadcast(msg)
            if int(time.time()*10)%10==0:
                await broadcast({"type":"link","alive":mav.link_alive()})
            #     d = sonar.read_depth_m()
            #     if d is not None: await broadcast({"type":"depth","meters":d})
                print("placeholder depth message")
            await asyncio.sleep(0.05)
    except WebSocketDisconnect:
        clients.discard(ws)
    except Exception:
        clients.discard(ws)

async def broadcast(obj):
    if not clients: return
    text = json.dumps(obj)
    dead=[]
    for c in clients:
        try: await c.send_text(text)
        except Exception: dead.append(c)
    for d in dead: clients.discard(d)
