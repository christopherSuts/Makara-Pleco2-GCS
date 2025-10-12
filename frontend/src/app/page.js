"use client";
import SidebarButton from "@/components/ui/SidebarButton";
import ConfirmModal from "@/components/ui/ConfirmModal";
import LoadFileModal from "@/components/ui/LoadPerimeterModal";
import PerimeterIsland from "@/components/features/PerimeterIsland";
import { usePerimeter } from "@/components/features/usePerimeter";
import { useBoundaries } from "@/components/features/useBoundaries";
import { usePath } from "@/components/features/usePath";
import MapWrapper from "../components/MapWrapper";

export default function HomePage() {
  const perimeter = usePerimeter();
  const boundaries = useBoundaries();
  const path = usePath();

  const boundaryShown = boundaries.shownId !== null;
  const hasPerimeter = perimeter.perimeterPath.length > 0;

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
              { label: "Record Perimeter", onClick: perimeter.start, disabled: perimeter.isRecording },
              { label: "Show Saved Perimeters", onClick: perimeter.openLoad },
              { label: "Clear Perimeters", onClick: perimeter.dontSaveOrClear, disabled: !hasPerimeter },
            ]}
          >Per</SidebarButton>

          <SidebarButton
            label="Boundaries"
            menuTitle="Boundaries"
            menu={[
              { label: "Create Boundaries", onClick: boundaries.start },
              { label: "Show Saved Boundaries", onClick: boundaries.showSaved },
              { label: "Clear Shown Boundaries", onClick: boundaries.clearShown, disabled: !boundaryShown },
            ]}
          >B</SidebarButton>

          <SidebarButton
            label="Path"
            menuTitle="Path"
            menu={[
              { label: "Generate: Top → Bottom", onClick: () => path.generate("TB", boundaries.points) },
              { label: "Generate: Bottom → Top", onClick: () => path.generate("BT", boundaries.points) },
              { label: "Generate: Right → Left", onClick: () => path.generate("RL", boundaries.points) },
              { label: "Generate: Left → Right", onClick: () => path.generate("LR", boundaries.points) },
              { label: "Load Saved Path", onClick: path.load },
              { label: "Save Current Path", onClick: path.save, disabled: !path.hasPath },
              { label: "Clear Shown Path", onClick: path.clear, disabled: !path.hasPath },
            ]}
          >Path</SidebarButton>

          <SidebarButton label="Set Home">H</SidebarButton>
          <SidebarButton label="?">?</SidebarButton>
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
                <MapWrapper 
                  pathCoords={perimeter.perimeterPath}
                  recordedTrack={perimeter.recordedTrack} 
                  missionPath={path.line}
                  // boundaries
                  isBoundarySession={boundaries.isSession}
                  isBoundaryAdding={boundaries.isAdding}
                  boundaryPoints={boundaries.points}
                  movingDotId={boundaries.movingId}
                  onBoundaryAddPoint={boundaries.addPoint}
                  onBoundaryPause={boundaries.pauseAdd}
                  onBoundaryRemovePoint={boundaries.remove}
                  onBoundaryBeginMovePoint={boundaries.beginMove}
                  onBoundaryMovePointTo={boundaries.moveTo}
                  onBoundaryEndMovePoint={boundaries.endMove}
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
                        boundaries.isAdding ? "ring-2 ring-[#6B0F2B]" : ""
                      ].join(" ")}
                    >{boundaries.isAdding ? "Pause" : "Add More Dots"}</button>
                    <span className="text-xs opacity-80">
                      {boundaries.isAdding ? "Click map to add. Right-click to pause." : "Paused"}
                    </span>
                    <button
                      onClick={boundaries.stopReq}
                      className="px-3 py-1 rounded-full bg-white text-[#1F1F22] border border-[#6B0F2B] shadow-sm hover:bg-white/90 active:bg-white/80 transition"
                    >Stop</button>
                  </div>
                </div>
              )}

              {/* GPS Info */}
              <div className="absolute top-2 right-2 bg-amv-white text-amv-black border border-amv-maroon/40 rounded px-2 py-1 text-xs backdrop-blur">
                Sat: ... Fix: ...
              </div>

              {/* Indicator Panel */}
              <div className="absolute top-16 right-2 grid grid-cols-2 gap-2">
                {/* Roll */}
                <div className="flex flex-col items-center">
                  <div className="w-16 h-16 bg-amv-white border border-amv-maroon/40 rounded-full flex items-center justify-center">
                    <div className="w-6 h-6 bg-amv-plum rounded-full" />
                  </div>
                  <div className="mt-1 bg-amv-black text-amv-white text-xs px-2 py-0.5 rounded">
                    R: -1.8
                  </div>
                </div>

                {/* Heading */}
                <div className="flex flex-col items-center">
                  <div className="w-16 h-16 bg-amv-black border border-amv-maroon/40 rounded-full flex items-center justify-center">
                    <div className="w-7 h-7">
                      <img src="/imuIndicator/yaw.png" />
                    </div>
                  </div>
                  <div className="mt-1 bg-amv-black text-amv-white text-[10px] px-2 py-0.5 rounded leading-tight text-center">
                    H: -148.0
                    <br />
                    C: -132.0
                  </div>
                </div>

                {/* Pitch */}
                <div className="flex flex-col items-center">
                  <div className="w-16 h-16 bg-amv-white border border-amv-maroon/40 rounded-full flex items-center justify-center">
                    <div className="w-8 h-4 bg-amv-plum rounded" />
                  </div>
                  <div className="mt-1 bg-amv-black text-amv-white text-xs px-2 py-0.5 rounded">
                    P: 2.3
                  </div>
                </div>

                {/* Left/Right Thruster */}
                <div className="flex flex-col items-center">
                  <div className="w-16 h-16 bg-amv-white border border-amv-maroon/40 rounded-full flex items-center justify-center">
                    <div className="w-3 h-3 bg-amv-black rounded-full" />
                  </div>
                  <div className="mt-1 bg-amv-black text-amv-white text-[10px] px-2 py-0.5 rounded leading-tight text-center">
                    L: +0.2
                    <br />
                    R: +0.0
                  </div>
                </div>
              </div>
            </div>

            {/* Status Box */}
            <div className="w-48 bg-amv-white border border-amv-maroon/30 rounded-md ml-2 p-2 space-y-2 text-amv-black text-xs shadow-sm">
              <div className="bg-amv-maroon/15 border border-amv-maroon/30 p-1 rounded">Thrust: ON</div>
              <div className="bg-amv-maroon/15 border border-amv-maroon/30 p-1 rounded">Batt: 16V - 100%</div>
            </div>
          </div>

          {/* Bottom Controls */}
          <div className="flex mt-2 space-x-2">
            {/* Log / Console */}
            <div className="flex-1 text-amv-black bg-amv-white border border-amv-maroon/30 rounded-md p-2 shadow-sm">
              <div className="h-20 overflow-y-scroll text-xs">Log view</div>
              <div className="mt-2 flex items-center space-x-2">
                <label className="flex items-center gap-2">
                  <input type="checkbox" className="accent-amv-plum" /> <span>Center</span>
                </label>
                <span>MODE: ...</span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-1 bg-amv-white border border-amv-maroon/30 rounded-md p-2 shadow-sm  space-x-1">
              {["Manual", "Auto", "Send WP", "RTL", "Connect", "Cloud ⛅"].map((t, i) => (
                <button
                  key={t}
                  className={[
                    "p-2 rounded-md text-amv-white",
                    "bg-amv-maroon hover:bg-[#5a0d24] active:bg-[#490a1e]",
                    "transition-colors shadow-sm border border-amv-maroon",
                    "hover:ring-2 hover:ring-amv-plum focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amv-plum"
                  ].join(" ")}
                  {...(i >= 4 ?
                    {
                      className:
                        "p-2 rounded-md text-amv-white bg-amv-maroon hover:bg-[#5a0d24] active:bg-[#490a1e] transition-colors shadow-sm border border-amv-maroon hover:ring-2 hover:ring-amv-plum focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amv-plum col-span-2"
                    } : {}
                  )}>
                  {t}
                </button>
              ))}
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
            <LoadFileModal
              open
              onClose={perimeter.closeLoad}
              onImport={perimeter.importPerimeterJSON}
            />
          )}
        </main>
      </div>
    </div>
  );
}