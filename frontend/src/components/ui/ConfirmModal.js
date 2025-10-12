export default function ConfirmModal({ title, onCancel, onDont, onSave }) {
    return (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center">
            <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
                <h3 className="text-lg font-semibold text-black mb-2">{title}</h3>
                <p className="text-sm text-black/70 mb-4">Choose an action.</p>
                <div className="flex gap-2 justify-end">
                    <button
                        onClick={onCancel}
                        className="px-4 py-2 rounded-md border border-black/10 text-black hover:bg-black/5 transition"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={onDont}
                        className="px-4 py-2 rounded-md bg-[#b91c1c] text-white hover:bg-[#991b1b] transition"
                    >
                        Don’t Save
                    </button>
                    <button
                        onClick={onSave}
                        className="px-4 py-2 rounded-md bg-[#6B0F2B] text-white hover:bg-[#5a0d24] active:bg-[#490a1e] transition"
                    >
                        Save
                    </button>
                </div>
            </div>
        </div>
    );
}
