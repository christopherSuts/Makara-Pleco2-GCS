import os, asyncio, json
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
import websockets

JETSON_WS = os.getenv("JETSON_AGENT_WS", "ws://127.0.0.1:9001/telemetry")
app = FastAPI(title="GCS Telemetry Proxy")

@app.websocket("/ws/ui")
async def ui_ws(ws: WebSocket):
    await ws.accept()
    try:
        async with websockets.connect(JETSON_WS) as src:
            async def pump_src_to_ui():
                async for m in src:
                    await ws.send_text(m)
            async def pump_ui_to_src():
                while True:
                    _ = await ws.receive_text()  # ignore
            await asyncio.gather(pump_src_to_ui(), pump_ui_to_src())
    except WebSocketDisconnect:
        pass
    except Exception as e:
        await ws.send_text(json.dumps({"type":"error","detail":str(e)}))
