import DynamicIsland from "@/components/ui/DynamicIsland";

const IconPlay = (p) => <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor"><path d="M8 5v14l11-7-11-7z" /></svg>;
const IconPause = (p) => <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor"><path d="M7 5h4v14H7zM13 5h4v14h-4z" /></svg>;
const IconStop = (p) => <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor"><path d="M6 6h12v12H6z" /></svg>;

export default function PerimeterIsland({ isPaused, onPlay, onPause, onStop, onSave, canSave }) {
    return (
        <DynamicIsland>
            <button
                onClick={onPlay}
                disabled={!isPaused}
                aria-label="Play"
                className="w-8 h-8 flex items-center justify-center rounded-md text-white hover:text-white/80 active:text-white/70 transition disabled:text-gray-400 disabled:opacity-60 disabled:cursor-not-allowed"
            ><IconPlay /></button>

            <button
                onClick={onPause}
                disabled={isPaused}
                aria-label="Pause"
                className="w-8 h-8 flex items-center justify-center rounded-md text-white hover:text-white/80 active:text-white/70 transition disabled:text-gray-400 disabled:opacity-60 disabled:cursor-not-allowed"
            ><IconPause /></button>

            <button
                onClick={onStop}
                aria-label="Stop"
                className="w-8 h-8 flex items-center justify-center rounded-md text-white hover:text-white/80 active:text-white/70 transition"
            ><IconStop /></button>

            <span className="ml-1 text-amv-white font-bold text-xs opacity-100">
                {isPaused ? "Paused" : "Recording…"}
            </span>
        </DynamicIsland>
    );
}
