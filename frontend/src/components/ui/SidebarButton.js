export default function SidebarButton({ label, icon, children, menu, menuTitle }) {
    const slug = (label || "menu").toLowerCase().replace(/\s+/g, "-");
    const titleText = menuTitle ?? label;

    return (
        <div className="relative group">
            <button
                className={[
                    "w-10 h-12 rounded-xl border text-amv-white flex items-center justify-center", // Added flex center
                    "bg-amv-grey border-white/10 hover:bg-amv-grey/80", 
                    "transition-all duration-200 ease-out will-change-transform",
                    "shadow-[0_4px_12px_rgba(0,0,0,0.3)]", 
                    "hover:-translate-y-0.5",
                    "hover:shadow-[0_8px_20px_rgba(0,0,0,0.4)]",
                    "hover:ring-1 hover:ring-amv-maroon hover:ring-offset-1 hover:ring-offset-amv-black",
                    "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-amv-plum focus-visible:ring-offset-1 focus-visible:ring-offset-amv-black",
                    "active:translate-y-0 active:shadow-none",
                    "active:bg-amv-black active:border-white/20",
                    "relative overflow-hidden",
                ].join(" ")}
                aria-label={label}
            >
                {icon || children}
            </button>

            <div
                className="absolute left-12 top-0 h-12 w-2 md:w-12 lg:w-2 z-30"
                style={{ background: "transparent" }}
            />

            {/* Popup menu with title */}
            {Array.isArray(menu) && menu.length > 0 ? (
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
                    <div className="min-w-56 rounded-xl border border-white/10 bg-amv-grey/95 text-amv-white shadow-[0_16px_40px_rgba(0,0,0,0.5)] backdrop-blur-md px-2 py-2">
                        {/* Title bar — centered */}
                        <div className="px-2 pb-1 mb-2 border-b border-white/10">
                            <div
                                id={`menu-title-${slug}`}
                                className="flex items-center justify-center gap-2 text-sm font-semibold leading-tight text-center"
                            >
                                <span className="text-amv-maroon">
                                    {icon}
                                </span>
                                <span>{titleText}</span>
                            </div>
                        </div>
                        {/* Items */}
                        {menu.map((item, idx) => (
                            <button
                                key={idx}
                                role="menuitem"
                                onClick={item.onClick}
                                disabled={item.disabled}
                                className="w-full flex items-center gap-2 px-3 py-1.5 rounded-md text-[13px] leading-tight transition hover:bg-amv-maroon/25 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-amv-plum disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {item.icon && <span className="text-[15px] leading-none opacity-70">{item.icon}</span>}
                                <span className="leading-tight">{item.label}</span>
                            </button>
                        ))}
                    </div>
                </div>
            ) : (
                /* Tooltip only if no menu */
                 <div
                    className={[
                        "absolute left-14 top-1/2 -translate-y-1/2 px-3 py-1.5",
                        "bg-amv-black/90 text-amv-white text-xs font-bold rounded-md whitespace-nowrap",
                        "opacity-0 translate-x-[-2px] pointer-events-none group-hover:opacity-100 group-hover:translate-x-0",
                        "shadow-lg border border-white/10 z-50 transition-all duration-200"
                    ].join(" ")}
                >
                    {titleText}
                </div>
            )}
        </div>
    );
}
