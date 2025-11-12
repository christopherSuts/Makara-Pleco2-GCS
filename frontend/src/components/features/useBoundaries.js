import { useState, useCallback, useMemo } from "react";

export function useBoundaries() {
    const [isSession, setIsSession] = useState(false);
    const [isAdding, setIsAdding] = useState(false);
    const [points, setPoints] = useState([]);            // {id,lat,lng,seq}
    const [movingId, setMovingId] = useState(null);
    const [showStopModal, setShowStopModal] = useState(false);

    const [saved, setSaved] = useState([]);              // [{id,name,points}]
    const [shownId, setShownId] = useState(null);
    const [showLoadModal, setShowLoadModal] = useState(false);

    const importBoundaryJSON = (obj) => {
        // normalize to {lat,lng,seq?}
        const pts = (obj.points || [])
            .map((p, i) => ({
            lat: Number(p.lat),
            lng: Number(p.lng),
            seq: Number.isFinite(p.seq) ? p.seq : i + 1,
            }))
            .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));

        if (pts.length < 3) { alert("Boundary needs at least 3 valid points."); return; }

        const id = Date.now();
        const name = obj.name || "Imported boundary";
        setSaved((prev) => [...prev, { id, name, points: pts }]);
        setShownId(id);           // show it immediately
        setShowLoadModal(false);  // close modal
    };

    const shownPoints = useMemo(() => {
        const b = saved.find(b => b.id === shownId);
        return b?.points ?? [];
    }, [saved, shownId]);

    const start = useCallback(() => {
        if (!confirm("Recommended: perimeter survey first. Continue?")) return;
        setIsSession(true); setIsAdding(true); setPoints([]); setMovingId(null); setShownId(null);
    }, []);

    const toggleAdd = useCallback(() => setIsAdding(v => !v), []);
    const stopReq = useCallback(() => setShowStopModal(true), []);
    const stopCancel = useCallback(() => setShowStopModal(false), []);
    const stopDont = useCallback(() => { setIsSession(false); setIsAdding(false); setPoints([]); setMovingId(null); setShowStopModal(false); }, []);
    const stopSave = useCallback(() => {
        if (points.length < 3) { alert("A boundary needs at least 3 points."); return; }
        const id = Date.now(); 
        const name = prompt("Name this boundary:", `Boundary ${saved.length + 1}`) || "Boundary";
        const entry = { id, name, points };
        setSaved(prev => [...prev, entry]);
        setShownId(id);

        const payload = { 
            type: "asv-boundary",
            name,
            createdAt: new Date().toISOString(),
            points: points.map(p => ({ lat: p.lat, lng: p.lng, seq: p.seq })),
        };

        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `boundary_${name.replace(/\s+/g, "_")}_${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
        a.click();
        URL.revokeObjectURL(url);

        setIsSession(false); setIsAdding(false); setPoints([]); setMovingId(null); setShowStopModal(false);
    }, [points, saved.length]);

    const addPoint = useCallback(({ lat, lng }) => setPoints(prev => [...prev, { id: crypto.randomUUID(), lat, lng, seq: prev.length + 1 }]), []);
    const pauseAdd = useCallback(() => setIsAdding(false), []);
    const remove = useCallback((id) => setPoints(prev => prev.filter(p => p.id !== id).map((p, i) => ({ ...p, seq: i + 1 }))), []);
    const beginMove = useCallback((id) => setMovingId(id), []);
    const moveTo = useCallback((id, ll) => setPoints(prev => prev.map(p => p.id === id ? { ...p, lat: ll.lat, lng: ll.lng } : p)), []);
    const endMove = useCallback(() => setMovingId(null), []);

    const openLoad = useCallback(() => {
        // if (!saved.length) { alert("No saved boundaries yet."); return; }
        setShowLoadModal(true);
    }, []);
    const closeLoad = useCallback(() => setShowLoadModal(false), []);
    const selectSavedByIndex = useCallback((idx) => {
    if (!Number.isFinite(idx) || idx < 0 || idx >= saved.length) return;
        setShownId(saved[idx].id);
        setShowLoadModal(false);
    }, [saved]);
    const clearShown = useCallback(() => setShownId(null), []);

    return {
        isSession, isAdding, points, movingId, showStopModal,
        saved, shownId, shownPoints,
        start, toggleAdd, stopReq, stopCancel, stopDont, stopSave,
        addPoint, pauseAdd, remove, beginMove, moveTo, endMove,
        // modal-driven selection
        showLoadModal, openLoad, closeLoad, selectSavedByIndex,
        // legacy clear
        clearShown, importBoundaryJSON
    };
}
