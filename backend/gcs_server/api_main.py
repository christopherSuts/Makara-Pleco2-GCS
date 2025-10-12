import os
from fastapi import FastAPI
from fastapi.responses import HTMLResponse
from pydantic import BaseModel
from typing import List
import httpx
from .mission_schema import Mission
from ..algorithms.path_planner.grid_coverage import plan_lawnmower

JETSON_API = os.getenv("JETSON_AGENT_API", "http://127.0.0.1:9000")
app = FastAPI(title="GCS Server API")

# ---------- Static UI (serve your built web app if you want) ----------
@app.get("/")
def index():
    # minimal placeholder so you can test quickly
    return HTMLResponse("<h2>GCS Server OK</h2><p>Connect UI WS to /ws/ui</p>")

class BoundaryReq(BaseModel):
    boundary: list
    spacing_m: float = 5.0
    angle_deg: float = 0.0
    start: str = "SW"

@app.post("/plan/coverage")
def plan_coverage(req: BoundaryReq):
    # TODO: call your real algorithms.path_planner
    # wps = [{"seq":i,"lat":lat,"lon":lng,"alt":0.0,"cmd":16}
        #    for i,(lng,lat) in enumerate(req.boundary)]
    # return {"mission": wps}
    pts = plan_lawnmower(
        boundary=req.boundary,
        spacing_m=req.spacing_m,
        angle_deg=req.angle_deg,
        start=req.start
    )
    mission = [{"seq":i, "lat":lat, "lon":lng, "alt":0.0, "cmd":16}
               for i,(lng,lat) in enumerate(pts)]
    return {"mission": mission}

@app.post("/mission/upload")
async def mission_upload(m: Mission):
    async with httpx.AsyncClient(timeout=20) as c:
        r = await c.post(f"{JETSON_API}/mission", json=m.dict())
        return {"ok": r.status_code==200, "agent_reply": r.json()}

@app.post("/mode/auto")
async def mode_auto():
    async with httpx.AsyncClient(timeout=10) as c:
        r = await c.post(f"{JETSON_API}/mode/auto")
        return {"ok": r.status_code==200, "agent_reply": r.json()}

@app.post("/mode/rtl")
async def mode_rtl():
    async with httpx.AsyncClient(timeout=10) as c:
        r = await c.post(f"{JETSON_API}/mode/rtl")
        return {"ok": r.status_code==200, "agent_reply": r.json()}

@app.post("/arm")
async def arm():
    async with httpx.AsyncClient(timeout=10) as c:
        r = await c.post(f"{JETSON_API}/arm")
        return {"ok": r.status_code==200, "agent_reply": r.json()}

@app.post("/disarm")
async def disarm():
    async with httpx.AsyncClient(timeout=10) as c:
        r = await c.post(f"{JETSON_API}/disarm")
        return {"ok": r.status_code==200, "agent_reply": r.json()}
