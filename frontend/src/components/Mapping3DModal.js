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

    // --- COLOR MAPPING UTILITY ---
    // Classic Heatmap/Bathymetry Scale: Red (Shallow) -> Yellow -> Cyan -> Deep Blue
    const bathymetryPalette = [
        new THREE.Color(0xd73027), // Shallowest: Red
        new THREE.Color(0xfdae61), // Orange
        //new THREE.Color(0xfee090), // Yellow
        //new THREE.Color(0xe0f3f8), // Light Cyan
        //new THREE.Color(0xabd9e9), // Light Blue
        //new THREE.Color(0x74add1), // Medium Blue
        new THREE.Color(0x4575b4), // Deep Blue
        new THREE.Color(0x313695)  // Deepest: Dark Blue
    ];

    const getDepthColor = (normDepth) => {
        const t = Math.max(0, Math.min(1, normDepth));
        const segments = bathymetryPalette.length - 1;
        const scaled = t * segments;
        const index = Math.floor(scaled);
        const fraction = scaled - index;

        // If exactly at max depth, return the last color
        if (index >= segments) return bathymetryPalette[segments].clone();

        // Smoothly blend between the two nearest colors
        const color = bathymetryPalette[index].clone();
        color.lerp(bathymetryPalette[index + 1], fraction);
        return color;
    };


    // 3. Initialize Three.js with Turf IDW & Geodesy Projection
    const initThreeJS = (points) => {
        if (!canvasContainerRef.current) return;

        // --- DATA PROCESSING (Turf) ---
        const features = points.map(p => turf.point([p.lon, p.lat], { depth: p.depth_m }));
        const pointsFC = turf.featureCollection(features);

        const bbox = turf.bbox(pointsFC);
        const diagDist = turf.distance(turf.point([bbox[0], bbox[1]]), turf.point([bbox[2], bbox[3]]), { units: 'kilometers' });
        const cellSize = Math.max(diagDist / 50, 0.0005);

        const grid = turf.interpolate(pointsFC, cellSize, {
            gridType: 'point',
            property: 'depth',
            units: 'kilometers',
            weight: 2
        });

        const sortedGrid = grid.features.sort((a, b) => {
            const latDiff = b.geometry.coordinates[1] - a.geometry.coordinates[1];
            if (Math.abs(latDiff) > 1e-8) return latDiff;
            return a.geometry.coordinates[0] - b.geometry.coordinates[0];
        });

        const topLat = sortedGrid[0].geometry.coordinates[1];
        let cols = 0;
        for (let i = 0; i < sortedGrid.length; i++) {
            if (Math.abs(sortedGrid[i].geometry.coordinates[1] - topLat) < 1e-8) cols++;
            else break;
        }
        const rows = Math.floor(sortedGrid.length / cols);

        // --- SCENE SETUP (ThreeJS) ---
        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x1a1a1a); // Slightly darker background to make colors pop

        scene.add(new THREE.AmbientLight(0xffffff, 0.5));
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
        controls.listenToKeyEvents(canvasContainerRef.current);

        canvasContainerRef.current.focus();

        // --- GEOMETRY GENERATION (Geodesy) ---
        const centerLon = (bbox[0] + bbox[2]) / 2;
        const centerLat = (bbox[1] + bbox[3]) / 2;
        const origin = new LatLon(centerLat, centerLon);

        const surfaceGeo = new THREE.BufferGeometry();
        const vertices = new Float32Array(rows * cols * 3);
        const colors = new Float32Array(rows * cols * 3);

        // Use max value, fallback to 0.001 to prevent division by zero errors
        const maxDepth = Math.max(...sortedGrid.map(f => f.properties.depth), 0.001);
        const minDepth = Math.max(...sortedGrid.map(f => f.properties.depth), 0.001);

        for (let i = 0; i < rows * cols; i++) {
            const feat = sortedGrid[i];
            const pt = new LatLon(feat.geometry.coordinates[1], feat.geometry.coordinates[0]);

            const dist = origin.distanceTo(pt);
            const brng = origin.initialBearingTo(pt);

            const x = dist * Math.sin(brng * Math.PI / 180);
            const z = -dist * Math.cos(brng * Math.PI / 180);
            const y = -feat.properties.depth;

            vertices[i * 3] = x;
            vertices[i * 3 + 1] = y;
            vertices[i * 3 + 2] = z;

            // Apply new bathymetry color logic
            const normDepth = Math.min(Math.max(feat.properties.depth / maxDepth, 0), 1);
            const pointColor = getDepthColor(normDepth);
            colors[i * 3] = pointColor.r;
            colors[i * 3 + 1] = pointColor.g;
            colors[i * 3 + 2] = pointColor.b;
        }

        surfaceGeo.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
        surfaceGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

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
        surfaceGeo.computeVertexNormals();

        const surfaceMat = new THREE.MeshStandardMaterial({
            vertexColors: true,
            side: THREE.DoubleSide,
            flatShading: true // Gives that cool low-poly topographic look
        });
        const surfaceMesh = new THREE.Mesh(surfaceGeo, surfaceMat);
        scene.add(surfaceMesh);

        // Render raw ASV track data
        const rawGeo = new THREE.BufferGeometry();
        const rawVerts = [];
        points.forEach(p => {
            const pt = new LatLon(p.lat, p.lon);
            const dist = origin.distanceTo(pt);
            const brng = origin.initialBearingTo(pt);
            const x = dist * Math.sin(brng * Math.PI / 180);
            const z = -dist * Math.cos(brng * Math.PI / 180);
            const y = -p.depth_m;
            rawVerts.push(x, y + 0.05, z);
        });
        rawGeo.setAttribute('position', new THREE.Float32BufferAttribute(rawVerts, 3));
        const rawMat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.5 });
        scene.add(new THREE.Points(rawGeo, rawMat));

        scene.add(new THREE.GridHelper(100, 10));
        scene.add(new THREE.AxesHelper(5));

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
                    <div ref={canvasContainerRef} tabIndex={0} onKeyDown={(e) => e.stopPropagation()} className="absolute inset-0 z-0" />
                </div>
            </div>
        </div>
    );
}
