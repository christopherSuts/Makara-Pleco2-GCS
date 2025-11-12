"use client";
import { useState, useCallback, useMemo } from "react";

/** --- helpers --- */
function metersToDegLat(m) { return m / 111320; }
function metersToDegLng(m, atLatDeg) {
  const rad = Math.PI * atLatDeg / 180;
  return m / (111320 * Math.cos(rad || 1e-9));
}

function pointInPoly(lat, lng, poly) {
  // poly: [{lat,lng}, ...] (closed or open)
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].lng, yi = poly[i].lat;
    const xj = poly[j].lng, yj = poly[j].lat;
    const intersect =
      ((yi > lat) !== (yj > lat)) &&
      (lng < (xj - xi) * (lat - yi) / ((yj - yi) || 1e-12) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

export function usePath() {
  const [line, setLine] = useState([]);            // Array<[lat,lng]>
  const [saved, setSaved] = useState([]);          // [{id,name,points}]
  const hasPath = line.length > 1;
  const [lastParams, setLastParams] = useState({
    orientation: "TB",
    rowGapMeters: 5,
    wpGapMeters: 3,
  });

  const bboxFromBoundary = useCallback((pts) => {
    if (!pts?.length) return null;
    const lats = pts.map(p => p.lat), lngs = pts.map(p => p.lng);
    return {
      minLat: Math.min(...lats),
      maxLat: Math.max(...lats),
      minLng: Math.min(...lngs),
      maxLng: Math.max(...lngs),
      midLat: (Math.min(...lats) + Math.max(...lats)) / 2,
    };

  }, []);

  // function snakeBetween(a, b, stripes = 7) {
  //   const arr=[]; for (let i=0;i<stripes;i++){ const t0=i/stripes, t1=(i+1)/stripes;
  //     const p0=[a[0]+(b[0]-a[0])*t0, a[1]+(b[1]-a[1])*t0]; const p1=[a[0]+(b[0]-a[0])*t1, a[1]+(b[1]-a[1])*t1];
  //     if (i%2===0) arr.push([p0[0],p0[1]],[p0[0],b[1]],[p1[0],b[1]]); else arr.push([p0[0],p0[1]],[p0[0],a[1]],[p1[0],a[1]]);
  //   } return arr;
  // }

  /** Core generator: boustrophedon-by-sampling */
  const generate = useCallback(
    (opts) => {
      const {
        boundary,                   // { id?, name?, points: [{lat,lng}] }
        orientation = "TB",         // default, can be TB | BT | LR | RL
        rowGapMeters = 5,           // default
        wpGapMeters = 3,            // default
      } = opts || {};

      setLastParams({ orientation, rowGapMeters, wpGapMeters });

      const boundaryPts = boundary?.points ?? boundary; // accept points array too
      if (!Array.isArray(boundaryPts) || boundaryPts.length < 3) {
        alert("Pick or show a boundary first.");
        return;
      }

      const bbox = bboxFromBoundary(boundaryPts);
      const { minLat, maxLat, minLng, maxLng, midLat } = bbox;

      const result = [];
      const rows = [];

      // Choose sweep axis
      const horizontal = orientation === "TB" || orientation === "BT";
      const startLat = orientation === "TB" ? maxLat : minLat;
      const endLat   = orientation === "TB" ? minLat : maxLat;

      const startLng = orientation === "LR" ? minLng : maxLng;
      const endLng   = orientation === "LR" ? maxLng : minLng;

      if (horizontal) {
        const dLat = metersToDegLat(rowGapMeters);
        const stepLng = metersToDegLng(wpGapMeters, midLat);

        // iterate rows from start to end
        const sign = orientation === "TB" ? -1 : 1;
        for (let lat = startLat, r = 0;
             sign > 0 ? lat <= endLat : lat >= endLat;
             lat += sign * dLat, r++) {

          // sample from left->right across bbox
          const row = [];
          const left = minLng, right = maxLng;
          const start = left, stop = right;
          const dirForward = r % 2 === 0; // boustrophedon
          const step = stepLng * (dirForward ? 1 : -1);
          const first = dirForward ? start : stop;
          const last  = dirForward ? stop  : start;

          // sample line
          for (
            let x = first;
            dirForward ? x <= last + 1e-12 : x >= last - 1e-12;
            x += step
          ) {
            if (pointInPoly(lat, x, boundaryPts)) row.push({ lat, lng: x });
          }
          if (row.length) rows.push(row);
        }
      } else {
        // vertical stripes
        const dLng = metersToDegLng(rowGapMeters, midLat);
        const stepLat = metersToDegLat(wpGapMeters);

        const sign = orientation === "RL" ? -1 : 1;
        for (let lng = startLng, c = 0;
             sign > 0 ? lng <= endLng : lng >= endLng;
             lng += sign * dLng, c++) {

          const col = [];
          const bottom = minLat, top = maxLat;
          const start = bottom, stop = top;
          const dirForward = c % 2 === 0;
          const step = stepLat * (dirForward ? 1 : -1);
          const first = dirForward ? start : stop;
          const last  = dirForward ? stop  : start;

          for (
            let y = first;
            dirForward ? y <= last + 1e-12 : y >= last - 1e-12;
            y += step
          ) {
            if (pointInPoly(y, lng, boundaryPts)) col.push({ lat: y, lng });
          }
          if (col.length) rows.push(col);
        }
      }

      // Concatenate rows into a single snaking polyline
      for (const row of rows) {
        if (row.length < 2) continue;
        result.push(...row);
      }

      setLine(result);
    },
    [bboxFromBoundary]
  );

  // const generate = useCallback((orientation, boundaryPoints) => {
  //   const bbox = bboxFromBoundary(boundaryPoints);
  //   if (!bbox) { alert("Create/show a boundary first."); return; }
  //   const { minLat, maxLat, minLng, maxLng } = bbox; let pts = [];
  //   if (orientation === "TB") { const L = [maxLat, minLng], R = [maxLat, maxLng]; pts = snakeBetween(L, R).map(([lat, lng]) => [lat - (maxLat - minLat), lng]); }
  //   if (orientation === "BT") { const L = [minLat, minLng], R = [minLat, maxLng]; pts = snakeBetween(L, R).map(([lat, lng]) => [lat + (maxLat - minLat), lng]); }
  //   if (orientation === "RL") { const T = [maxLat, maxLng], B = [minLat, maxLng]; const raw = snakeBetween(T, B); pts = raw.map(([lat, lng]) => [lat, lng - (maxLng - minLng)]); }
  //   if (orientation === "LR") { const T = [maxLat, minLng], B = [minLat, minLng]; const raw = snakeBetween(T, B); pts = raw.map(([lat, lng]) => [lat, lng + (maxLng - minLng)]); }
  //   setLine(pts);
  // }, [bboxFromBoundary]);

  // const save = useCallback(() => {
  //   if (line.length < 2) return;
  //   const id = Date.now(); const name = prompt("Name this path:", `Path ${saved.length + 1}`) || "Path";
  //   setSaved(prev => [{ id, name, points: line }, ...prev]);
  // }, [line, saved.length]);


  /** Create a MAVLink-ish WP list and download JSON (like perimeter) */
  const save = useCallback(
    (opts = {}) => {
      if (line.length < 2) {
        alert("No path to save.");
        return;
      }
      const { boundary, defaultAlt = 0 } = opts;
      const params = opts.params ?? lastParams; // default to remembered knobs

      const id = Date.now();
      const name =
        (typeof opts.name === "string" && opts.name.trim()) ||
        `Path ${saved.length + 1}`;

      // Convert to a MAVLink-friendly mission array (FRAME=3, CMD=16)
      const waypoints = line.map((p, i) => ({
        seq: i,
        frame: 3,            // MAV_FRAME_GLOBAL_RELATIVE_ALT
        command: 16,         // MAV_CMD_NAV_WAYPOINT
        param1: 0,           // hold time
        param2: 0,           // acceptance radius
        param3: 0,           // pass radius
        param4: 0,           // yaw
        x: p.lat,
        y: p.lng,
        z: defaultAlt,
        autocontinue: 1,
      }));

      const boundaryRef = boundary
        ? {
            id: boundary.id ?? null,
            name: boundary.name ?? null,
            // lightweight fingerprint so we know which boundary this came from:
            pointsHash: (boundary.points || [])
              .map((q) => `${q.lat.toFixed(5)},${q.lng.toFixed(5)}`)
              .join("|")
              .slice(0, 120),
          }
        : null;

      const payload = {
        type: "asv-path",
        name,
        createdAt: new Date().toISOString(),
        params,            // {orientation,rowGapMeters,wpGapMeters}
        boundaryRef,       // which boundary this plan is based on
        points: line,      // [{lat,lng}]
        waypoints,         // MAVLink-friendly
      };

      // keep in-memory list
      setSaved((prev) => [{ id, name, points: line, meta: payload }, ...prev]);

      // download JSON (pretty, like perimeter)
      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `path_${name.replace(/\s+/g, "_")}_${new Date()
        .toISOString()
        .replace(/[:.]/g, "-")}.json`;
      a.click();
      URL.revokeObjectURL(url);
    },
    [line, saved.length, lastParams]
  );

  const load = useCallback(
    (objOrUndefined) => {
      if (objOrUndefined && typeof objOrUndefined === "object") {
        // direct JSON object (e.g., from a modal)
        const pts = Array.isArray(objOrUndefined.points)
          ? objOrUndefined.points
              .map((p) => ({ lat: Number(p.lat), lng: Number(p.lng) }))
              .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng))
          : [];
        if (pts.length < 2) {
          alert("Invalid path JSON.");
          return;
        }
        setLine(pts);
        return;
      }

      // legacy prompt loader
      if (!saved.length) {
        alert("No saved paths yet.");
        return;
      }
      const idx =
        Number(
          prompt(
            saved
              .map((p, i) => `${i + 1}. ${p.name}`)
              .join("\n") + "\nEnter number:"
          )
        ) - 1;
      if (!Number.isFinite(idx) || idx < 0 || idx >= saved.length) return;
      setLine(saved[idx].points);
    },
    [saved]
  );
  const clear = useCallback(() => setLine([]), []);

  return { line, saved, hasPath, generate, save, load, clear, lastParams };
}
