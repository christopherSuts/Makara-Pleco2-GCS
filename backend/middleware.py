# main.py
import asyncio, math
import json
import functools
import glob
from datetime import datetime
from typing import Dict, Any, Set, Optional

import os

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
import uvicorn

from pymavlink import mavutil

# CONFIG — single source of truth
SERIAL_DEVICE = "/dev/ttyACM0"
# Fallback glob patterns used to (re)detect the FCU if it re-enumerates under a
# different path after a USB replug (e.g. /dev/ttyACM1). The configured
# SERIAL_DEVICE above is always preferred when present.
SERIAL_DEVICE_GLOBS = ["/dev/ttyACM*", "/dev/ttyUSB*"]
SERIAL_WATCH_INTERVAL = 2.0          # seconds between USB/serial presence checks
SERIAL_BAUD = 115200
MAVROUTER_UDP_PORT = 14550           # mavlink-routerd → middleware (UDP)
MAVROUTER_TCP_PORT = 5760            # mavlink-routerd → MissionPlanner (TCP)
WS_HOST = "0.0.0.0"
WS_PORT_SSL = 9000                   # Hybrid mode  (wss://)
WS_PORT_PLAIN = 9001                 # Full-Offline mode (ws://)
SSL_CERT = "/home/amv-onboard/pleco-certs/amv-onboard.tailc2fe55.ts.net.crt"
SSL_KEY = "/home/amv-onboard/pleco-certs/amv-onboard.tailc2fe55.ts.net.key"
MAVROUTER_CONF_PATH = "/tmp/mavlink-routerd.conf"
MAVROUTER_LOG_PATH = "/tmp/mavlink-routerd.log"

app = FastAPI()
clients: Set[WebSocket] = set()
latest_messages: Dict[str, Dict[str, Any]] = {}

# keep last known values for printing
last_gps: Optional[Dict[str, float]] = None
last_att: Optional[Dict[str, float]] = None
last_rangefinder: Optional[Dict[str, float]] = None
last_gps_raw: Optional[Dict[str, Any]] = None  # fix_type, satellites_visible, time_usec

# JSON_LOG_FILE = datetime.utcnow().strftime("telemetry-%Y%m%d.ndjson")
JSON_LOG_FILE = None

# Coordinate + rangefinder log folder (date-based files, e.g., path_logs/2026-02-08.txt). Set to None to disable.
COORD_ECHO_LOG_FOLDER = "path_logs"

# Global handles so we can close them on shutdown
_mav = None
_reader_task: Optional[asyncio.Task] = None
_mavrouter_proc: Optional[asyncio.subprocess.Process] = None
_mavrouter_log_fh = None
# Path of the serial device mavlink-routerd is currently bound to (None = link down)
_current_serial_device: Optional[str] = None

# Last known echosounder depth (meters)
last_depth_m: Optional[float] = None
# Last known echosounder depth confidence (0-100 signal_quality, or covariance 0-255)
last_depth_confidence: Optional[int] = None



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
    data = {
        "type": "WS_LOG",
        "payload": {"ts": _now(), "level": str(level), "msg": str(msg)},
    }
    emit_nowait(data)


async def verify_mission_count(expected: int, timeout=5):
    """Request the mission list and compare count; logs result via wslog + emits VERIFY messages."""
    if _mav is None:
        await emit(
            {
                "type": "MISSION_VERIFY_ERROR",
                "payload": {"message": "No MAVLink connection"},
            }
        )
        return
    target_sys = _mav.target_system or 1
    target_comp = _mav.target_component or 1

    try:
        _mav.mav.mission_request_list_send(
            target_sys, target_comp, mavutil.mavlink.MAV_MISSION_TYPE_MISSION
        )
        wslog("info", "MISSION_VERIFY: request list")
        msg = _mav.recv_match(type=["MISSION_COUNT"], blocking=True, timeout=timeout)
        if msg is None:
            raise TimeoutError("Timeout waiting for MISSION_COUNT")
        count = int(getattr(msg, "count", 0))
        print(f"[MISSION] VERIFY count={count}, expected={expected}")
        if count == expected:
            wslog("info", f"MISSION saved on FCU (count={count})")
            await emit(
                {
                    "type": "MISSION_VERIFY_RESULT",
                    "payload": {"ok": True, "count": count},
                }
            )
        else:
            wslog("warn", f"MISSION count mismatch: FCU={count} expected={expected}")
            await emit(
                {
                    "type": "MISSION_VERIFY_RESULT",
                    "payload": {
                        "ok": False,
                        "reason": f"Count mismatch FCU={count} expected={expected}",
                    },
                }
            )
    except Exception as e:
        wslog("error", f"MISSION_VERIFY error: {e}")
        await emit({"type": "MISSION_VERIFY_ERROR", "payload": {"message": str(e)}})


async def upload_mission_items_int(items):
    """
    items: list of dicts ready for MISSION_ITEM_INT:
      {seq, frame, command, current, autocontinue, param1..4, x(int32), y(int32), z(float)}
    Sends COUNT -> answers REQUEST_INT with ITEM_INTs -> waits for MISSION_ACK.
    Logs every step via wslog() and emits progress frames for the UI.
    """
    if _mav is None:
        wslog("error", "MISSION_UPLOAD: no MAVLink connection")
        await emit(
            {
                "type": "MISSION_UPLOAD_ERROR",
                "payload": {"message": "No MAVLink connection"},
            }
        )
        return

    try:
        total = len(items)
        target_sys = _mav.target_system or 1
        target_comp = _mav.target_component or 1

        wslog("info", f"MISSION_UPLOAD start: {total} items")
        await emit(
            {
                "type": "MISSION_UPLOAD_PROGRESS",
                "payload": {"step": "START", "total": total},
            }
        )

        # Send how many items will follow
        _mav.mav.mission_count_send(
            target_sys, target_comp, total, mavutil.mavlink.MAV_MISSION_TYPE_MISSION
        )
        print(f"[MISSION] COUNT sent: {total}")
        wslog("info", f"MISSION COUNT sent: {total}")
        await emit(
            {
                "type": "MISSION_UPLOAD_PROGRESS",
                "payload": {"step": "COUNT_SENT", "total": total},
            }
        )

        # Serve each request from FCU
        while True:
            msg = _mav.recv_match(
                type=["MISSION_REQUEST_INT", "MISSION_REQUEST", "MISSION_ACK"],
                blocking=True,
                timeout=10,
            )
            if msg is None:
                raise TimeoutError("Timeout waiting for MISSION_REQUEST/ACK")

            mtype = msg.get_type()

            if mtype in ("MISSION_REQUEST_INT", "MISSION_REQUEST"):
                req_seq = int(getattr(msg, "seq", 0))
                if req_seq < 0 or req_seq >= total:
                    raise ValueError(f"Requested bad seq {req_seq}")

                it = items[req_seq]
                _mav.mav.mission_item_int_send(
                    target_sys,
                    target_comp,
                    int(it["seq"]),
                    int(it["frame"]),
                    int(it["command"]),
                    int(it.get("current", 0)),
                    int(it.get("autocontinue", 1)),
                    float(it.get("param1", 0.0)),
                    float(it.get("param2", 0.0)),
                    float(it.get("param3", 0.0)),
                    float(it.get("param4", 0.0)),
                    int(it["x"]),
                    int(it["y"]),
                    float(it["z"]),
                    mavutil.mavlink.MAV_MISSION_TYPE_MISSION,
                )
                print(f"[MISSION] ITEM_INT sent: seq={req_seq}")
                wslog("info", f"MISSION ITEM sent: {req_seq}/{total}")
                await emit(
                    {
                        "type": "MISSION_UPLOAD_PROGRESS",
                        "payload": {
                            "step": "ITEM_SENT",
                            "index": req_seq,
                            "total": total,
                        },
                    }
                )

            elif mtype == "MISSION_ACK":
                result = int(getattr(msg, "type", 0))
                names = {
                    0: "ACCEPTED",
                    1: "ERROR",
                    2: "UNSUPPORTED",
                    3: "NO_SPACE",
                    4: "INVALID",
                    5: "INVALID_PARAM",
                    6: "FAILED",
                }
                human = names.get(result, result)
                print(f"[MISSION] ACK: {human}")
                if result == 0:
                    wslog("info", f"MISSION ACK: {human}")
                    await emit(
                        {
                            "type": "MISSION_UPLOAD_ACK",
                            "payload": {
                                "ok": True,
                                "message": f"Mission upload {human}",
                                "count": total,
                            },
                        }
                    )
                    # quick verification: re-read count from FCU
                    asyncio.get_event_loop().create_task(verify_mission_count(total))
                else:
                    wslog("error", f"MISSION ACK: {human}")
                    await emit(
                        {
                            "type": "MISSION_UPLOAD_ERROR",
                            "payload": {"message": f"Mission ACK: {human}"},
                        }
                    )
                break

    except Exception as e:
        print("[MISSION] upload error:", e)
        wslog("error", f"MISSION_UPLOAD error: {e}")
        await emit({"type": "MISSION_UPLOAD_ERROR", "payload": {"message": str(e)}})


def send_set_home(
    lat: float = 0.0, lon: float = 0.0, alt: float = 0.0, use_current: bool = False
):
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
        wslog(
            "info",
            f"SET_HOME sending use_current={use_current} lat={lat:.7f} lon={lon:.7f} alt={alt:.2f}",
        )
        _mav.mav.command_long_send(
            _mav.target_system or 1,
            _mav.target_component or 1,
            179,  # MAV_CMD_DO_SET_HOME
            0,
            1.0 if use_current else 0.0,  # param1
            0,
            0,
            0,  # param2..4 unused
            float(lat),  # param5 (x) latitude
            float(lon),  # param6 (y) longitude
            float(alt),  # param7 (z) altitude (AMSL or rel depending on FW)
        )
        print(
            f"SET_HOME sent (use_current={use_current}, lat={lat}, lon={lon}, alt={alt})"
        )
        wslog("info", "SET_HOME command_long_send dispatched")
    except Exception as e:
        print("SET_HOME error:", e)
        wslog("error", f"SET_HOME send error: {e}")


# --- Inbound message handlers ---
async def handle_set_home(ws, payload: dict):
    use_current = bool(payload.get("use_current", False))
    lat = payload.get("lat", 0.0)
    lon = payload.get("lon", 0.0)
    alt = payload.get("alt", 0.0)
    send_set_home(lat, lon, alt, use_current=use_current)


async def handle_mission_upload(ws, payload: dict):
    # Expect payload.items: list of MISSION_ITEM_INT-like dicts (seq, frame, command, x, y, z, param1..4)
    items = payload.get("items") or []
    # spawn your uploader without blocking

    asyncio.get_event_loop().create_task(upload_mission_items_int(items))


async def handle_set_mode(ws, payload: dict):
    mode_name = str(payload.get("mode", "")).upper()
    if not mode_name or _mav is None:
        wslog("warn", f"SET_MODE ignored: invalid mode '{mode_name}' or no connection")
        return

    # 1. Get mode ID from mapping
    mapping = _mav.mode_mapping()
    if not mapping or mode_name not in mapping:
        wslog(
            "warn",
            f"SET_MODE: Unknown mode '{mode_name}'. Available: {list(mapping.keys()) if mapping else 'None'}",
        )
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


async def handle_get_list_path_logs(ws: WebSocket, payload: dict):
    try:
        log_files = await asyncio.to_thread(os.listdir, COORD_ECHO_LOG_FOLDER)
    except FileNotFoundError:
        log_files = []

    response = {"type": "PATH_LOGS_LIST", "logs": log_files}
    await ws.send_text(json.dumps(response))


async def handle_get_path_log(ws: WebSocket, payload: dict):
    log_file_name = payload.get("log", "")
    if not log_file_name:
        wslog("error", "log_file_name can't be empty")
        return
    path_log = []
    try:
        file_path = os.path.join(COORD_ECHO_LOG_FOLDER, log_file_name)
        with open(file_path, "r") as log:
            for line in log:
                try:
                    point = json.loads(line.strip())
                    # Ensure keys exist before trying to read them
                    if "lat" in point and "lon" in point and "depth_m" in point:
                        # Cast to float to safely handle integers and validate numeric types
                        entry = {
                            "lat": float(point["lat"]),
                            "lon": float(point["lon"]),
                            "depth_m": float(point["depth_m"]),
                        }
                        # Forward optional enrichment fields if present
                        for key in ("ts", "alt_m", "yaw_deg", "pitch_deg", "roll_deg",
                                    "gps_fix_type", "satellites_visible",
                                    "depth_confidence"):
                            if key in point:
                                entry[key] = point[key]
                        path_log.append(entry)
                except (json.JSONDecodeError, ValueError, TypeError):
                    # Skip corrupted lines silently rather than crashing the whole request
                    continue
    except FileNotFoundError:
        wslog("error", f"log file '{log_file_name}' not found")
    # Wrap response with a "type"
    response = {"type": "PATH_LOG_DATA", "pathData": path_log}
    await ws.send_text(json.dumps(response))


HANDLERS = {
    "SET_HOME": handle_set_home,
    "MISSION_UPLOAD": handle_mission_upload,
    "SET_MODE": handle_set_mode,
    "GET_LIST_PATH_LOGS": handle_get_list_path_logs,
    "GET_PATH_LOG": handle_get_path_log,
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


def append_coord_echo_log(
    lat: float,
    lon: float,
    alt: float,
    depth_m: Optional[float],
    yaw_deg: Optional[float] = None,
    pitch_deg: Optional[float] = None,
    roll_deg: Optional[float] = None,
    gps_fix_type: Optional[int] = None,
    satellites_visible: Optional[int] = None,
    depth_confidence: Optional[int] = None,
    gps_time_usec: Optional[int] = None,
):
    """Append a JSON record to date-based file in path_logs folder.

    Includes attitude, GPS fix status, and echosounder depth confidence.
    Timestamp prefers Pixhawk GPS time (time_usec from GPS_RAW_INT) when
    available and the fix is locked (fix_type >= 3); otherwise falls back
    to the Jetson system clock.
    """
    if COORD_ECHO_LOG_FOLDER is None:
        return
    try:
        # Create folder if it doesn't exist
        os.makedirs(COORD_ECHO_LOG_FOLDER, exist_ok=True)

        # Get today's date and create filename
        date_str = datetime.utcnow().strftime("%Y-%m-%d")
        log_file = os.path.join(COORD_ECHO_LOG_FOLDER, f"{date_str}.txt")

        # Prefer Pixhawk GPS time when fix is locked (>= 3D fix)
        ts = now_ts()  # fallback: Jetson system clock
        if gps_time_usec and gps_time_usec > 0 and gps_fix_type is not None and gps_fix_type >= 3:
            try:
                from datetime import timezone
                gps_dt = datetime.fromtimestamp(gps_time_usec / 1e6, tz=timezone.utc)
                ts = gps_dt.isoformat()
            except Exception:
                pass  # keep Jetson fallback

        record = {
            "ts": ts,
            "lat": lat,
            "lon": lon,
            "alt_m": alt,
            "depth_m": depth_m,
            "yaw_deg": round(yaw_deg, 2) if yaw_deg is not None else None,
            "pitch_deg": round(pitch_deg, 2) if pitch_deg is not None else None,
            "roll_deg": round(roll_deg, 2) if roll_deg is not None else None,
            "gps_fix_type": gps_fix_type,
            "satellites_visible": satellites_visible,
            "depth_confidence": depth_confidence,
        }
        with open(log_file, "a", encoding="utf-8") as f:
            f.write(json.dumps(record, ensure_ascii=False) + "\n")
        wslog("debug", f"Coord/Rangefinder logged to {log_file}")
    except Exception as e:
        print("Coord/Rangefinder log write error:", e)
        wslog("error", f"Coord/Rangefinder log write error: {e}")


def extract_depth_m(msg) -> Optional[float]:
    # Extract depth in meters from MAVLink DISTANCE_SENSOR message if available
    try:
        if msg.get_type() != "DISTANCE_SENSOR":
            return None
        dist_cm = getattr(msg, "current_distance", None)
        if dist_cm is None:
            return None
        depth = float(dist_cm) / 100.0
        return depth if math.isfinite(depth) else None
    except Exception:
        return None


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
        elif mtype == "DISTANCE_SENSOR":
            # DISTANCE_SENSOR is the modern message for rangefinders
            # covariance: 0-255 (255=unknown) from BlueRobotics Ping sonar
            # signal_quality: 0-100% (available in MAVLink v2 / newer FW)
            covariance = getattr(msg, "covariance", 255)
            signal_quality = getattr(msg, "signal_quality", None)
            # Normalise confidence to 0-100 scale:
            #   prefer signal_quality if available, else map covariance
            if signal_quality is not None and signal_quality >= 0:
                confidence = int(signal_quality)  # already 0-100
            elif covariance < 255:
                confidence = max(0, 100 - int(covariance * 100 / 255))
            else:
                confidence = None  # unknown
            base["payload"] = {
                "current_distance": getattr(msg, "current_distance", 0)
                / 100.0,  # cm to meters
                "min_distance": getattr(msg, "min_distance", 0) / 100.0,
                "max_distance": getattr(msg, "max_distance", 0) / 100.0,
                "type": getattr(msg, "type", 0),
                "id": getattr(msg, "id", 0),
                "covariance": covariance,
                "signal_quality": signal_quality,
                "confidence": confidence,
            }
        elif mtype == "RANGEFINDER":
            # Legacy RANGEFINDER message (if used)
            base["payload"] = {
                "distance": getattr(msg, "distance", 0.0),
                "voltage": getattr(msg, "voltage", 0.0),
            }
        else:
            d = msg.to_dict()
            d.pop("payload", None)
            base["payload"] = d
    except Exception as e:
        base["payload"] = {"error": str(e)}

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


# ---------------------------------------------------------------------------
#  mavlink-routerd subprocess management
# ---------------------------------------------------------------------------

def find_serial_device() -> Optional[str]:
    """Return a currently-present FCU serial device path, or None.

    Prefers the configured SERIAL_DEVICE; otherwise falls back to the first
    match of SERIAL_DEVICE_GLOBS so a USB replug that re-enumerates the FCU
    under a different node (e.g. /dev/ttyACM1) is still picked up.
    """
    if os.path.exists(SERIAL_DEVICE):
        return SERIAL_DEVICE
    for pattern in SERIAL_DEVICE_GLOBS:
        matches = sorted(glob.glob(pattern))
        if matches:
            return matches[0]
    return None


def generate_mavrouter_config(device: str = SERIAL_DEVICE):
    """Generate a mavlink-routerd configuration file from centralized constants."""
    config = (
        "[General]\n"
        f"TcpServerPort={MAVROUTER_TCP_PORT}\n"
        "ReportStats=false\n"
        "MavlinkDialect=ardupilotmega\n"
        "\n"
        "[UartEndpoint serial]\n"
        f"Device={device}\n"
        f"Baud={SERIAL_BAUD}\n"
        "\n"
        "[UdpEndpoint middleware]\n"
        "Mode=Normal\n"
        "Address=127.0.0.1\n"
        f"Port={MAVROUTER_UDP_PORT}\n"
    )
    with open(MAVROUTER_CONF_PATH, "w") as f:
        f.write(config)
    print(f"Generated mavlink-routerd config at {MAVROUTER_CONF_PATH} (device={device})")


async def start_mavlink_router():
    """Start mavlink-routerd as a managed subprocess."""
    global _mavrouter_proc, _mavrouter_log_fh
    _mavrouter_log_fh = open(MAVROUTER_LOG_PATH, "a")
    _mavrouter_proc = await asyncio.create_subprocess_exec(
        "mavlink-routerd", "-c", MAVROUTER_CONF_PATH,
        stdout=_mavrouter_log_fh,
        stderr=asyncio.subprocess.STDOUT,
    )
    print(f"mavlink-routerd started (PID {_mavrouter_proc.pid})")


async def stop_mavlink_router():
    """Stop mavlink-routerd gracefully, then force-kill if needed."""
    global _mavrouter_proc, _mavrouter_log_fh
    if _mavrouter_proc is not None:
        try:
            _mavrouter_proc.terminate()
            try:
                await asyncio.wait_for(_mavrouter_proc.wait(), timeout=5)
                print(f"mavlink-routerd (PID {_mavrouter_proc.pid}) terminated.")
            except asyncio.TimeoutError:
                _mavrouter_proc.kill()
                await _mavrouter_proc.wait()
                print(f"mavlink-routerd (PID {_mavrouter_proc.pid}) killed after timeout.")
        except ProcessLookupError:
            pass
        _mavrouter_proc = None
    if _mavrouter_log_fh is not None:
        _mavrouter_log_fh.close()
        _mavrouter_log_fh = None


async def serial_watchdog_loop(stop_event: asyncio.Event):
    """Continuously (re)detect the FCU serial device and keep mavlink-routerd
    bound to it — making the link survive a USB unplug/replug without having to
    restart the middleware.

    Behaviour each tick:
      1. If mavlink-routerd died on its own, reap it so it can be restarted.
      2. If the device mavlink-routerd is using has vanished (USB unplugged),
         stop mavlink-routerd and free its handle.
      3. If there is no active device, try to (re)detect one — even under a new
         path like /dev/ttyACM1 — and (re)start mavlink-routerd against it.

    The middleware's UDP reader and the WebSocket servers keep running through
    all of this; only the serial owner (mavlink-routerd) is cycled.
    """
    global _current_serial_device
    while not stop_event.is_set():
        try:
            # 1. mavlink-routerd exited unexpectedly → reap and force re-detect.
            if (
                _mavrouter_proc is not None
                and _mavrouter_proc.returncode is not None
            ):
                wslog(
                    "warn",
                    f"mavlink-routerd exited unexpectedly (code {_mavrouter_proc.returncode}) — will restart",
                )
                print(
                    f"[WATCHDOG] mavlink-routerd exited (code {_mavrouter_proc.returncode})."
                )
                await stop_mavlink_router()
                _current_serial_device = None

            # 2. Active device disappeared (USB unplugged).
            if _current_serial_device and not os.path.exists(_current_serial_device):
                wslog(
                    "warn",
                    f"FCU serial device {_current_serial_device} disconnected — stopping mavlink-routerd",
                )
                print(f"[WATCHDOG] Serial device {_current_serial_device} lost.")
                await stop_mavlink_router()
                _current_serial_device = None

            # 3. No active device → try to (re)detect and bring the link up.
            if _current_serial_device is None:
                device = find_serial_device()
                if device:
                    wslog(
                        "info",
                        f"FCU serial device {device} detected — starting mavlink-routerd",
                    )
                    print(f"[WATCHDOG] Serial device {device} detected; starting mavlink-routerd.")
                    generate_mavrouter_config(device)
                    await start_mavlink_router()
                    _current_serial_device = device
        except Exception as e:
            print("[WATCHDOG] error:", repr(e))
            wslog("error", f"Serial watchdog error: {e}")

        await asyncio.sleep(SERIAL_WATCH_INTERVAL)

    # On shutdown, ensure the serial owner is stopped.
    await stop_mavlink_router()


async def mavlink_reader_loop(stop_event: asyncio.Event):
    """
    Listen for MAVLink messages via UDP (from mavlink-routerd) and broadcast
    JSON to websocket clients.  Also prints GPS + attitude to console.
    The loop checks stop_event to exit cleanly on shutdown.
    """
    global last_gps, last_att, last_depth_m, last_depth_confidence, last_gps_raw, _mav
    udp_uri = f"udpin:127.0.0.1:{MAVROUTER_UDP_PORT}"
    print(f"Starting MAVLink listener at {udp_uri}")
    try:
        _mav = mavutil.mavlink_connection(udp_uri)
    except Exception as e:
        print("Failed to open mavlink connection:", e)
        return

    # Get the current asyncio event loop
    loop = asyncio.get_running_loop()

    while not stop_event.is_set():
        try:
            # Create a callable for our blocking function
            # We use 1.0 (float) for the timeout, which is good practice
            blocking_recv = functools.partial(
                _mav.recv_match, blocking=True, timeout=1.0
            )

            # Run the blocking call in asyncio's default thread pool
            # The 'await' pauses THIS task, but NOT the main event loop
            msg = await loop.run_in_executor(
                None, blocking_recv  # Use the default ThreadPoolExecutor
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
                        "payload": {"result": result_names.get(res, res)},
                    }
                    try:
                        await emit(ack_msg)
                    except Exception as e:
                        print("[SET_HOME][ACK] broadcast error:", e)

            # Update depth from rangefinder (if message present)
            depth = extract_depth_m(msg)
            if depth is not None:
                last_depth_m = depth

            # Convert and store latest for snapshot & WS
            j = to_json_msg(msg)
            latest_messages[j["type"]] = {
                "server_ts": j["server_ts"],
                "payload": j["payload"],
            }
            text = json.dumps(j, default=str)

            if JSON_LOG_FILE:
                try:
                    with open(JSON_LOG_FILE, "a", encoding="utf-8") as f:
                        f.write(text + "\n")  # NDJSON: one JSON object per line
                except Exception as e:
                    print("JSON log write error:", e)

            # broadcast to websockets
            await broadcast(text)

            # Update last_gps / last_att / last_rangefinder and print combined line
            if j["type"] == "GLOBAL_POSITION_INT":
                p = j["payload"]
                last_gps = {
                    "lat": p.get("lat"),
                    "lon": p.get("lon"),
                    "alt": p.get("alt"),
                }
                if last_gps.get("lat") is not None and last_gps.get("lon") is not None:
                    # Compute attitude in degrees for logging
                    _yaw_deg = None
                    _pitch_deg = None
                    _roll_deg = None
                    if last_att:
                        _yaw_deg = math.degrees(last_att["yaw"]) if last_att.get("yaw") is not None else None
                        _pitch_deg = math.degrees(last_att["pitch"]) if last_att.get("pitch") is not None else None
                        _roll_deg = math.degrees(last_att["roll"]) if last_att.get("roll") is not None else None
                    # GPS fix info
                    _fix = last_gps_raw.get("fix_type") if last_gps_raw else None
                    _sats = last_gps_raw.get("satellites_visible") if last_gps_raw else None
                    _gps_time = last_gps_raw.get("time_usec") if last_gps_raw else None

                    append_coord_echo_log(
                        last_gps.get("lat"),
                        last_gps.get("lon"),
                        last_gps.get("alt"),
                        last_depth_m,
                        yaw_deg=_yaw_deg,
                        pitch_deg=_pitch_deg,
                        roll_deg=_roll_deg,
                        gps_fix_type=_fix,
                        satellites_visible=_sats,
                        depth_confidence=last_depth_confidence,
                        gps_time_usec=_gps_time,
                    )
            elif j["type"] == "ATTITUDE":
                p = j["payload"]
                last_att = {
                    "roll": p.get("roll"),
                    "pitch": p.get("pitch"),
                    "yaw": p.get("yaw"),
                }
            elif j["type"] == "GPS_RAW_INT":
                p = j["payload"]
                last_gps_raw = {
                    "fix_type": p.get("fix_type"),
                    "satellites_visible": p.get("satellites_visible"),
                    "time_usec": p.get("time_usec"),
                }
            elif j["type"] == "DISTANCE_SENSOR":
                p = j["payload"]
                last_rangefinder = {
                    "distance": p.get("current_distance"),
                    "type": p.get("type"),
                }
                last_depth_m = p.get("current_distance")
                last_depth_confidence = p.get("confidence")
            elif j["type"] == "RANGEFINDER":
                p = j["payload"]
                last_rangefinder = {"distance": p.get("distance"), "type": "legacy"}
                last_depth_m = p.get("distance")
                last_depth_confidence = None  # legacy message has no confidence

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
                    await handler(
                        ws, payload
                    )  # can be async; for long tasks, the handler itself schedules
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
    global _reader_task
    stop_event = asyncio.Event()

    # --- 1. Serial-device watchdog ---
    # No hard pre-flight abort: the watchdog brings mavlink-routerd up as soon
    # as the FCU is present and cycles it on USB unplug/replug, so the
    # middleware can start before the Pixhawk is plugged in and recover on its
    # own afterwards.
    if not find_serial_device():
        print(
            f"WARNING: No FCU serial device found yet (looked for {SERIAL_DEVICE} and "
            f"{SERIAL_DEVICE_GLOBS}). Watchdog will start mavlink-routerd once one appears."
        )
    watchdog_task = asyncio.create_task(serial_watchdog_loop(stop_event))
    print("Serial watchdog task started.")
    await asyncio.sleep(2.0)  # give the watchdog a chance to grab the serial port

    # --- 2. Start MAVLink reader (reads from UDP, not serial) ---
    _reader_task = asyncio.create_task(mavlink_reader_loop(stop_event))
    print("MAVLink background reader task started.")

    # --- 4. Build Uvicorn server list ---
    servers = []

    # SSL server — Hybrid mode (wss://)
    if os.path.exists(SSL_CERT) and os.path.exists(SSL_KEY):
        ssl_cfg = uvicorn.Config(
            app,
            host=WS_HOST,
            port=WS_PORT_SSL,
            ssl_keyfile=SSL_KEY,
            ssl_certfile=SSL_CERT,
            log_level="info",
        )
        servers.append(uvicorn.Server(ssl_cfg))
    else:
        print(f"WARNING: SSL certs not found — skipping Hybrid port {WS_PORT_SSL}")

    # Plain server — Full-Offline mode (ws://)
    plain_cfg = uvicorn.Config(
        app,
        host=WS_HOST,
        port=WS_PORT_PLAIN,
        log_level="info",
    )
    servers.append(uvicorn.Server(plain_cfg))

    # --- 5. Run all servers ---
    try:
        await asyncio.gather(*(s.serve() for s in servers))
    finally:
        # --- 6. Cleanup ---
        print("Uvicorn servers stopped; cleaning up…")
        stop_event.set()
        if _reader_task:
            _reader_task.cancel()
            try:
                await _reader_task
            except asyncio.CancelledError:
                pass
        watchdog_task.cancel()
        try:
            await watchdog_task
        except asyncio.CancelledError:
            pass
        await stop_mavlink_router()
        print("Shutdown complete.")


def main():
    """
    Entry point: runs the asyncio _serve coroutine and handles KeyboardInterrupt
    to produce a clean shutdown (Ctrl+C).
    """
    try:
        asyncio.run(_serve())
    except KeyboardInterrupt:
        print("\nKeyboardInterrupt received — shutting down.")
    except Exception as e:
        print("Unhandled exception in main():", repr(e))


if __name__ == "__main__":
    main()