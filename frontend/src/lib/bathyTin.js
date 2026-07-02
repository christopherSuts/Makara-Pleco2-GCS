/**
 * bathyTin.js — shared Delaunay (TIN) interpolation for the bathymetry survey.
 *
 * One source of truth used by BOTH the 3D viewer (Mapping3DModal) and the 2D
 * map overlay (PlaybackMap), so they always show the same interpolated surface.
 *
 * Points may be { lat, lng|lon, depth|depth_m }. Output carries the TIN in two
 * coordinate systems: projected local metres (xs/zs — for three.js geometry)
 * and the original lat/lng per vertex (pts — for Leaflet polygons), plus each
 * triangle's longest edge so callers can cull gap-spanning triangles.
 */
import Delaunator from "delaunator";

export function computeTin(rawPoints) {
  const pts = (rawPoints || [])
    .map((p) => ({
      lat: Number(p.lat),
      lng: Number(p.lng ?? p.lon),
      depth: Number(p.depth ?? p.depth_m),
    }))
    .filter(
      (p) => Number.isFinite(p.lat) && Number.isFinite(p.lng) && Number.isFinite(p.depth)
    );
  if (pts.length < 3) return null;

  let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
  let minDepth = Infinity, maxDepth = -Infinity;
  for (const p of pts) {
    if (p.lat < minLat) minLat = p.lat;
    if (p.lat > maxLat) maxLat = p.lat;
    if (p.lng < minLng) minLng = p.lng;
    if (p.lng > maxLng) maxLng = p.lng;
    if (p.depth < minDepth) minDepth = p.depth;
    if (p.depth > maxDepth) maxDepth = p.depth;
  }

  // Local equirectangular projection to metres (accurate over a small survey).
  const DEG2RAD = Math.PI / 180;
  const R = 6378137;
  const cLat = (minLat + maxLat) / 2;
  const cLng = (minLng + maxLng) / 2;
  const cosLat0 = Math.cos(cLat * DEG2RAD);

  const n = pts.length;
  const xs = new Float64Array(n);
  const zs = new Float64Array(n);
  const depths = new Float64Array(n);
  const coords = new Float64Array(n * 2);
  let extent = 1;
  for (let i = 0; i < n; i++) {
    const x = R * (pts[i].lng - cLng) * DEG2RAD * cosLat0;
    const z = -R * (pts[i].lat - cLat) * DEG2RAD;
    xs[i] = x;
    zs[i] = z;
    depths[i] = pts[i].depth;
    coords[i * 2] = x;
    coords[i * 2 + 1] = z;
    extent = Math.max(extent, Math.abs(x), Math.abs(z));
  }

  const del = new Delaunator(coords);
  const tris = del.triangles; // Uint32Array, 3 vertex indices per triangle
  const triCount = tris.length / 3;
  const triMaxEdge = new Float64Array(triCount);
  const edge = (a, b) => Math.hypot(xs[a] - xs[b], zs[a] - zs[b]);
  for (let t = 0; t < triCount; t++) {
    const a = tris[t * 3], b = tris[t * 3 + 1], c = tris[t * 3 + 2];
    triMaxEdge[t] = Math.max(edge(a, b), edge(b, c), edge(c, a));
  }

  return {
    pts,
    xs,
    zs,
    depths,
    tris,
    triMaxEdge,
    minDepth,
    maxDepth,
    extent,
    center: { lat: cLat, lng: cLng },
  };
}

/**
 * Edge-length threshold at the given keep-percentile. Triangles whose longest
 * edge exceeds this are gap-spanners (window dropouts, inter-session gap,
 * concave bays) and should be dropped so the surface only covers the surveyed
 * swath.
 */
export function edgeThreshold(triMaxEdge, keepPct) {
  if (!triMaxEdge || !triMaxEdge.length) return Infinity;
  const sorted = Float64Array.from(triMaxEdge).sort();
  const idx = Math.min(
    sorted.length - 1,
    Math.max(0, Math.round((keepPct / 100) * (sorted.length - 1)))
  );
  return sorted[idx];
}
