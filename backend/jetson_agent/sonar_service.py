# import os
# from typing import Optional

# ENABLE = os.getenv("ENABLE_SONAR", "false").lower() == "true"
# DEVICE = os.getenv("PING_DEVICE", "/dev/ttyUSB0")
# BAUD   = int(os.getenv("PING_BAUD", "115200"))

# try:
#     from brping import Ping1D
# except Exception:
#     Ping1D = None

# class SonarService:
#     def __init__(self):
#         self.ok = False
#         self.p = None
#         if ENABLE and Ping1D:
#             try:
#                 self.p = Ping1D(DEVICE, BAUD)
#                 self.ok = bool(self.p.initialize())
#             except Exception:
#                 self.ok = False

#     def read_depth_m(self) -> Optional[float]:
#         if not self.ok or not self.p:
#             return None
#         d = self.p.get_distance()
#         if d and getattr(d, "distance", None) is not None:
#             return d.distance / 1000.0  # mm -> m
#         return None
