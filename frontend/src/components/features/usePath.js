"use client";
import { useState, useCallback } from "react";

export function usePath() {
  const [line, setLine] = useState([]);            // Array<[lat,lng]>
  const [saved, setSaved] = useState([]);          // [{id,name,points}]
  const hasPath = line.length > 1;

  const bboxFromBoundary = useCallback((pts) => {
    if (!pts?.length) return null;
    const lats = pts.map(p=>p.lat), lngs = pts.map(p=>p.lng);
    return { minLat: Math.min(...lats), maxLat: Math.max(...lats), minLng: Math.min(...lngs), maxLng: Math.max(...lngs) };
  }, []);
  function snakeBetween(a, b, stripes = 7) {
    const arr=[]; for (let i=0;i<stripes;i++){ const t0=i/stripes, t1=(i+1)/stripes;
      const p0=[a[0]+(b[0]-a[0])*t0, a[1]+(b[1]-a[1])*t0]; const p1=[a[0]+(b[0]-a[0])*t1, a[1]+(b[1]-a[1])*t1];
      if (i%2===0) arr.push([p0[0],p0[1]],[p0[0],b[1]],[p1[0],b[1]]); else arr.push([p0[0],p0[1]],[p0[0],a[1]],[p1[0],a[1]]);
    } return arr;
  }
  const generate = useCallback((orientation, boundaryPoints) => {
    const bbox = bboxFromBoundary(boundaryPoints);
    if (!bbox) { alert("Create/show a boundary first."); return; }
    const {minLat,maxLat,minLng,maxLng} = bbox; let pts=[];
    if (orientation==="TB"){ const L=[maxLat,minLng], R=[maxLat,maxLng]; pts=snakeBetween(L,R).map(([lat,lng])=>[lat-(maxLat-minLat),lng]); }
    if (orientation==="BT"){ const L=[minLat,minLng], R=[minLat,maxLng]; pts=snakeBetween(L,R).map(([lat,lng])=>[lat+(maxLat-minLat),lng]); }
    if (orientation==="RL"){ const T=[maxLat,maxLng], B=[minLat,maxLng]; const raw=snakeBetween(T,B); pts=raw.map(([lat,lng])=>[lat,lng-(maxLng-minLng)]); }
    if (orientation==="LR"){ const T=[maxLat,minLng], B=[minLat,minLng]; const raw=snakeBetween(T,B); pts=raw.map(([lat,lng])=>[lat,lng+(maxLng-minLng)]); }
    setLine(pts);
  }, [bboxFromBoundary]);
  const save = useCallback(() => { if (line.length<2) return;
    const id=Date.now(); const name = prompt("Name this path:", `Path ${saved.length+1}`) || "Path";
    setSaved(prev=>[{id,name,points:line},...prev]); }, [line, saved.length]);
  const load = useCallback(() => {
    if (!saved.length){ alert("No saved paths yet."); return; }
    const idx=Number(prompt(saved.map((p,i)=>`${i+1}. ${p.name}`).join("\n")+"\nEnter number:"))-1;
    if (!Number.isFinite(idx) || idx<0 || idx>=saved.length) return; setLine(saved[idx].points);
  }, [saved]);
  const clear = useCallback(()=>setLine([]), []);

  return { line, saved, hasPath, generate, save, load, clear };
}
