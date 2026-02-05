"""
Mock MAVLink UDP sender for testing backend without hardware.
Sends GLOBAL_POSITION_INT and DISTANCE_SENSOR messages to UDP port 14555.
"""
import math
import time
import argparse

from pymavlink import mavutil


def main():
    parser = argparse.ArgumentParser(description="Mock MAVLink UDP sender")
    parser.add_argument("--ip", default="127.0.0.1", help="UDP target IP")
    parser.add_argument("--port", type=int, default=14555, help="UDP target port")
    parser.add_argument("--rate", type=float, default=2.0, help="Messages per second")
    parser.add_argument("--depth", type=float, default=1.5, help="Base depth (meters)")
    args = parser.parse_args()

    conn = mavutil.mavlink_connection(f"udpout:{args.ip}:{args.port}", source_system=255)

    start = time.time()
    seq = 0
    while True:
        t = time.time() - start

        # simple circular motion around a base coordinate
        base_lat = -6.1443536
        base_lon = 106.8853386
        lat = base_lat + 0.0001 * math.cos(t / 10.0)
        lon = base_lon + 0.0001 * math.sin(t / 10.0)
        alt_m = 1.2 + 0.1 * math.sin(t / 5.0)

        # GLOBAL_POSITION_INT
        conn.mav.global_position_int_send(
            int(t * 1000),
            int(lat * 1e7),
            int(lon * 1e7),
            int(alt_m * 1000),
            int(alt_m * 1000),
            0, 0, 0,
            0,
        )

        # DISTANCE_SENSOR (cm)
        depth_m = args.depth + 0.2 * math.sin(t / 3.0)
        conn.mav.distance_sensor_send(
            int(t * 1000),
            20,   # min_distance (cm)
            1000, # max_distance (cm)
            int(depth_m * 100),
            0,    # sensor type
            0,    # sensor id
            0,    # orientation
            255,  # covariance unknown
        )

        seq += 1
        time.sleep(max(0.0, 1.0 / args.rate))


if __name__ == "__main__":
    main()
