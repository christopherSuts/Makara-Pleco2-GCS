"use client";
import { useState, useRef, useEffect } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { computeTin, edgeThreshold } from "@/lib/bathyTin";
import { depthToRgb } from "@/lib/depthColor";

/**
 * BathymetryModal — 3D survey surface viewer.
 *
 * Data sources (first match wins):
 *   1. `points` prop            → review mode (CSV loaded client-side)
 *   2. "Mock Data" button       → synthetic demo
 *   3. telemetry.PATH_LOG_DATA  → live mode (path logs fetched from middleware)
 * Each point is { lat, lon, depth_m }.
 *
 * Surface method: Delaunay (TIN) linear interpolation of the actual soundings,
 * with per-triangle edge-length culling so the mesh only covers the surveyed
 * swath — triangles that would bridge a data gap (a window dropout, the 8-min
 * inter-session gap, or a concave bay) have long edges and are removed. This is
 * the in-browser equivalent of clipping to a track buffer: no seabed is drawn
 * where the boat never went, and nothing is extrapolated beyond the soundings.
 *
 * Perf: this component is meant to be lazy-loaded (next/dynamic, ssr:false) and
 * only mounted while open, so three.js + delaunator stay out of the initial
 * page bundle. The renderer/scene are built once per dataset; moving the
 * exaggeration/coverage sliders only rebuilds the mesh geometry, not the WebGL
 * context.
 */
export default function BathymetryModal({
  open,
  onClose,
  handleGetPathLogList,
  handleGetPathLog,
  telemetry,
  points = null,
  title = "3D Bathymetry Viz",
  minConfidence = 0,
  onMinConfidenceChange,
  confidenceRange = [0, 100],
}) {
  const canvasContainerRef = useRef(null);
  const requestRef = useRef(null);
  const rendererRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const controlsRef = useRef(null);
  const surfaceMeshRef = useRef(null);
  const rawPointsRef = useRef(null);  // THREE.Points overlay object
  const rawInputRef = useRef(null);   // all input soundings (with confidence)
  const tinRef = useRef(null);        // cached TIN for the current confidence threshold
  const tinConfRef = useRef(null);    // confidence threshold the cached TIN was built at
  const extentRef = useRef(1);        // full-data extent (stable framing/grid)
  const buildSurfaceRef = useRef(null);
  const framedRef = useRef(false);

  const [dataLoaded, setDataLoaded] = useState(false);
  const [selectedLog, setSelectedLog] = useState("");
  const [mockPoints, setMockPoints] = useState(null);

  // Visualization params (data-driven surface controls)
  const [verticalExaggeration, setVerticalExaggeration] = useState(3);
  const [coverageKeepPct, setCoverageKeepPct] = useState(90); // keep triangles up to this edge-length percentile
  const exagRef = useRef(3);
  const keepRef = useRef(90);
  const confRef = useRef(minConfidence);
  useEffect(() => { exagRef.current = verticalExaggeration; }, [verticalExaggeration]);
  useEffect(() => { keepRef.current = coverageKeepPct; }, [coverageKeepPct]);
  useEffect(() => { confRef.current = minConfidence; }, [minConfidence]);

  const reviewMode = Array.isArray(points);

  // 1. Fetch the list of logs when the modal opens (live mode only)
  useEffect(() => {
    if (open) {
      if (!reviewMode) handleGetPathLogList?.();
    } else {
      setDataLoaded(false);
      setSelectedLog("");
      framedRef.current = false;
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // 2. Build/rebuild the scene when the source data changes
  useEffect(() => {
    const pointArray =
      points || mockPoints || telemetry?.["PATH_LOG_DATA"]?.pathData;

    if (open && pointArray && pointArray.length > 0) {
      framedRef.current = false;
      initScene(pointArray);
      setDataLoaded(true);
    }

    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
      if (rendererRef.current) {
        rendererRef.current.dispose();
        rendererRef.current.forceContextLoss();
        rendererRef.current = null;
      }
      sceneRef.current = null;
      surfaceMeshRef.current = null;
      rawPointsRef.current = null;
      rawInputRef.current = null;
      tinRef.current = null;
      tinConfRef.current = null;
      buildSurfaceRef.current = null;
      if (canvasContainerRef.current) canvasContainerRef.current.innerHTML = "";
    };
  }, [points, mockPoints, telemetry?.["PATH_LOG_DATA"]?.pathData, open]); // eslint-disable-line react-hooks/exhaustive-deps

  // 3. Slider changes → rebuild only the mesh geometry (cheap), not the context
  useEffect(() => {
    if (buildSurfaceRef.current) buildSurfaceRef.current();
  }, [verticalExaggeration, coverageKeepPct, minConfidence]);

  const handleLogSelect = (e) => {
    const fileName = e.target.value;
    setSelectedLog(fileName);
    if (fileName) {
      setDataLoaded(false);
      handleGetPathLog?.(fileName);
    }
  };

  function generateMockBathymetry() {
    const points = [];
    const baseLat = 37.7749;
    const baseLon = -122.4194;
    const rows = 60;
    const cols = 60;
    const pitRow = rows * 0.55;
    const pitCol = cols * 0.45;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const lat = baseLat + r * 0.00002;
        const lon = baseLon + c * 0.00002;
        const slope = r * 0.06;
        const waves = Math.sin(r * 0.25) * 1.2 + Math.cos(c * 0.18) * 1.0;
        const distSq = Math.pow(r - pitRow, 2) + Math.pow(c - pitCol, 2);
        const pitDepth = Math.exp(-distSq / 180) * 8;
        const noise = (Math.random() - 0.5) * 0.3;
        const depth = 4 + slope + waves + pitDepth + noise;
        points.push({ lat, lon, depth_m: depth });
      }
    }
    return points;
  }

  /** Filter by confidence → (re)interpolate → rebuild the surface + points. */
  function buildSurface() {
    const scene = sceneRef.current;
    if (!scene || !rawInputRef.current) return;

    // Recompute the TIN only when the confidence threshold changed. Exaggeration
    // and coverage don't alter the point set, so they reuse the cached TIN.
    const conf = confRef.current;
    if (tinConfRef.current !== conf || !tinRef.current) {
      const accepted = rawInputRef.current.filter((p) => {
        const c = Number(p.depth_confidence ?? p.conf ?? p.confidence);
        return !Number.isFinite(c) || c >= conf; // missing confidence passes
      });
      tinRef.current = computeTin(accepted);
      tinConfRef.current = conf;
    }
    const tin = tinRef.current;

    // Too few accepted soundings to form a surface → clear it.
    if (!tin) {
      if (surfaceMeshRef.current) {
        scene.remove(surfaceMeshRef.current);
        surfaceMeshRef.current.geometry.dispose();
        surfaceMeshRef.current = null;
      }
      if (rawPointsRef.current) {
        scene.remove(rawPointsRef.current);
        rawPointsRef.current.geometry.dispose();
        rawPointsRef.current = null;
      }
      return;
    }

    const { xs, zs, depths, tris, triMaxEdge, minDepth, maxDepth } = tin;
    const n = xs.length;
    const exag = exagRef.current;
    const span = maxDepth - minDepth || 1; // used for camera framing

    // Edge-length cull threshold = keep triangles up to this percentile.
    const threshold = edgeThreshold(triMaxEdge, keepRef.current);

    // Vertices + per-vertex depth color (dynamic: red = min → green = max)
    const positions = new Float32Array(n * 3);
    const colors = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      positions[i * 3] = xs[i];
      positions[i * 3 + 1] = -depths[i] * exag;
      positions[i * 3 + 2] = zs[i];
      const { r, g, b } = depthToRgb(depths[i], minDepth, maxDepth);
      colors[i * 3] = r / 255;
      colors[i * 3 + 1] = g / 255;
      colors[i * 3 + 2] = b / 255;
    }

    // Keep only triangles within the surveyed swath (short edges)
    const index = [];
    for (let t = 0; t < triMaxEdge.length; t++) {
      if (triMaxEdge[t] <= threshold) {
        index.push(tris[t * 3], tris[t * 3 + 1], tris[t * 3 + 2]);
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    geo.setIndex(index);
    geo.computeVertexNormals();

    // Swap surface mesh
    if (surfaceMeshRef.current) {
      scene.remove(surfaceMeshRef.current);
      surfaceMeshRef.current.geometry.dispose();
    }
    const mat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      side: THREE.DoubleSide,
      flatShading: true,
    });
    const mesh = new THREE.Mesh(geo, mat);
    scene.add(mesh);
    surfaceMeshRef.current = mesh;

    // Swap raw sounding points overlay (sits just above the surface)
    if (rawPointsRef.current) {
      scene.remove(rawPointsRef.current);
      rawPointsRef.current.geometry.dispose();
    }
    const rawGeo = new THREE.BufferGeometry();
    const rawVerts = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      rawVerts[i * 3] = xs[i];
      rawVerts[i * 3 + 1] = -depths[i] * exag + 0.05;
      rawVerts[i * 3 + 2] = zs[i];
    }
    rawGeo.setAttribute("position", new THREE.BufferAttribute(rawVerts, 3));
    const rawMat = new THREE.PointsMaterial({
      color: 0xffffff,
      size: Math.max(0.5, extentRef.current / 300),
    });
    const rawPts = new THREE.Points(rawGeo, rawMat);
    scene.add(rawPts);
    rawPointsRef.current = rawPts;

    // Frame the camera once per dataset
    if (!framedRef.current && cameraRef.current && controlsRef.current) {
      const midY = (-(minDepth + maxDepth) / 2) * exag;
      const ext = extentRef.current;
      cameraRef.current.position.set(ext * 0.7, span * exag + ext * 0.5 + 10, ext * 0.7);
      controlsRef.current.target.set(0, midY, 0);
      controlsRef.current.update();
      framedRef.current = true;
    }
  }

  /** One-time scene setup + projection + Delaunay; then build the surface. */
  const initScene = (rawPoints) => {
    if (!canvasContainerRef.current) return;

    // --- interpolate: shared Delaunay TIN (projected metres + per-tri edges) ---
    // Store the full input; the actual mesh TIN is (re)built in buildSurface from
    // the confidence-filtered subset. A full-data TIN here fixes a stable extent
    // so grid/camera framing don't jump as the confidence threshold changes.
    rawInputRef.current = rawPoints;
    tinRef.current = null;
    tinConfRef.current = null;
    const fullTin = computeTin(rawPoints);
    if (!fullTin) return;
    extentRef.current = fullTin.extent;
    const extent = fullTin.extent;

    // --- scene / renderer (once per dataset) ---
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a1a);
    scene.add(new THREE.AmbientLight(0xffffff, 0.5));
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(100, 200, 50);
    scene.add(dirLight);

    const width = canvasContainerRef.current.clientWidth;
    const height = canvasContainerRef.current.clientHeight;
    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 100000);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

    canvasContainerRef.current.innerHTML = "";
    canvasContainerRef.current.appendChild(renderer.domElement);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.listenToKeyEvents(canvasContainerRef.current);
    canvasContainerRef.current.focus();

    const gridSize = Math.ceil((extent * 2) / 10) * 10;
    scene.add(new THREE.GridHelper(gridSize, 20, 0x444444, 0x333333));
    scene.add(new THREE.AxesHelper(Math.max(5, extent * 0.1)));

    rendererRef.current = renderer;
    sceneRef.current = scene;
    cameraRef.current = camera;
    controlsRef.current = controls;
    buildSurfaceRef.current = buildSurface;

    buildSurface();

    const animate = () => {
      requestRef.current = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();
  };

  if (!open) return null;

  const logsList = telemetry?.["PATH_LOGS_LIST"]?.logs || [];

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="relative w-[80vw] h-[80vh] bg-amv-grey rounded-xl overflow-hidden shadow-2xl border border-white/10 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-white/10 flex justify-between items-center bg-black/20 z-10">
          <h2 className="text-white font-bold text-lg">{title}</h2>
          <div className="flex gap-4 items-center">
            {!reviewMode && (
              <>
                <button
                  onClick={() => {
                    setMockPoints(generateMockBathymetry());
                    setDataLoaded(false);
                  }}
                  className="bg-[#6B0F2B] hover:bg-[#8c1438] text-white text-xs px-3 py-1 rounded"
                >
                  Mock Data
                </button>
                <select
                  value={selectedLog}
                  onChange={handleLogSelect}
                  className="bg-[#1F1F22] text-white border border-white/20 rounded px-3 py-1.5 text-sm focus:outline-none focus:border-[#6B0F2B]"
                >
                  <option value="">-- Select a log file --</option>
                  {logsList.map((logName, idx) => (
                    <option key={idx} value={logName}>
                      {logName}
                    </option>
                  ))}
                </select>
              </>
            )}
            <button onClick={onClose} className="text-white/60 hover:text-white">
              ✕
            </button>
          </div>
        </div>

        {/* Wrapper Container */}
        <div className="flex-1 w-full bg-black relative">
          {/* React-Managed UI Overlay */}
          <div className="absolute inset-0 z-10 pointer-events-none flex items-center justify-center">
            {!dataLoaded && !reviewMode && selectedLog === "" && (
              <div className="text-white/30">Select a log file to visualize</div>
            )}
            {!dataLoaded && !reviewMode && selectedLog !== "" && (
              <div className="text-white/30">Building TIN surface…</div>
            )}
            {!dataLoaded && reviewMode && (
              <div className="text-white/30">Building TIN surface…</div>
            )}
          </div>

          {/* Controls: vertical exaggeration + coverage tightness */}
          {dataLoaded && (
            <div className="absolute bottom-3 left-3 z-10 rounded-xl bg-black/60 backdrop-blur border border-white/10 px-3 py-2 text-[11px] text-white/80 space-y-2 w-56">
              <label className="block">
                <div className="flex justify-between">
                  <span>Vertical exaggeration</span>
                  <span className="font-mono text-white">{verticalExaggeration}×</span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={10}
                  step={1}
                  value={verticalExaggeration}
                  onChange={(e) => setVerticalExaggeration(Number(e.target.value))}
                  className="w-full accent-[#6B0F2B] cursor-pointer"
                />
              </label>
              <label className="block">
                <div className="flex justify-between">
                  <span>Coverage (edge keep)</span>
                  <span className="font-mono text-white">{coverageKeepPct}%</span>
                </div>
                <input
                  type="range"
                  min={50}
                  max={100}
                  step={1}
                  value={coverageKeepPct}
                  onChange={(e) => setCoverageKeepPct(Number(e.target.value))}
                  className="w-full accent-[#6B0F2B] cursor-pointer"
                />
                <div className="text-white/40 text-[10px] mt-0.5">
                  Lower = tighter to track (culls gap-spanning triangles)
                </div>
              </label>
              <label className="block">
                <div className="flex justify-between">
                  <span>Min confidence</span>
                  <span className="font-mono text-white">{minConfidence}%</span>
                </div>
                <input
                  type="range"
                  min={Math.floor(confidenceRange[0])}
                  max={100}
                  step={1}
                  value={minConfidence}
                  onChange={(e) => onMinConfidenceChange?.(Number(e.target.value))}
                  className="w-full accent-[#6B0F2B] cursor-pointer"
                />
                <div className="text-white/40 text-[10px] mt-0.5">
                  Higher = stricter (drops low-confidence soundings)
                </div>
              </label>
            </div>
          )}

          {/* ThreeJS-Managed Canvas Container */}
          <div
            ref={canvasContainerRef}
            tabIndex={0}
            onKeyDown={(e) => e.stopPropagation()}
            className="absolute inset-0 z-0"
          />
        </div>
      </div>
    </div>
  );
}
