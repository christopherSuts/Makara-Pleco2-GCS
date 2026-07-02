"use client";

/**
 * PlaybackMap — review-mode map for replaying a recorded bathymetry survey.
 *
 * Separate from LeafletMap.js (the live view) so the live telemetry rendering
 * path is never touched. Reuses the same react-leaflet stack, the same OSM
 * tiles, and the same per-segment polyline convention as the live "rainbow"
 * perimeter track.
 *
 * Two layers:
 *   1. The survey track — depth-colored polylines, segmented by window so no
 *      line is drawn across a temporal dropout.
 *   2. (Toggle) The interpolated 2D surface — the SAME Delaunay TIN used by the
 *      3D viewer (shared lib/bathyTin), drawn as filled triangles clipped to the
 *      surveyed swath and laid over the basemap.
 *
 * Coloring is dynamic: red = min depth → green = max depth, spanning the actual
 * received data range. Canvas renderer (preferCanvas) keeps the many polygons
 * fast.
 */
import { Fragment, useEffect, useMemo } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  MapContainer,
  TileLayer,
  Polyline,
  Polygon,
  CircleMarker,
  Tooltip,
  useMap,
} from "react-leaflet";
import { depthToColorDynamic } from "@/lib/depthColor";
import { computeTin, edgeThreshold } from "@/lib/bathyTin";

const DEFAULT_COORDS = { lat: -6.144353601068162, lng: 106.88533858899994 };
const DEFAULT_ZOOM = 16;

/** Fit the view to the loaded survey once, when bounds become available. */
function FitBounds({ bounds }) {
  const map = useMap();
  useEffect(() => {
    if (bounds) map.fitBounds(bounds, { padding: [40, 40], maxZoom: 19 });
  }, [map, bounds]);
  return null;
}

export default function PlaybackMap({
  segments = [],
  current = null,
  bounds = null,
  depthRange = [0, 100],
  points = [],
  showSurface = false,
  surfaceKeepPct = 90,
  minConfidence = 0,
}) {
  const [dMin, dMax] = depthRange; // dynamic: from the received data's min/max

  // Interpolated 2D surface (only computed when toggled on).
  const surfaceTriangles = useMemo(() => {
    if (!showSurface || points.length < 3) return [];
    // Accept only soundings whose confidence clears the threshold (missing
    // confidence is treated as passing). The TIN re-interpolates from these.
    const accepted = points.filter(
      (p) => !Number.isFinite(p.conf) || p.conf >= minConfidence
    );
    if (accepted.length < 3) return [];
    const tin = computeTin(accepted);
    if (!tin) return [];
    const threshold = edgeThreshold(tin.triMaxEdge, surfaceKeepPct);
    const out = [];
    for (let t = 0; t < tin.triMaxEdge.length; t++) {
      if (tin.triMaxEdge[t] > threshold) continue; // drop gap-spanning triangles
      const a = tin.tris[t * 3], b = tin.tris[t * 3 + 1], c = tin.tris[t * 3 + 2];
      const pa = tin.pts[a], pb = tin.pts[b], pc = tin.pts[c];
      const meanDepth = (pa.depth + pb.depth + pc.depth) / 3;
      out.push({
        id: t,
        positions: [
          [pa.lat, pa.lng],
          [pb.lat, pb.lng],
          [pc.lat, pc.lng],
        ],
        color: depthToColorDynamic(meanDepth, tin.minDepth, tin.maxDepth),
      });
    }
    return out;
  }, [showSurface, points, surfaceKeepPct, minConfidence]);

  return (
    <MapContainer
      center={DEFAULT_COORDS}
      zoom={DEFAULT_ZOOM}
      zoomControl={false}
      preferCanvas
      style={{ height: "100%", width: "100%", zIndex: 0 }}
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        maxZoom={22}
        maxNativeZoom={19}
      />
      <FitBounds bounds={bounds} />

      {/* Interpolated surface — drawn first so the track sits on top of it */}
      {surfaceTriangles.map((tr) => (
        <Polygon
          key={`surf-${tr.id}`}
          positions={tr.positions}
          pathOptions={{
            stroke: false,
            fillColor: tr.color,
            fillOpacity: 0.55,
          }}
        />
      ))}

      {/* Depth-colored survey track, segmented per (session|window_id) */}
      {segments.map((seg) => (
        <Fragment key={seg.key}>
          {seg.points.slice(0, -1).map((pt, i) => {
            const next = seg.points[i + 1];
            const meanDepth = (pt.depth + next.depth) / 2;
            return (
              <Polyline
                key={`${seg.key}-${i}`}
                positions={[
                  [pt.lat, pt.lng],
                  [next.lat, next.lng],
                ]}
                pathOptions={{
                  color: depthToColorDynamic(meanDepth, dMin, dMax),
                  weight: 4,
                  opacity: 0.9,
                }}
              />
            );
          })}
          {seg.points.length === 1 && (
            <CircleMarker
              center={[seg.points[0].lat, seg.points[0].lng]}
              radius={4}
              pathOptions={{
                color: depthToColorDynamic(seg.points[0].depth, dMin, dMax),
                fillOpacity: 0.9,
              }}
            />
          )}
        </Fragment>
      ))}

      {/* Moving "playhead" marker at the current timeline point */}
      {current && (
        <CircleMarker
          center={[current.lat, current.lng]}
          radius={8}
          pathOptions={{
            color: "#111827",
            weight: 2,
            fillColor: depthToColorDynamic(current.depth, dMin, dMax),
            fillOpacity: 1,
          }}
        >
          <Tooltip permanent direction="top" offset={[0, -6]}>
            {Number.isFinite(current.depth) ? `${current.depth.toFixed(1)} m` : "—"}
          </Tooltip>
        </CircleMarker>
      )}
    </MapContainer>
  );
}
