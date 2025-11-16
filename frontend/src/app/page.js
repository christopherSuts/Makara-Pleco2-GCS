"use client";
import SidebarButton from "@/components/ui/SidebarButton";
import YawPitchRollPanel from "@/components/YawPitchRollPanel";
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

  return (
    <div className="h-screen flex flex-col bg-amv-black text-amv-white">
      {/* Header (dark grey) */}
      <header className="flex items-center justify-between px-5 py-3 bg-amv-black">
        <h1 className="font-bold text-xl">AMV • GCS</h1>
        <button className="text-2xl hover:text-amv-plum transition">☰</button>
      </header>

      <div className="flex flex-1 gap-1 p-1 overflow-visible bg-amv-black">
        {/* Sidebar (dark grey) */}
        <aside className="w-16 bg-amv-grey flex flex-col items-center gap-3 py-3">
          <SidebarButton
            label="Perimeter"
            menuTitle="Perimeter"
            menu={[
              {
                label: "Record Perimeter",
                onClick: perimeter.start,
                disabled: perimeter.isRecording,
              },
              { label: "Show Saved Perimeters", onClick: perimeter.openLoad },
              {
                label: "Clear Perimeters",
                onClick: () => perimeter.dontSaveOrClear({ clearSaved: true }),
                disabled: !hasPerimeter,
              },
            ]}
          >
            Perim
          </SidebarButton>
          <SidebarButton
            label="Boundaries"
            menuTitle="Boundaries"
            menu={[
              { label: "Create Boundaries", onClick: boundaries.start },
              { label: "Show Saved Boundaries", onClick: boundaries.openLoad },
              {
                label: "Clear Shown Boundaries",
                onClick: boundaries.clearShown,
                disabled: !boundaryShown,
              },
            ]}
          >
            Bound
          </SidebarButton>
          <SidebarButton
            label="Path"
            menuTitle="Path"
            menu={[
              // { label: "Generate: Top → Bottom", onClick: () => path.generate("TB", boundaries.points) },
              // { label: "Generate: Bottom → Top", onClick: () => path.generate("BT", boundaries.points) },
              // { label: "Generate: Right → Left", onClick: () => path.generate("RL", boundaries.points) },
              // { label: "Generate: Left → Right", onClick: () => path.generate("LR", boundaries.points) },
              // { label: "Load Saved Path", onClick: path.load },
              // { label: "Save Current Path", onClick: path.save, disabled: !path.hasPath },

              {
                label: "Generate: Top → Bottom",
                onClick: () => {
                  setPendingOrientation("TB");
                  setPathParamsOpen(true);
                },
              },
              {
                label: "Generate: Bottom → Top",
                onClick: () => {
                  setPendingOrientation("BT");
                  setPathParamsOpen(true);
                },
              },
              {
                label: "Generate: Right → Left",
                onClick: () => {
                  setPendingOrientation("RL");
                  setPathParamsOpen(true);
                },
              },
              {
                label: "Generate: Left → Right",
                onClick: () => {
                  setPendingOrientation("LR");
                  setPathParamsOpen(true);
                },
              },
              {
                label: "Load Saved Path",
                onClick: () => setPathLoadOpen(true),
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
              },
              {
                label: "Clear Shown Path",
                onClick: path.clear,
                disabled: !path.hasPath,
              },
            ]}
          >
            Path
          </SidebarButton>
          <SidebarButton
            label="Set Home"
            menuTitle="Set Home"
            menu={[
              {
                label: "Use Current Boat Position",
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
                  // 1) set marker
                  setHomePoint({ lat: p.lat, lng: p.lon });
                  // 2) send to Pixhawk via WS
                  send({
                    type: "SET_HOME",
                    use_current: false,
                    lat: p.lat,
                    lon: p.lon,
                    alt: 0,
                  });
                },
              },
              {
                label: "Pick on Map",
                onClick: () => setHomePickMode(true),
              },
              // {
              //   label: "Clear Home",
              //   onClick: () => setHomePoint(null),
              //   disabled: !homePoint,
              // },
            ]}
          >
            Home
          </SidebarButton>
        </aside>

        {/* Main Area */}
        <main className="flex-1 flex flex-col p-2 overflow-auto bg-amv-maroon">
          {/* Top Status + Map */}
          <div className="flex flex-1">
            {/* Depth + Info */}
            <div className="text-amv-black w-40 bg-amv-white border border-amv-maroon/30 rounded-md mr-2 p-2 space-y-2 shadow-sm">
              <div className="text-xs">
                Long: ...
                <br />
                Lat: ...
                <br />
                Depth:
              </div>
              <div className="h-48 bg-gradient-to-b from-[#ff6b6b] to-[#8b4dff] w-8 mx-auto rounded"></div>
              <div className="text-xs text-center">0m - max</div>
            </div>

            {/* Map Card */}
            <div className="flex-1 bg-amv-white border border-amv-maroon/30 rounded-md p-2 relative shadow-sm">
              <div className="absolute inset-0 z-0 rounded-md overflow-hidden">
                <div className="absolute top-2 left-2 z-[1000]">
                  <CenterModeToggle centerMode={centerMode} setCenterMode={setCenterMode} />
                </div>
                <MapWrapper
                  asvPosition={asvPosition}
                  gcsPosition={gcsPosition}
                  setGcsPosition={setGcsPosition} // Give the map a way to tell the GCS location
                  centerMode={centerMode}
                  pathCoords={perimeter.recordedTrack}
                  recordedTrack={perimeter.recordedTrack}
                  missionPath={path.line}
                  // boundaries
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

              {/* Dynamic Island — top-center controller */}
              {/* Perimeter dynamic island */}
              {perimeter.isRecording && (
                <PerimeterIsland
                  isPaused={perimeter.isPaused}
                  onPlay={perimeter.play}
                  onPause={perimeter.pause}
                  onStop={perimeter.stop}
                  onSave={perimeter.save}
                  canSave={perimeter.recordedTrack?.length > 1}
                />
              )}

              {boundaries.isSession && (
                <div className="pointer-events-none absolute top-3 left-1/2 -translate-x-1/2 z-40">
                  <div className="pointer-events-auto flex items-center gap-2 rounded-full bg-black/70 text-white border border-[#6B0F2B] px-3 py-1.5 shadow-[0_10px_24px_rgba(107,15,43,0.45)] backdrop-blur">
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

              <YawPitchRollPanel telemetry={telemetry}/>
            </div>

            {/* Status Box */}
            <div className="w-48 bg-amv-white border border-amv-maroon/30 rounded-md ml-2 p-2 space-y-2 text-amv-black text-xs shadow-sm">
              <div className="bg-amv-maroon/15 border border-amv-maroon/30 p-1 rounded">
                Thrust: ON
              </div>
              <div className="bg-amv-maroon/15 border border-amv-maroon/30 p-1 rounded">
                Batt: 16V - 100%
              </div>
            </div>
          </div>

          {/* Bottom Controls */}
          <div className="flex mt-2 space-x-2">
            {/* Log / Console */}
            <div className="flex-1 min-h-0 text-amv-black bg-amv-white border border-amv-maroon/30 rounded-md p-2 shadow-sm">
              <div className="mt-0.5">
                <LogPanel telemetry={telemetry} />
              </div>
              {/* <div className="text-sm font-semibold mb-1 mt-1">Map Center mode</div>
              <button
                onClick={cycleCenterMode}
                className="flex items-center gap-2 px-3 py-2 rounded-lg shadow-lg bg-amv-grey text-amv-white border border-amv-white/10 hover:bg-amv-plum transition-colors"
                
                title={`Map Center Mode: ${CENTER_MODES[centerMode].label}`}
              >
                {CENTER_MODES[centerMode].icon}
                <span className="font-semibold text-sm">
                  {CENTER_MODES[centerMode].label}
                </span>
              </button> */}
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-1 bg-amv-white border border-amv-maroon/30 rounded-md p-2 shadow-sm space-x-1">
              {/* Manual */}
              <button className="p-2 rounded-md text-amv-white bg-amv-maroon hover:bg-[#5a0d24] active:bg-[#490a1e] transition-colors shadow-sm border border-amv-maroon hover:ring-2 hover:ring-amv-plum">
                Manual
              </button>
              {/* Auto */}
              <button className="p-2 rounded-md text-amv-white bg-amv-maroon hover:bg-[#5a0d24] active:bg-[#490a1e] transition-colors shadow-sm border border-amv-maroon hover:ring-2 hover:ring-amv-plum">
                Auto
              </button>
              {/* Send WP */}
              <button
                onClick={sendMissionOverWS}
                disabled={!path.hasPath}
                className={`p-2 rounded-md text-amv-white transition-colors shadow-sm border border-amv-maroon hover:ring-2 hover:ring-amv-plum
                  ${path.hasPath ? "bg-amv-maroon hover:bg-[#5a0d24]" : "bg-gray-400 cursor-not-allowed"}`}
              >
                Send WP
              </button>
              {/* RTL */}
              <button className="p-2 rounded-md text-amv-white bg-amv-maroon hover:bg-[#5a0d24] active:bg-[#490a1e] transition-colors shadow-sm border border-amv-maroon hover:ring-2 hover:ring-amv-plum">
                RTL
              </button>
              {/* Connect (full-width) */}
              <button className="p-2 rounded-md text-amv-white bg-amv-maroon hover:bg-[#5a0d24] active:bg-[#490a1e] transition-colors shadow-sm border border-amv-maroon hover:ring-2 hover:ring-amv-plum col-span-2">
                Connect
              </button>
              {/* Cloud (full-width) */}
              <button className="p-2 rounded-md text-amv-white bg-amv-maroon hover:bg-[#5a0d24] active:bg-[#490a1e] transition-colors shadow-sm border border-amv-maroon hover:ring-2 hover:ring-amv-plum col-span-2">
                Cloud ⛅
              </button>
            </div>
          </div>

          {/* Stop Confirmation Modal */}
          {perimeter.showStopModal && (
            <ConfirmModal
              title="End Perimeter Recording?"
              onCancel={perimeter.cancel}
              onDont={perimeter.dontSaveOrClear}
              onSave={perimeter.save}
            />
          )}

          {/* Boundaries Stop modal */}
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
              // usePath already supports loading an object directly
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
        </main>
      </div>
    </div>
  );
}
