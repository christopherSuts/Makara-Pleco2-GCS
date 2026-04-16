# main.py
import asyncio, math
import json
import functools  # <--- CHANGED
from datetime import datetime
from typing import Dict, Any, Set, Optional

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
import uvicorn

from pymavlink import mavutil

# CONFIG - edit if your MAVProxy uses a different bind/port
port = "/dev/ttyACM0"
baud_rate = 115200
WS_HOST = "0.0.0.0"
WS_PORT = 9000

app = FastAPI()
clients: Set[WebSocket] = set()
latest_messages: Dict[str, Dict[str, Any]] = {}

# keep last known values for printing
last_gps: Optional[Dict[str, float]] = None
last_att: Optional[Dict[str, float]] = None

# JSON_LOG_FILE = datetime.utcnow().strftime("telemetry-%Y%m%d.ndjson")
JSON_LOG_FILE = None

# Global handles so we can close them on shutdown
_mav = None
_reader_task: Optional[asyncio.Task] = None

# --- Unified emit helpers ---
async def emit(obj: dict):
    """Serialize a dict and broadcast (awaits)."""
    try:
        text = json.dumps(obj, ensure_ascii=False)
        await broadcast(text)
    except Exception as e:
        print("emit() error:", e)

def emit_nowait(obj: dict):
    """Serialize + schedule broadcast without blocking caller."""
    try:
        text = json.dumps(obj, ensure_ascii=False)
        asyncio.get_event_loop().create_task(broadcast(text))
    except Exception as e:
        print("emit_nowait() error:", e)

def _now():
    from datetime import datetime, timezone
    return datetime.now(timezone.utc).isoformat()

def wslog(level: str, msg: str):
    data = {"type": "WS_LOG",
            "payload": {"ts": _now(), "level": str(level), "msg": str(msg)}}
    emit_nowait(data)

async def simulation_mode(stop_event: asyncio.Event):
    """
    Simulation mode: generates dummy MAVLink messages when no hardware is connected.
    Broadcasts simulated GPS, ATTITUDE, HEARTBEAT, SYS_STATUS, and RANGEFINDER data.
    """
    import random
    import math
    
    print("Starting simulation mode...")
    wslog("info", "Running in simulation mode (no MAVLink hardware)")
    
    base_lat = 52.5200  # Berlin as default
    base_lon = 13.4050
    base_alt = 10.0
    base_heading = 0.0
    
    while not stop_event.is_set():
        try:
            timestamp = _now()
            
            # Simulate HEARTBEAT
            heartbeat_msg = {
                "type": "HEARTBEAT",
                "server_ts": timestamp,
                "payload": {
                    "base_mode": 0,
                    "system_status": 4,  # MC_ARMED
                }
            }
            await emit(heartbeat_msg)
            latest_messages["HEARTBEAT"] = {"server_ts": timestamp, "payload": heartbeat_msg["payload"]}
            
            # Simulate GLOBAL_POSITION_INT with slight movement
            base_lat += random.uniform(-0.00001, 0.00001)
            base_lon += random.uniform(-0.00001, 0.00001)
            base_heading = (base_heading + random.uniform(-2, 2)) % 360
            base_alt += random.uniform(-0.1, 0.1)
            base_alt = max(5.0, min(50.0, base_alt))  # Keep between 5-50m
            
            pos_msg = {
                "type": "GLOBAL_POSITION_INT",
                "server_ts": timestamp,
                "payload": {
                    "lat": int(base_lat * 1e7),
                    "lon": int(base_lon * 1e7),
                    "alt": int(base_alt * 1000),
                }
            }
            await emit(pos_msg)
            latest_messages["GLOBAL_POSITION_INT"] = {"server_ts": timestamp, "payload": pos_msg["payload"]}
            
            # Simulate ATTITUDE
            roll = random.uniform(-5, 5)
            pitch = random.uniform(-3, 3)
            yaw = base_heading
            
            att_msg = {
                "type": "ATTITUDE",
                "server_ts": timestamp,
                "payload": {
                    "roll": math.radians(roll),
                    "pitch": math.radians(pitch),
                    "yaw": math.radians(yaw),
                }
            }
            await emit(att_msg)
            latest_messages["ATTITUDE"] = {"server_ts": timestamp, "payload": att_msg["payload"]}
            
            # Simulate RANGEFINDER (echosounder) - depth between 0.5 and 15 meters
            # Simulates the 25-degree cone scanning downward
            depth = random.uniform(0.5, 15.0)
            voltage = random.uniform(2.5, 5.0)
            
            range_msg = {
                "type": "RANGEFINDER",
                "server_ts": timestamp,
                "payload": {
                    "distance": depth,
                    "voltage": voltage,
                }
            }
            await emit(range_msg)
            latest_messages["RANGEFINDER"] = {"server_ts": timestamp, "payload": range_msg["payload"]}
            
            # Simulate DISTANCE_SENSOR with confidence
            dist_sensor_msg = {
                "type": "DISTANCE_SENSOR",
                "server_ts": timestamp,
                "payload": {
                    "distance": depth,
                    "confidence": random.uniform(70, 99),
                    "sensor_type": 0,  # ULTRASOUND
                }
            }
            await emit(dist_sensor_msg)
            latest_messages["DISTANCE_SENSOR"] = {"server_ts": timestamp, "payload": dist_sensor_msg["payload"]}
            
            # Simulate SYS_STATUS
            sys_msg = {
                "type": "SYS_STATUS",
                "server_ts": timestamp,
                "payload": {
                    "voltage_battery": random.randint(11000, 12600),
                    "battery_remaining": random.randint(70, 100),
                }
            }
            await emit(sys_msg)
            latest_messages["SYS_STATUS"] = {"server_ts": timestamp, "payload": sys_msg["payload"]}
            
            # Log output
            print(f"[SIM] GPS: lat={base_lat:.6f}, lon={base_lon:.6f}, alt={base_alt:.1f}m | Depth: {depth:.2f}m")
            
            await asyncio.sleep(0.1)  # 10Hz update rate
            
        except Exception as e:
            print(f"Simulation mode error: {e}")
            await asyncio.sleep(0.5)
    
    print("Simulation mode stopped.")

async def verify_mission_count(expected: int, timeout=5):
    """Request the mission list and compare count; logs result via wslog + emits VERIFY messages."""
    if _mav is None:
        await emit({"type":"MISSION_VERIFY_ERROR","payload":{"message":"No MAVLink connection"}})
        return
    target_sys  = _mav.target_system or 1
    target_comp = _mav.target_component or 1

    try:
        _mav.mav.mission_request_list_send(
            target_sys, target_comp, mavutil.mavlink.MAV_MISSION_TYPE_MISSION
        )
        wslog("info", "MISSION_VERIFY: request list")
        msg = _mav.recv_match(type=['MISSION_COUNT'], blocking=True, timeout=timeout)
        if msg is None:
            raise TimeoutError("Timeout waiting for MISSION_COUNT")
        count = int(getattr(msg, 'count', 0))
        print(f"[MISSION] VERIFY count={count}, expected={expected}")
        if count == expected:
            wslog("info", f"MISSION saved on FCU (count={count})")
            await emit({"type":"MISSION_VERIFY_RESULT","payload":{"ok":True,"count":count}})
        else:
            wslog("warn", f"MISSION count mismatch: FCU={count} expected={expected}")
            await emit({"type":"MISSION_VERIFY_RESULT","payload":{"ok":False,"reason":f'Count mismatch FCU={count} expected={expected}'}})
    except Exception as e:
        wslog("error", f"MISSION_VERIFY error: {e}")
        await emit({"type":"MISSION_VERIFY_ERROR","payload":{"message":str(e)}})


async def upload_mission_items_int(items):
    """
    items: list of dicts ready for MISSION_ITEM_INT:
      {seq, frame, command, current, autocontinue, param1..4, x(int32), y(int32), z(float)}
    Sends COUNT -> answers REQUEST_INT with ITEM_INTs -> waits for MISSION_ACK.
    Logs every step via wslog() and emits progress frames for the UI.
    """
    if _mav is None:
        wslog("error", "MISSION_UPLOAD: no MAVLink connection")
        await emit({"type":"MISSION_UPLOAD_ERROR","payload":{"message":"No MAVLink connection"}})
        return

    try:
        total = len(items)
        target_sys  = _mav.target_system or 1
        target_comp = _mav.target_component or 1

        wslog("info", f"MISSION_UPLOAD start: {total} items")
        await emit({"type":"MISSION_UPLOAD_PROGRESS","payload":{"step":"START","total":total}})

        # Send how many items will follow
        _mav.mav.mission_count_send(
            target_sys, target_comp, total, mavutil.mavlink.MAV_MISSION_TYPE_MISSION
        )
        print(f"[MISSION] COUNT sent: {total}")
        wslog("info", f"MISSION COUNT sent: {total}")
        await emit({"type":"MISSION_UPLOAD_PROGRESS","payload":{"step":"COUNT_SENT","total":total}})

        # Serve each request from FCU
        while True:
            msg = _mav.recv_match(
                type=['MISSION_REQUEST_INT','MISSION_REQUEST','MISSION_ACK'],
                blocking=True, timeout=10
            )
            if msg is None:
                raise TimeoutError("Timeout waiting for MISSION_REQUEST/ACK")

            mtype = msg.get_type()

            if mtype in ('MISSION_REQUEST_INT','MISSION_REQUEST'):
                req_seq = int(getattr(msg, 'seq', 0))
                if req_seq < 0 or req_seq >= total:
                    raise ValueError(f"Requested bad seq {req_seq}")

                it = items[req_seq]
                _mav.mav.mission_item_int_send(
                    target_sys, target_comp,
                    int(it['seq']), int(it['frame']), int(it['command']),
                    int(it.get('current', 0)), int(it.get('autocontinue', 1)),
                    float(it.get('param1', 0.0)), float(it.get('param2', 0.0)),
                    float(it.get('param3', 0.0)), float(it.get('param4', 0.0)),
                    int(it['x']), int(it['y']), float(it['z']),
                    mavutil.mavlink.MAV_MISSION_TYPE_MISSION
                )
                print(f"[MISSION] ITEM_INT sent: seq={req_seq}")
                wslog("info", f"MISSION ITEM sent: {req_seq}/{total}")
                await emit({"type":"MISSION_UPLOAD_PROGRESS","payload":{"step":"ITEM_SENT","index":req_seq,"total":total}})

            elif mtype == 'MISSION_ACK':
                result = int(getattr(msg, 'type', 0))
                names = {0:"ACCEPTED",1:"ERROR",2:"UNSUPPORTED",3:"NO_SPACE",4:"INVALID",5:"INVALID_PARAM",6:"FAILED"}
                human = names.get(result, result)
                print(f"[MISSION] ACK: {human}")
                if result == 0:
                    wslog("info", f"MISSION ACK: {human}")
                    await emit({"type":"MISSION_UPLOAD_ACK","payload":{"ok":True,"message":f"Mission upload {human}","count":total}})
                    # quick verification: re-read count from FCU
                    asyncio.get_event_loop().create_task(verify_mission_count(total))
                else:
                    wslog("error", f"MISSION ACK: {human}")
                    await emit({"type":"MISSION_UPLOAD_ERROR","payload":{"message":f"Mission ACK: {human}"}})
                break

    except Exception as e:
        print("[MISSION] upload error:", e)
        wslog("error", f"MISSION_UPLOAD error: {e}")
        await emit({"type":"MISSION_UPLOAD_ERROR","payload":{"message":str(e)}})

def send_set_home(lat: float = 0.0, lon: float = 0.0, alt: float = 0.0, use_current: bool = False):
    """
    Send MAV_CMD_DO_SET_HOME (179).
    If use_current=True, vehicle uses its current position and lat/lon/alt are ignored by firmware.
    """
    if _mav is None:
        print("SET_HOME ignored: no MAVLink connection")
        wslog("warn", "SET_HOME ignored: no MAVLink connection")
        return
    try:
        # CMD_LONG: target_system, target_component, command, confirmation, param1..param7
        # param1 = use_current (1) or specified (0)
        wslog("info", f"SET_HOME sending use_current={use_current} lat={lat:.7f} lon={lon:.7f} alt={alt:.2f}")
        _mav.mav.command_long_send(
            _mav.target_system or 1,
            _mav.target_component or 1,
            179,  # MAV_CMD_DO_SET_HOME
            0,
            1.0 if use_current else 0.0,  # param1
            0, 0, 0,                      # param2..4 unused
            float(lat),                   # param5 (x) latitude
            float(lon),                   # param6 (y) longitude
            float(alt)                    # param7 (z) altitude (AMSL or rel depending on FW)
        )
        print(f"SET_HOME sent (use_current={use_current}, lat={lat}, lon={lon}, alt={alt})")
        wslog("info", "SET_HOME command_long_send dispatched")
    except Exception as e:
        print("SET_HOME error:", e)
        wslog("error", f"SET_HOME send error: {e}")

# --- Inbound message handlers ---
async def handle_set_home(payload: dict):
    use_current = bool(payload.get("use_current", False))
    lat = payload.get("lat", 0.0)
    lon = payload.get("lon", 0.0)
    alt = payload.get("alt", 0.0)
    send_set_home(lat, lon, alt, use_current=use_current)

async def handle_mission_upload(payload: dict):
    # Expect payload.items: list of MISSION_ITEM_INT-like dicts (seq, frame, command, x, y, z, param1..4)
    items = payload.get("items") or []
    # spawn your uploader without blocking
    
    asyncio.get_event_loop().create_task(upload_mission_items_int(items))

async def handle_set_mode(payload: dict):
    mode_name = str(payload.get("mode", "")).upper()
    if not mode_name or _mav is None:
        wslog("warn", f"SET_MODE ignored: invalid mode '{mode_name}' or no connection")
        return

    # 1. Get mode ID from mapping
    mapping = _mav.mode_mapping()
    if not mapping or mode_name not in mapping:
        wslog("warn", f"SET_MODE: Unknown mode '{mode_name}'. Available: {list(mapping.keys()) if mapping else 'None'}")
        return
    
    mode_id = mapping[mode_name]

    try:
        # 2. Set mode using pymavlink helper
        # set_mode_apm(custom_mode, custom_sub_mode=0, base_mode=0)
        # Note: set_mode_apm handles the COMMAND_LONG(176) generation
        _mav.set_mode(mode_id)
        wslog("info", f"SET_MODE: Sent request for {mode_name} ({mode_id})")
    except Exception as e:
        wslog("error", f"SET_MODE error: {e}")

HANDLERS = {
    "SET_HOME": handle_set_home,
    "MISSION_UPLOAD": handle_mission_upload,
    "SET_MODE": handle_set_mode,
}

def _sanitize_numbers(x):
    """Recursively replace NaN/Inf with None so JSON is always valid."""
    if isinstance(x, float):
        return x if math.isfinite(x) else None
    if isinstance(x, dict):
        return {k: _sanitize_numbers(v) for k, v in x.items()}
    if isinstance(x, (list, tuple)):
        return [_sanitize_numbers(v) for v in x]
    return x

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
        elif mtype == "RANGEFINDER":
            # distance is in meters per MAVLink spec
            base["payload"] = {
                "distance": float(msg.distance),
                "voltage": float(msg.voltage),
            }
        elif mtype == "DISTANCE_SENSOR":
            # DISTANCE_SENSOR has current_distance (cm) and signal_quality (confidence %)
            base["payload"] = {
                "distance": float(msg.current_distance) / 100.0 if hasattr(msg, 'current_distance') else None,  # Convert cm to meters
                "signal_quality": float(msg.signal_quality) if hasattr(msg, 'signal_quality') else None,  # 0-100%
                "sensor_type": int(msg.type) if hasattr(msg, 'type') else None,
                "orientation": int(msg.orientation) if hasattr(msg, 'orientation') else None,
            }
        else:
            # For unknown message types, extract all scalar fields
            payload = {}
            for field in msg.fieldnames:
                try:
                    value = getattr(msg, field, None)
                    if value is not None:
                        payload[field] = value
                except Exception:
                    pass
            base["payload"] = payload
    except Exception as e:
        base["payload"] = {"error": str(e), "msg_type": mtype}

    # <-- ensure no NaN/Inf ever leaves this function
    base["payload"] = _sanitize_numbers(base["payload"])
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
    print("Starting MAVLink listener at", port)
    
    # Check if port exists (for serial connections)
    import os
    if port.startswith('/dev/') and not os.path.exists(port):
        print(f"Warning: Serial port {port} does not exist. Waiting for device...")
        # Wait up to 5 seconds for device to appear
        import time
        for i in range(5):
            if os.path.exists(port):
                print(f"Device {port} found!")
                break
            time.sleep(1)
        if not os.path.exists(port):
            print(f"Device {port} not found after 5 seconds. Running in simulation mode.")
            # Run in simulation mode - generate dummy data
            await simulation_mode(stop_event)
            return
    
    try:
        # open a listener (udpin) - stores connection in global _mav for shutdown
        _mav = mavutil.mavlink_connection(port, baud=baud_rate)
    except Exception as e:
        print(f"Failed to open mavlink connection: {e}")
        # Fall back to simulation mode
        await simulation_mode(stop_event)
        return

    try:
        # Wait for heartbeat and request rangefinder data stream
        print("Waiting for heartbeat...")
        _mav.wait_heartbeat()
        print(f"Heartbeat received from system {_mav.target_system}, component {_mav.target_component}")
        
        # Request rangefinder data at 10Hz
        _mav.mav.request_data_stream_send(
            _mav.target_system,
            _mav.target_component,
            mavutil.mavlink.MAV_DATA_STREAM_RAW_SENSORS,
            1,  # start
            10  # interval (Hz)
        )
        print("Requested RANGEFINDER data stream at 10Hz")
        
        # Also request DISTANCE_SENSOR which has confidence data
        _mav.mav.request_data_stream_send(
            _mav.target_system,
            _mav.target_component,
            mavutil.mavlink.MAV_DATA_STREAM_POSITION,
            1,  # start
            10  # interval (Hz)
        )
        print("Requested DISTANCE_SENSOR data stream at 10Hz")
        
        # Configure Blue Robotics Ping rangefinder if not already set
        # Set RNGFND1_TYPE = 23 (BlueRoboticsPing)
        print("Configuring RNGFND1_TYPE = 23 (BlueRobotics Ping)...")
        _mav.mav.param_set_send(
            _mav.target_system,
            _mav.target_component,
            b'RNGFND1_TYPE',
            23,
            mavutil.mavlink.MAV_PARAM_TYPE_UINT8
        )
        
        # Set RNGFND1_ORIENT = 25 (downward facing for boat)
        print("Configuring RNGFND1_ORIENT = 25 (down)...")
        _mav.mav.param_set_send(
            _mav.target_system,
            _mav.target_component,
            b'RNGFND1_ORIENT',
            25,
            mavutil.mavlink.MAV_PARAM_TYPE_UINT8
        )
        
        # Set RNGFND1_MAX = 96m (reliable range)
        print("Configuring RNGFND1_MAX = 96...")
        _mav.mav.param_set_send(
            _mav.target_system,
            _mav.target_component,
            b'RNGFND1_MAX',
            96.0,
            mavutil.mavlink.MAV_PARAM_TYPE_REAL32
        )
        
        # Set RNGFND1_MIN = 0.3m
        print("Configuring RNGFND1_MIN = 0.3...")
        _mav.mav.param_set_send(
            _mav.target_system,
            _mav.target_component,
            b'RNGFND1_MIN',
            0.3,
            mavutil.mavlink.MAV_PARAM_TYPE_REAL32
        )
        
        print("Rangefinder configuration complete!")
    except Exception as e:
        print(f"Failed to setup data streams: {e}")
        # Continue anyway - we might still get some data

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

            if msg is None:
                continue

            if msg.get_type() == "COMMAND_ACK":
                try:
                    cmd = int(msg.command)
                    res = int(msg.result)
                except Exception:
                    cmd = None
                    res = None

                if cmd == 179:  # MAV_CMD_DO_SET_HOME
                    # MAV_RESULT_* values: 0=ACCEPTED, 1=TEMPORARILY_REJECTED, 2=DENIED, 3=UNSUPPORTED, 4=FAILED, 5=IN_PROGRESS
                    result_names = {
                        0: "ACCEPTED",
                        1: "TEMPORARILY_REJECTED",
                        2: "DENIED",
                        3: "UNSUPPORTED",
                        4: "FAILED",
                        5: "IN_PROGRESS",
                    }
                    print(f"[SET_HOME][ACK] result={result_names.get(res, res)}")
                    wslog("info", f"SET_HOME ACK: {result_names.get(res,res)}")

                    # Optional: tell all connected web clients so you can show a toast in the UI
                    ack_msg = {
                        "type": "SET_HOME_ACK",
                        "payload": {"result": result_names.get(res, res)}
                    }
                    try:
                        await emit(ack_msg)
                    except Exception as e:
                        print("[SET_HOME][ACK] broadcast error:", e)

            if not msg:
                continue

            # Convert and store latest for snapshot & WS
            j = to_json_msg(msg)
            latest_messages[j["type"]] = {"server_ts": j["server_ts"], "payload": j["payload"]}
            text = json.dumps(j, default=str)

            if JSON_LOG_FILE:
                try:
                    with open(JSON_LOG_FILE, "a", encoding="utf-8") as f:
                        f.write(text + "\n")  # NDJSON: one JSON object per line
                except Exception as e:
                    print("JSON log write error:", e)

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
                # print(f"[{ts}] {gps_str} | {att_str}")

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
    wslog("info", f"WebSocket client connected: {ws.client}")
    print("WebSocket client connected:", ws.client)
    try:
        while True:
            text = await ws.receive_text()
            try:
                data = json.loads(text)
                if not isinstance(data, dict):
                    continue
                msg_type = data.get("type")
                payload = data.get("payload") or {}
                handler = HANDLERS.get(msg_type)
                if handler:
                    await handler(payload)  # can be async; for long tasks, the handler itself schedules
            except Exception as e:
                wslog("warn", f"WS inbound parse/dispatch error: {e}")
                # ignore bad frames, keep loop alive
    except WebSocketDisconnect:
        clients.discard(ws)
        wslog("info", f"WebSocket client disconnected: {ws.client}")

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
    
    # Give the reader a moment to start and print its init messages
    await asyncio.sleep(0.5)

    # configure and start uvicorn server programmatically
    # SSL certificates may not exist in test environment - try without SSL first
    ssl_keyfile = "/home/amv-onboard/pleco-certs/amv-onboard.tailc2fe55.ts.net.key"
    ssl_certfile = "/home/amv-onboard/pleco-certs/amv-onboard.tailc2fe55.ts.net.crt"
    
    import os
    if not os.path.exists(ssl_keyfile) or not os.path.exists(ssl_certfile):
        print("SSL certificates not found, running without HTTPS")
        config = uvicorn.Config(
            app,
            host=WS_HOST,
            port=WS_PORT,
            log_level="info",
        )
    else:
        config = uvicorn.Config(
            app,
            host=WS_HOST,
            port=WS_PORT,
            ssl_keyfile=ssl_keyfile,
            ssl_certfile=ssl_certfile,
            log_level="info",
        )
    
    server = uvicorn.Server(config)

    # run the server; server.serve() returns when server stops
    try:
        await server.serve()
    except Exception as e:
        print(f"Uvicorn server error: {e}")

    # server stopped — signal reader to stop
    print("Uvicorn server stopped; signaling reader to stop.")
    stop_event.set()

    # wait for reader to finish
    if _reader_task:
        try:
            await asyncio.wait_for(_reader_task, timeout=5.0)
        except asyncio.TimeoutError:
            print("Reader task timed out, cancelling...")
            _reader_task.cancel()
        except Exception as e:
            print(f"Reader task error: {e}")
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
    except Exception as e:
        print(f"Unhandled exception in main(): {repr(e)}")
        # Don't re-raise, just exit gracefully


if __name__ == "__main__":
    main()