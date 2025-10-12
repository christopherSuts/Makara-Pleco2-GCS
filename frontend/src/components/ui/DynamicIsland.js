export default function DynamicIsland({ children }) {
  return (
    <div className="pointer-events-none absolute top-3 left-1/2 -translate-x-1/2 z-40">
      <div className="pointer-events-auto flex items-center gap-2 rounded-full bg-amv-grey text-white border border-[#6B0F2B] px-3 py-1.5 shadow-[0_10px_24px_rgba(107,15,43,0.45)] backdrop-blur">
        {children}
      </div>
    </div>
  );
}
