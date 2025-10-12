import os
from fastapi import FastAPI
from pydantic import BaseModel
from typing import List
from .mission_service import MissionUploader
from .mavlink_service import MavlinkService

MAV_EP = os.getenv("MAVLINK_ENDPOINT_API", "udpin:127.0.0.1:14551")
app = FastAPI(title="Jetson Agent API")

mav = MavlinkService(MAV_EP)
uploader = MissionUploader(mav.m)

class MissionBody(BaseModel):
    mission: List[dict]

@app.post("/mission")
def mission_upload(body: MissionBody):
    return {"ok": True, **uploader.upload(body.mission)}

@app.post("/mode/auto")
def mode_auto():
    return uploader.set_mode("AUTO")

@app.post("/mode/rtl")
def mode_rtl():
    return uploader.set_mode("RTL")

@app.post("/arm")
def arm(): return uploader.arm(True)

@app.post("/disarm")
def disarm(): return uploader.arm(False)

@app.get("/health")
def health(): return {"link_alive": mav.link_alive()}
