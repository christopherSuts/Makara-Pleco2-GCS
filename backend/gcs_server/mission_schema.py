# backend/gcs_server/mission_schema.py
from typing import List, Optional
from pydantic import BaseModel, Field, field_validator, model_validator

class Waypoint(BaseModel):
    seq: int = Field(..., ge=0)
    lat: float = Field(..., ge=-90, le=90)
    lon: float = Field(..., ge=-180, le=180)
    alt: float = 0.0
    cmd: int = 16  # MAV_CMD_NAV_WAYPOINT
    param1: float = 0.0
    param2: float = 0.0
    param3: float = 0.0
    param4: float = 0.0

class Mission(BaseModel):
    mission: List[Waypoint]

    # v2: use field_validator for per-field checks
    @field_validator("mission")
    @classmethod
    def non_empty(cls, v: List[Waypoint]):
        if not v:
            raise ValueError("Mission must contain at least one waypoint")
        return v

    # v2: use model_validator(mode="after") to normalize whole-object state
    @model_validator(mode="after")
    def normalize_seq(self):
        # Ensure seq is 0..N-1 in order
        for i, wp in enumerate(self.mission):
            if wp.seq != i:
                self.mission[i] = Waypoint(**{**wp.model_dump(), "seq": i})
        return self
