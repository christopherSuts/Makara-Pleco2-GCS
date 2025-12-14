"use client";
import SidebarButton from "@/components/ui/SidebarButton";
import YawPitchRollPanel from "@/components/YawPitchRollPanel";
import StatusPanel from "@/components/StatusPanel";
import EchosounderPanel from "@/components/EchosounderPanel";
import ControlsPanel from "@/components/ControlsPanel";
import ConfirmModal from "@/components/ui/ConfirmModal";
import LoadPerimeterModal from "@/components/ui/LoadPerimeterModal";
import LoadBoundaryModal from "@/components/ui/LoadBoundaryModal";
import LoadPathModal from "@/components/ui/LoadPathModal";
import PathParamsModal from "@/components/ui/PathParamsModal";
import PerimeterIsland from "@/components/features/PerimeterIsland";
import LogPanel from "@/components/LogPanel";
import { usePerimeter } from "@/components/features/usePerimeter";
import { useBoundaries } from "@/components/features/useBoundaries";
import { usePath } from "@/components/features/usePath";
import { useState } from "react";
import MapWrapper from "../components/MapWrapper";
import CenterModeToggle from "@/components/CenterModeToggle";
import { useTelemetry } from "@/components/features/useTelemetry";
import { pathToMissionItems } from "@/lib/missionWP";
import { toast } from "react-toastify";

export default function HomePage() {
  const { telemetry, isConnected, send } = useTelemetry();
  const asvPosition = telemetry.GLOBAL_POSITION_INT;
  const perimeter = usePerimeter(asvPosition);
  const boundaries = useBoundaries();
  const path = usePath();

  const [pathParamsOpen, setPathParamsOpen] = useState(false);
  const [pendingOrientation, setPendingOrientation] = useState("TB");

  const boundaryShown = boundaries.shownId !== null;
  const hasPerimeter =
    (perimeter.recordedTrack?.length ?? 0) > 0 ||
    !!perimeter.loadedPerimeterMeta;

  const [pathLoadOpen, setPathLoadOpen] = useState(false);

  const [centerMode, setCenterMode] = useState("free");
  const [gcsPosition, setGcsPosition] = useState(null);

  // HOME state
  const [homePoint, setHomePoint] = useState(null); // {lat,lng} or null
  const [homePickMode, setHomePickMode] = useState(false);

  const sendMissionOverWS = () => {
    if (!path.hasPath) {
      toast.error("No path to send.");
      return;
    }
    const current = path.current ?? {
      type: "asv-path",
      name: "Ad-hoc Path",
      createdAt: new Date().toISOString(),
      points: path.line ?? [],
      params: path.lastParams ?? {},
    };

    const missionItems = pathToMissionItems(current);

    // Send over the same telemetry socket
    send({
      type: "MISSION_UPLOAD",
      payload: {
        name: current.name,
        count: missionItems.length,
        items: missionItems,
      },
    });

    toast("Uploading mission…");
  };

  // Button Handlers
  const handleManual = () => { console.log("Manual"); toast.info("Manual Mode"); };
  const handleAuto = () => { console.log("Auto"); toast.info("Auto Mode"); };
  const handleRTL = () => { console.log("RTL"); toast.info("RTL Mode"); };
  const handleConnect = () => { console.log("Connect"); toast.info("Connect Clicked"); };
  const handleCloud = () => { console.log("Cloud"); toast.info("Cloud Clicked"); };

  // Icons
  const PerimeterIcon = (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
      <path d="M12 2l8 4.5v9L12 20l-8-4.5v-9L12 2z" />
    </svg>
  );

  const BoundaryIcon = (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
      <path d="M3 3h18v18H3z" />
      <path d="M9 9h6v6H9z" />
    </svg>
  );

  const PathIcon = (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
      <polyline points="22 2 13.5 10.5 16 13 4 21" />
      <polyline points="16 13 20 17" />
      <line x1="2" y1="2" x2="22" y2="22" />
    </svg>
  );

  const HomeIcon = (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  );

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-amv-black text-amv-black font-sans">
      
      {/* 1. Map Background Layer (Z-0) */}
      <div className="absolute inset-0 z-0">
         <div className="absolute top-2 left-2 z-[1000]">
           <CenterModeToggle centerMode={centerMode} setCenterMode={setCenterMode} />
         </div>
         <MapWrapper
           asvPosition={asvPosition}
           gcsPosition={gcsPosition}
           setGcsPosition={setGcsPosition}
           centerMode={centerMode}
           pathCoords={perimeter.recordedTrack}
           recordedTrack={perimeter.recordedTrack}
           missionPath={path.line}
           isBoundarySession={boundaries.isSession}
           isBoundaryAdding={boundaries.isAdding}
           boundaryPoints={boundaries.points}
           shownBoundaryPoints={boundaries.shownPoints}
           movingDotId={boundaries.movingId}
           onBoundaryAddPoint={boundaries.addPoint}
           onBoundaryPause={boundaries.pauseAdd}
           onBoundaryRemovePoint={boundaries.remove}
           onBoundaryBeginMovePoint={boundaries.beginMove}
           onBoundaryMovePointTo={boundaries.moveTo}
           onBoundaryEndMovePoint={boundaries.endMove}
           homePoint={homePoint}
           homePickMode={homePickMode}
           onHomePick={(ll) => {
             setHomePickMode(false);
             const lat = Number(ll.lat), lon = Number(ll.lng);
             setHomePoint({ lat, lng: lon });
             send({ type: "SET_HOME", use_current: false, lat, lon, alt: 0 });
           }}
         />
      </div>

      {/* 2. UI Overlay Layer (Z-10, pointer-events-none generally, auto for children) */}
      <div className="absolute inset-0 z-10 pointer-events-none">
        
        {/* Sidebar Left Centered */}
        <aside className="absolute left-0 top-1/2 -translate-y-1/2 pointer-events-auto bg-amv-grey/90 backdrop-blur-md rounded-r-2xl p-2 flex flex-col gap-3 shadow-xl border-y border-r border-white/10">
          <SidebarButton
            label="Perimeter"
            icon={PerimeterIcon}
            menuTitle="Perimeter Controls"
            menu={[
              {
                label: "Record Perimeter",
                onClick: perimeter.start,
                disabled: perimeter.isRecording,
                icon: "⏺"
              },
              { label: "Show Saved", onClick: perimeter.openLoad, icon: "📂" },
              {
                label: "Clear Perimeters",
                onClick: () => perimeter.dontSaveOrClear({ clearSaved: true }),
                disabled: !hasPerimeter,
                icon: "🗑"
              },
            ]}
          />
          <SidebarButton
            label="Boundaries"
            icon={BoundaryIcon}
            menuTitle="Boundary Tools"
            menu={[
              { label: "Create New", onClick: boundaries.start, icon: "✏️" },
              { label: "Load Saved", onClick: boundaries.openLoad, icon: "📂" },
              {
                label: "Clear Shown",
                onClick: boundaries.clearShown,
                disabled: !boundaryShown,
                icon: "❌"
              },
            ]}
          />
          <SidebarButton
            label="Path Generation"
            icon={PathIcon}
            menuTitle="Path Generation"
            menu={[
              {
                label: "Top → Bottom",
                onClick: () => {
                  setPendingOrientation("TB");
                  setPathParamsOpen(true);
                },
                icon: "⬇️"
              },
              {
                label: "Bottom → Top",
                onClick: () => {
                  setPendingOrientation("BT");
                  setPathParamsOpen(true);
                },
                icon: "⬆️"
              },
              {
                label: "Right → Left",
                onClick: () => {
                  setPendingOrientation("RL");
                  setPathParamsOpen(true);
                },
                icon: "⬅️"
              },
              {
                label: "Left → Right",
                onClick: () => {
                  setPendingOrientation("LR");
                  setPathParamsOpen(true);
                },
                icon: "➡️"
              },
              {
                label: "Load Saved Path",
                onClick: () => setPathLoadOpen(true),
                icon: "📂"
              },
              {
                label: "Save Current Path",
                onClick: () => {
                  const b = boundaries.saved?.find(
                    (x) => x.id === boundaries.shownId
                  );
                  path.save({
                    name: undefined,
                    boundary: b || { points: boundaries.shownPoints },
                  });
                },
                disabled: !path.hasPath,
                icon: "💾"
              },
              {
                label: "Clear Shown Path",
                onClick: path.clear,
                disabled: !path.hasPath,
                icon: "❌"
              },
            ]}
          />
          <SidebarButton
            label="Set Home"
            icon={HomeIcon}
            menuTitle="Home Position"
            menu={[
              {
                label: "Use Boat Position",
                onClick: () => {
                  const p = asvPosition?.payload;
                  if (
                    !p ||
                    !Number.isFinite(p.lat) ||
                    !Number.isFinite(p.lon)
                  ) {
                    alert("ASV position not available.");
                    return;
                  }
                  setHomePoint({ lat: p.lat, lng: p.lon });
                  send({
                    type: "SET_HOME",
                    use_current: false,
                    lat: p.lat,
                    lon: p.lon,
                    alt: 0,
                  });
                },
                icon: "📍"
              },
              {
                label: "Pick on Map",
                onClick: () => setHomePickMode(true),
                icon: "point"
              },
            ]}
          />
        </aside>

        {/* Right Area Grid Layout */}
        <div className="absolute right-4 top-4 bottom-4 pointer-events-none grid grid-cols-[360px_240px_240px] grid-rows-2 gap-3">
           {/* Top Row */}
           <div className="col-start-1 row-start-2 min-w-0 h-50 pointer-events-auto self-end">
               <YawPitchRollPanel telemetry={telemetry} />
           </div>
           
           <div className="col-start-2 row-start-1 min-w-0 shadow-lg pointer-events-auto">
               <StatusPanel telemetry={telemetry} />
           </div>
           
           <div className="col-start-3 row-start-1 min-w-0 shadow-lg pointer-events-auto">
               <EchosounderPanel telemetry={telemetry} />
           </div>

           {/* Bottom Row */}
           {/* col-1 empty - transparent to clicks because parent is pointer-events-none and this cell has no child */}
           
           <div className="col-start-2 row-start-2 min-w-0 pointer-events-auto">
               <LogPanel telemetry={telemetry} className="h-full w-full" />
           </div>

           <div className="col-start-3 row-start-2 min-w-0 shrink-0 shadow-lg pointer-events-auto">
               <ControlsPanel 
                onManual={handleManual}
                onAuto={handleAuto}
                onRTL={handleRTL}
                onConnect={handleConnect}
                onCloud={handleCloud}
                onSendWP={sendMissionOverWS}
                hasPath={path.hasPath}
               />
           </div>
        </div>

        {/* Dynamic Island (Perimeter) - Top Center */}
        {perimeter.isRecording && (
          <div className="pointer-events-auto absolute top-4 left-1/2 -translate-x-1/2">
             <PerimeterIsland
                isPaused={perimeter.isPaused}
                onPlay={perimeter.play}
                onPause={perimeter.pause}
                onStop={perimeter.stop}
                onSave={perimeter.save}
                canSave={perimeter.recordedTrack?.length > 1}
              />
          </div>
        )}

        {/* Boundary Island - Top Center */}
        {boundaries.isSession && (
          <div className="pointer-events-auto absolute top-20 left-1/2 -translate-x-1/2 z-40">
             <div className="flex items-center gap-2 rounded-full bg-black/70 text-white border border-[#6B0F2B] px-3 py-1.5 shadow-[0_10px_24px_rgba(107,15,43,0.45)] backdrop-blur">
               <button
                 onClick={boundaries.toggleAdd}
                 className={[
                   "px-3 py-1 rounded-full",
                   "bg-white text-[#1F1F22] border border-[#6B0F2B] shadow-sm",
                   "hover:bg-white/90 active:bg-white/80 transition",
                   boundaries.isAdding ? "ring-2 ring-[#6B0F2B]" : "",
                 ].join(" ")}
               >
                 {boundaries.isAdding ? "Pause" : "Add More Dots"}
               </button>
               <span className="text-xs opacity-80">
                 {boundaries.isAdding
                   ? "Click map to add. Right-click to pause."
                   : "Paused"}
               </span>
               <button
                 onClick={boundaries.stopReq}
                 className="px-3 py-1 rounded-full bg-white text-[#1F1F22] border border-[#6B0F2B] shadow-sm hover:bg-white/90 active:bg-white/80 transition"
               >
                 Stop
               </button>
             </div>
           </div>
        )}
      </div>

      {/* Modals (Z-50) */}
      <div className="relative z-50">
          {perimeter.showStopModal && (
            <ConfirmModal
              title="End Perimeter Recording?"
              onCancel={perimeter.cancel}
              onDont={perimeter.dontSaveOrClear}
              onSave={perimeter.save}
            />
          )}

          {boundaries.showStopModal && (
            <ConfirmModal
              title="End Boundary Definition?"
              onCancel={boundaries.stopCancel}
              onDont={boundaries.stopDont}
              onSave={boundaries.stopSave}
            />
          )}

          {perimeter.showLoadModal && (
            <LoadPerimeterModal
              open
              onClose={perimeter.closeLoad}
              onImport={perimeter.importPerimeterJSON}
            />
          )}
          <LoadBoundaryModal
            open={boundaries.showLoadModal}
            onClose={boundaries.closeLoad}
            onImport={boundaries.importBoundaryJSON}
          />
          <LoadPathModal
            open={pathLoadOpen}
            onClose={() => setPathLoadOpen(false)}
            onImport={(obj) => {
              path.load(obj);
              setPathLoadOpen(false);
            }}
          />
          <PathParamsModal
            open={pathParamsOpen}
            onClose={() => setPathParamsOpen(false)}
            defaults={path.lastParams}
            onSubmit={(rowGapMeters, wpGapMeters) => {
              const b = boundaries.saved?.find(
                (x) => x.id === boundaries.shownId
              );
              path.generate({
                orientation: pendingOrientation,
                rowGapMeters,
                wpGapMeters,
                boundary: b || { points: boundaries.shownPoints },
              });
              setPathParamsOpen(false);
            }}
          />
      </div>
    </div>
  );
}
