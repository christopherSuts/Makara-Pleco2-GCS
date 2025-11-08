# main.py
import asyncio
import json
import functools  # <--- CHANGED
from datetime import datetime
from typing import Dict, Any, Set, Optional

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
import uvicorn

from pymavlink import mavutil

# CONFIG - edit if your MAVProxy uses a different bind/port
MAVLINK_BIND = "0.0.0.0"   # listen on all interfaces
MAVLINK_PORT = 14556       # match MAVProxy broadcast port
WS_HOST = "0.0.0.0"
WS_PORT = 9000

app = FastAPI()
clients: Set[WebSocket] = set()
latest_messages: Dict[str, Dict[str, Any]] = {}

# keep last known values for printing
last_gps: Optional[Dict[str, float]] = None
last_att: Optional[Dict[str, float]] = None

# Global handles so we can close them on shutdown
_mav = None
_reader_task: Optional[asyncio.Task] = None


def now_ts() -> str:
    return datetime.utcnow().isoformat() + "Z"


def to_json_msg(msg) -> Dict[str, Any]:
    if msg is None:
        return {}
    mtype = msg.get_type()
    base = {"type": mtype, "server_ts": now_ts(), "payload": {}}
    try:
        if mtype == "ATTITUDE":
            base["payload"] = {
                "roll": float(msg.roll),
                "pitch": float(msg.pitch),
                "yaw": float(msg.yaw),
            }
        elif mtype == "GLOBAL_POSITION_INT":
            base["payload"] = {
                "lat": msg.lat / 1e7,
                "lon": msg.lon / 1e7,
                "alt": msg.alt / 1000.0,
            }
        elif mtype == "HEARTBEAT":
            base["payload"] = {
                "base_mode": int(msg.base_mode),
                "system_status": int(msg.system_status),
            }
        elif mtype == "SYS_STATUS":
            base["payload"] = {
                "voltage_battery": getattr(msg, "voltage_battery", None),
                "battery_remaining": getattr(msg, "battery_remaining", None),
            }
        else:
            d = msg.to_dict()
            d.pop("payload", None)
            base["payload"] = d
    except Exception as e:
        base["payload"] = {"error": str(e)}
    return base


async def broadcast(msg_json: str):
    to_remove = []
    for ws in list(clients):
        try:
            await ws.send_text(msg_json)
        except Exception:
            to_remove.append(ws)
    for ws in to_remove:
        clients.discard(ws)


async def mavlink_reader_loop(stop_event: asyncio.Event):
    """
    Listen for MAVLink UDP packets and broadcast JSON to websocket clients.
    Also prints GPS + attitude to console when available.
    The loop checks stop_event to exit cleanly on shutdown.
    """
    global last_gps, last_att, _mav
    uri = f"udpin:{MAVLINK_BIND}:{MAVLINK_PORT}"
    print("Starting MAVLink listener at", uri)
    try:
        # open a listener (udpin) - stores connection in global _mav for shutdown
        _mav = mavutil.mavlink_connection(uri, source_system=255)
    except Exception as e:
        print("Failed to open mavlink connection:", e)
        return

    # Get the current asyncio event loop
    loop = asyncio.get_running_loop()

    while not stop_event.is_set():
        try:
            # Create a callable for our blocking function
            # We use 1.0 (float) for the timeout, which is good practice
            blocking_recv = functools.partial(_mav.recv_match, blocking=True, timeout=1.0)
            
            # Run the blocking call in asyncio's default thread pool
            # The 'await' pauses THIS task, but NOT the main event loop
            msg = await loop.run_in_executor(
                None,  # Use the default ThreadPoolExecutor
                blocking_recv
            )

            if not msg:
                continue

            # Convert and store latest for snapshot & WS
            j = to_json_msg(msg)
            latest_messages[j["type"]] = {"server_ts": j["server_ts"], "payload": j["payload"]}
            text = json.dumps(j, default=str)
            # broadcast to websockets
            await broadcast(text)

            # Update last_gps / last_att and print combined line
            if j["type"] == "GLOBAL_POSITION_INT":
                p = j["payload"]
                last_gps = {"lat": p.get("lat"), "lon": p.get("lon"), "alt": p.get("alt")}
            elif j["type"] == "ATTITUDE":
                p = j["payload"]
                last_att = {"roll": p.get("roll"), "pitch": p.get("pitch"), "yaw": p.get("yaw")}

            # Print output if we have at least one of them (prints both if both available)
            if last_gps or last_att:
                ts = now_ts()
                gps_str = "GPS: n/a"
                att_str = "ATT: n/a"
                if last_gps:
                    gps_str = f"GPS: lat={last_gps['lat']:.6f}, lon={last_gps['lon']:.6f}, alt={last_gps['alt']:.2f}m"
                if last_att:
                    att_str = f"ATT: roll={last_att['roll']:.3f}, pitch={last_att['pitch']:.3f}, yaw={last_att['yaw']:.3f}"
                print(f"[{ts}] {gps_str} | {att_str}")

        except Exception as e:
            # non-fatal - keep loop alive but print error; stops quicker if stop_event set
            print("MAVLink read error:", repr(e))
            await asyncio.sleep(0.2)

    # cleanup on exit
    print("MAVLink reader stopping, closing mav connection.")
    try:
        if _mav is not None:
            _mav.close()
    except Exception:
        pass
    print("MAVLink reader stopped.")


@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    await ws.accept()
    clients.add(ws)
    print("WebSocket client connected:", ws.client)
    try:
        while True:
            await ws.receive_text()
    except WebSocketDisconnect:
        clients.discard(ws)
        print("WebSocket client disconnected")


@app.get("/snapshot")
async def snapshot():
    return latest_messages


async def _serve():
    """
    Start the MAVLink reader and uvicorn server in the same asyncio loop.
    This coroutine returns when server finishes.
    """
    global _reader_task
    stop_event = asyncio.Event()

    # start the reader task
    _reader_task = asyncio.create_task(mavlink_reader_loop(stop_event))
    print("MAVLink background reader task started.")

    # configure and start uvicorn server programmatically
    config = uvicorn.Config(app, host=WS_HOST, port=WS_PORT, log_level="info")
    server = uvicorn.Server(config)

    # run the server; server.serve() returns when server stops
    await server.serve()

    # server stopped — signal reader to stop
    print("Uvicorn server stopped; signaling reader to stop.")
    stop_event.set()

    # wait for reader to finish
    if _reader_task:
        await _reader_task
    print("Shutdown complete.")


def main():
    """
    Entry point: runs the asyncio _serve coroutine and handles KeyboardInterrupt
    to produce a clean shutdown (Ctrl+C).
    """
    try:
        asyncio.run(_serve())
    except KeyboardInterrupt:
        # Ctrl+C pressed — asyncio.run will raise KeyboardInterrupt; ensure cleanup
        print("\nKeyboardInterrupt received — shutting down.")
        # If more forced cleanup is needed it can be added here.
    except Exception as e:
        print("Unhandled exception in main():", repr(e))


if __name__ == "__main__":
    main()