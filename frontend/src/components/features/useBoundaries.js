import { useState, useCallback } from "react";

export function useBoundaries() {
    const [isSession, setIsSession] = useState(false);
    const [isAdding, setIsAdding] = useState(false);
    const [points, setPoints] = useState([]);            // {id,lat,lng,seq}
    const [movingId, setMovingId] = useState(null);
    const [showStopModal, setShowStopModal] = useState(false);

    const [saved, setSaved] = useState([]);              // [{id,name,points}]
    const [shownId, setShownId] = useState(null);

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
        const id = Date.now(); const name = prompt("Name this boundary:", `Boundary ${saved.length + 1}`) || "Boundary";
        setSaved(prev => [...prev, { id, name, points }]); setShownId(id);
        setIsSession(false); setIsAdding(false); setPoints([]); setMovingId(null); setShowStopModal(false);
    }, [points, saved.length]);

    const addPoint = useCallback(({ lat, lng }) => setPoints(prev => [...prev, { id: crypto.randomUUID(), lat, lng, seq: prev.length + 1 }]), []);
    const pauseAdd = useCallback(() => setIsAdding(false), []);
    const remove = useCallback((id) => setPoints(prev => prev.filter(p => p.id !== id).map((p, i) => ({ ...p, seq: i + 1 }))), []);
    const beginMove = useCallback((id) => setMovingId(id), []);
    const moveTo = useCallback((id, ll) => setPoints(prev => prev.map(p => p.id === id ? { ...p, lat: ll.lat, lng: ll.lng } : p)), []);
    const endMove = useCallback(() => setMovingId(null), []);
    const showSaved = useCallback(() => {
        if (!saved.length) { alert("No saved boundaries yet."); return; }
        const idx = Number(prompt(saved.map((b, i) => `${i + 1}. ${b.name}`).join("\n") + "\nEnter number:")) - 1;
        if (!Number.isFinite(idx) || idx < 0 || idx >= saved.length) return;
        setShownId(saved[idx].id);
    }, [saved]);
    const clearShown = useCallback(() => setShownId(null), []);

    return {
        isSession, isAdding, points, movingId, showStopModal, saved, shownId,
        start, toggleAdd, stopReq, stopCancel, stopDont, stopSave,
        addPoint, pauseAdd, remove, beginMove, moveTo, endMove, showSaved, clearShown
    };
}
