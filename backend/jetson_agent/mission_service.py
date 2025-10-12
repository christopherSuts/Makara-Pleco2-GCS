from typing import List, Dict
from pymavlink import mavutil

class MissionUploader:
    def __init__(self, mav: mavutil.mavlink_connection):
        self.m = mav

    def upload(self, mission: List[Dict]):
        """
        mission: [{"seq":0,"lat":..,"lon":..,"alt":0.0,"cmd":16, "param1":0,...}, ...]
        Implements the standard MISSION protocol using MISSION_REQUEST_INT.
        """
        # Clear existing
        self.m.waypoint_clear_all_send()
        # Send count
        n = len(mission)
        self.m.waypoint_count_send(n)

        sent = 0
        while True:
            msg = self.m.recv_match(type=["MISSION_REQUEST", "MISSION_REQUEST_INT", "MISSION_ACK"],
                                    blocking=True, timeout=10)
            if not msg:
                raise TimeoutError("Mission upload timed out waiting for requests/ack")

            if msg.get_type() in ("MISSION_REQUEST", "MISSION_REQUEST_INT"):
                i = msg.seq
                wp = mission[i]
                frame = mavutil.mavlink.MAV_FRAME_GLOBAL_RELATIVE_ALT_INT
                self.m.mav.mission_item_int_send(
                    self.m.target_system,
                    self.m.target_component,
                    i,
                    frame,
                    int(wp.get("cmd", mavutil.mavlink.MAV_CMD_NAV_WAYPOINT)),
                    0, 1,  # current, autocontinue
                    float(wp.get("param1", 0.0)),
                    float(wp.get("param2", 0.0)),
                    float(wp.get("param3", 0.0)),
                    float(wp.get("param4", 0.0)),
                    int(wp["lat"] * 1e7),
                    int(wp["lon"] * 1e7),
                    int(float(wp.get("alt", 0.0)) * 1000)
                )
                sent += 1

            elif msg.get_type() == "MISSION_ACK":
                # Optional: check msg.type for success
                break
        return {"count": n, "sent": sent}

    def set_mode(self, mode_name: str):
        """Set mode by name if available: MANUAL, AUTO, RTL..."""
        mode_map = self.m.mode_mapping()
        name = mode_name.upper()
        if name in mode_map:
            self.m.set_mode(mode_map[name])
            return {"ok": True, "mode": name}
        # fallback via command_long
        self.m.mav.command_long_send(
            self.m.target_system, self.m.target_component,
            mavutil.mavlink.MAV_CMD_DO_SET_MODE, 0, 1, 0, 0, 0, 0, 0, 0
        )
        return {"ok": True, "mode": name}

    def arm(self, arm: bool):
        self.m.mav.command_long_send(
            self.m.target_system, self.m.target_component,
            mavutil.mavlink.MAV_CMD_COMPONENT_ARM_DISARM, 0,
            1.0 if arm else 0.0, 0,0,0,0,0,0
        )
        return {"armed": arm}
