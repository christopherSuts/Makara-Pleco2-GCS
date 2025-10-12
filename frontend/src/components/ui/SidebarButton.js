export default function SidebarButton({ label, children, menu, menuTitle }) {
    const slug = (label || "menu").toLowerCase().replace(/\s+/g, "-");
    const titleText = menuTitle ?? label;

    return (
        <div className="relative group">
            <button
                className={[
                    "w-12 h-12 rounded-md border text-amv-white",
                    "bg-amv-grey border-amv-grey hover:bg-[#1a1a1d]",
                    "transition-all duration-200 ease-out will-change-transform",
                    "shadow-[0_2px_8px_rgba(107,15,43,0.35)]",
                    "hover:-translate-y-0.5",
                    "hover:shadow-[0_10px_24px_rgba(107,15,43,0.45),0_0_14px_rgba(107,15,43,0.55)]",
                    "hover:drop-shadow-[0_0_8px_rgba(107,15,43,0.35)]",
                    "hover:ring-1 hover:ring-amv-maroon hover:ring-offset-1 hover:ring-offset-amv-black",
                    "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-amv-plum focus-visible:ring-offset-1 focus-visible:ring-offset-amv-black",
                    "active:translate-y-0 active:shadow-[0_1px_4px_rgba(107,15,43,0.40)]",
                    "active:bg-[#17171A] active:border-[#222225]",
                    "relative before:content-[''] before:absolute before:inset-0 before:rounded-md",
                    "before:bg-gradient-to-b before:from-white/10 before:to-transparent before:pointer-events-none",
                ].join(" ")}
                aria-label={label}
            >
                {children}
            </button>

            <div
                className="absolute left-12 top-0 h-12 w-2 md:w-12 lg:w-2 z-30"
                style={{ background: "transparent" }}
            />

            {/* Popup menu with title */}
            {Array.isArray(menu) && menu.length > 0 && (
                <div
                    className={[
                        "absolute left-14 top-1/2 -translate-y-1/2",
                        // visible state
                        "opacity-0 translate-x-[-2px] pointer-events-none",
                        "group-hover:opacity-100 group-hover:translate-x-0 group-hover:pointer-events-auto",
                        // stacking over bridge & header
                        "z-50",
                    ].join(" ")}
                    role="menu"
                    aria-labelledby={`menu-title-${slug}`}
                >
                    <div className="min-w-56 rounded-lg border border-amv-maroon bg-amv-black/95 text-amv-white shadow-[0_16px_40px_rgba(107,15,43,0.45)] backdrop-blur px-2 py-2">
                        {/* Title bar — centered */}
                        <div className="px-2 pb-1 mb-2 border-b border-white/10">
                            <div
                                id={`menu-title-${slug}`}
                                className="flex items-center justify-center gap-2 text-sm font-semibold leading-tight text-center"
                            >
                                <span className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-amv-maroon text-white text-[12px]">
                                    {children}
                                </span>
                                <span>{titleText}</span>
                            </div>
                        </div>

                        {/* Items — tighter line spacing & padding */}
                        {menu.map((item, idx) => (
                            <button
                                key={idx}
                                role="menuitem"
                                onClick={item.onClick}
                                disabled={item.disabled}
                                className="w-full flex items-center gap-2 px-3 py-1.5 rounded-md text-[13px] leading-tight transition hover:bg-amv-maroon/25 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-amv-plum disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <span className="text-[15px] leading-none">{item.icon}</span>
                                <span className="leading-tight">{item.label}</span>
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
