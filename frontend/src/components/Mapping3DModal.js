"use client";
import { useState, useRef, useEffect } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import * as turf from "@turf/turf";
import LatLon from "geodesy/latlon-spherical.js";

export default function BathymetryModal({ open, onClose, handleGetPathLogList, handleGetPathLog, telemetry }) {
    const canvasContainerRef = useRef(null);
    const requestRef = useRef(null);
    const rendererRef = useRef(null);

    const [dataLoaded, setDataLoaded] = useState(false);
    const [selectedLog, setSelectedLog] = useState("");

    // 1. Fetch the list of logs when the modal opens
    useEffect(() => {
        if (open) {
            handleGetPathLogList();
        } else {
            setDataLoaded(false);
            setSelectedLog("");
        }
    }, [open]);

    // 2. Watch for incoming path log data to render
    useEffect(() => {
        const pointArray = telemetry["PATH_LOG_DATA"]?.pathData;

        if (open && pointArray && pointArray.length > 0) {
            initThreeJS(pointArray);
            setDataLoaded(true);
        }

        // Garbage collection
        return () => {
            if (requestRef.current) cancelAnimationFrame(requestRef.current);
            if (rendererRef.current) {
                rendererRef.current.dispose();
                rendererRef.current.forceContextLoss();
                rendererRef.current = null;
            }
            if (canvasContainerRef.current) canvasContainerRef.current.innerHTML = "";
        };
    }, [telemetry["PATH_LOG_DATA"]?.pathData, open]);

    const handleLogSelect = (e) => {
        const fileName = e.target.value;
        setSelectedLog(fileName);

        if (fileName) {
            setDataLoaded(false);
            handleGetPathLog(fileName);
        }
    };

    // 3. Initialize Three.js with Turf IDW & Geodesy Projection
    const initThreeJS = (points) => {
        if (!canvasContainerRef.current) return;

        // --- DATA PROCESSING (Turf) ---
        // Format raw data into Turf points
        const features = points.map(p => turf.point([p.lon, p.lat], { depth: p.depth_m }));
        const pointsFC = turf.featureCollection(features);

        // Dynamically calculate an optimal cell size based on the bounding box (target ~50x50 grid)
        const bbox = turf.bbox(pointsFC);
        const diagDist = turf.distance(turf.point([bbox[0], bbox[1]]), turf.point([bbox[2], bbox[3]]), { units: 'kilometers' });
        const cellSize = Math.max(diagDist / 50, 0.0005); // min 0.5 meters resolution

        // Run Inverse Distance Weighting interpolation
        const grid = turf.interpolate(pointsFC, cellSize, {
            gridType: 'point',
            property: 'depth',
            units: 'kilometers',
            weight: 2 // standard IDW exponent
        });

        // Turf outputs a flat array. To build a 3D surface mesh, we must sort it into perfect rows and columns.
        const sortedGrid = grid.features.sort((a, b) => {
            const latDiff = b.geometry.coordinates[1] - a.geometry.coordinates[1]; // Descending Lat (Top to Bottom)
            if (Math.abs(latDiff) > 1e-8) return latDiff;
            return a.geometry.coordinates[0] - b.geometry.coordinates[0]; // Ascending Lon (Left to Right)
        });

        // Determine grid dimensions
        const topLat = sortedGrid[0].geometry.coordinates[1];
        let cols = 0;
        for (let i = 0; i < sortedGrid.length; i++) {
            if (Math.abs(sortedGrid[i].geometry.coordinates[1] - topLat) < 1e-8) cols++;
            else break;
        }
        const rows = Math.floor(sortedGrid.length / cols);


        // --- SCENE SETUP (ThreeJS) ---
        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x222222);

        // Add lights so the 3D surface topography creates shadows/highlights
        scene.add(new THREE.AmbientLight(0xffffff, 0.4));
        const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
        dirLight.position.set(100, 200, 50);
        scene.add(dirLight);

        const width = canvasContainerRef.current.clientWidth;
        const height = canvasContainerRef.current.clientHeight;

        const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 10000);
        const renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(width, height);
        rendererRef.current = renderer;

        canvasContainerRef.current.innerHTML = "";
        canvasContainerRef.current.appendChild(renderer.domElement);
        const controls = new OrbitControls(camera, renderer.domElement);

        // --- GEOMETRY GENERATION (Geodesy) ---
        // Set an origin point to calculate local X,Y,Z offsets in meters
        const centerLon = (bbox[0] + bbox[2]) / 2;
        const centerLat = (bbox[1] + bbox[3]) / 2;
        const origin = new LatLon(centerLat, centerLon);

        const surfaceGeo = new THREE.BufferGeometry();
        const vertices = new Float32Array(rows * cols * 3);
        const colors = new Float32Array(rows * cols * 3);
        const colorObj = new THREE.Color();
        const maxDepth = Math.max(...sortedGrid.map(f => f.properties.depth));
        const minDepth = Math.min(...sortedGrid.map(f => f.properties.depth));

        // Map every grid point to local Cartesian coordinates
        for (let i = 0; i < rows * cols; i++) {
            const feat = sortedGrid[i];
            const pt = new LatLon(feat.geometry.coordinates[1], feat.geometry.coordinates[0]);

            const dist = origin.distanceTo(pt); // meters
            const brng = origin.initialBearingTo(pt); // degrees

            // Convert to Cartesian (East = X, North = -Z in Three.js)
            const x = dist * Math.sin(brng * Math.PI / 180);
            const z = -dist * Math.cos(brng * Math.PI / 180);
            const y = -feat.properties.depth; // Depth goes down

            vertices[i * 3] = x;
            vertices[i * 3 + 1] = y;
            vertices[i * 3 + 2] = z;

            // Gradient coloring based on depth
            const normDepth = Math.min(Math.max(feat.properties.depth / maxDepth, 0), 1);
            colorObj.setHSL(0.6, 1.0, 0.5 - (normDepth * 0.4));
            colors[i * 3] = colorObj.r;
            colors[i * 3 + 1] = colorObj.g;
            colors[i * 3 + 2] = colorObj.b;
        }

        surfaceGeo.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
        surfaceGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

        // Stitch the grid points together into solid triangles
        const indices = [];
        for (let r = 0; r < rows - 1; r++) {
            for (let c = 0; c < cols - 1; c++) {
                const a = r * cols + c;
                const b = r * cols + (c + 1);
                const d = (r + 1) * cols + c;
                const e = (r + 1) * cols + (c + 1);
                indices.push(a, b, d);
                indices.push(b, e, d);
            }
        }
        surfaceGeo.setIndex(indices);
        surfaceGeo.computeVertexNormals(); // Crucial for lighting to interact with the surface

        // Render the interpolated surface
        const surfaceMat = new THREE.MeshStandardMaterial({
            vertexColors: true,
            side: THREE.DoubleSide,
            flatShading: true // Set to false for a smooth look, true for a faceted geometric look
        });
        const surfaceMesh = new THREE.Mesh(surfaceGeo, surfaceMat);
        scene.add(surfaceMesh);

        // Optional: Render the raw ASV track data on top as white dots to verify interpolation
        const rawGeo = new THREE.BufferGeometry();
        const rawVerts = [];
        points.forEach(p => {
            const pt = new LatLon(p.lat, p.lon);
            const dist = origin.distanceTo(pt);
            const brng = origin.initialBearingTo(pt);
            const x = dist * Math.sin(brng * Math.PI / 180);
            const z = -dist * Math.cos(brng * Math.PI / 180);
            const y = -p.depth_m;
            rawVerts.push(x, y + 0.05, z); // slight offset up to avoid Z-fighting with the surface
        });
        rawGeo.setAttribute('position', new THREE.Float32BufferAttribute(rawVerts, 3));
        const rawMat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.5 });
        scene.add(new THREE.Points(rawGeo, rawMat));

        // Setup environment guides
        scene.add(new THREE.GridHelper(100, 10));
        scene.add(new THREE.AxesHelper(5));

        // Auto-position the camera diagonally above the surface
        camera.position.set(50, Math.max(maxDepth + 20, 40), 50);
        controls.target.set(0, -(maxDepth + minDepth) / 2, 0);
        controls.update();

        const animate = () => {
            requestRef.current = requestAnimationFrame(animate);
            controls.update();
            renderer.render(scene, camera);
        };
        animate();
    };

    if (!open) return null;

    const logsList = telemetry["PATH_LOGS_LIST"]?.logs || [];

    return (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="relative w-[80vw] h-[80vh] bg-amv-grey rounded-xl overflow-hidden shadow-2xl border border-white/10 flex flex-col">

                {/* Header */}
                <div className="p-4 border-b border-white/10 flex justify-between items-center bg-black/20 z-10">
                    <h2 className="text-white font-bold text-lg">3D Bathymetry Viz</h2>
                    <div className="flex gap-4 items-center">
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
                        <button onClick={onClose} className="text-white/60 hover:text-white">✕</button>
                    </div>
                </div>

                {/* Wrapper Container */}
                <div className="flex-1 w-full bg-black relative">
                    {/* React-Managed UI Overlay */}
                    <div className="absolute inset-0 z-10 pointer-events-none flex items-center justify-center">
                        {!dataLoaded && selectedLog === "" && (
                            <div className="text-white/30">Select a log file to visualize</div>
                        )}
                        {!dataLoaded && selectedLog !== "" && (
                            <div className="text-white/30">Interpolating Point Cloud...</div>
                        )}
                    </div>

                    {/* ThreeJS-Managed Canvas Container */}
                    <div ref={canvasContainerRef} className="absolute inset-0 z-0" />
                </div>
            </div>
        </div>
    );
}
