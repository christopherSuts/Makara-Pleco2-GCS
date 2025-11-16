// Each item -> { seq, frame, command, x(lat*1e7), y(lon*1e7), z(alt m), params... }
export function pathToMissionItems(pathObj) {
  const pts = pathObj.points || [];
  const ALT = 0; // surface; change if you want a default depth/alt
  return pts.map((p, i) => ({
    seq: i,
    frame: 3,          // MAV_FRAME_GLOBAL_RELATIVE_ALT
    command: 16,       // MAV_CMD_NAV_WAYPOINT
    current: 0,
    autocontinue: 1,
    param1: 0, param2: 0, param3: 0, param4: 0,
    x: Math.round(p.lat * 1e7), // int32 lat * 1e7 (MISSION_ITEM_INT)
    y: Math.round(p.lng * 1e7), // int32 lon * 1e7
    z: ALT,                     // float altitude (m)
  }));
}
