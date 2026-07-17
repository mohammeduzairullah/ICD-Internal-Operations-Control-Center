'use client';

export default function ConfirmModal({ open, title, message, confirmLabel = 'Confirm', danger = false, onConfirm, onCancel }) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center p-6 bg-slate-900/40 backdrop-blur-sm"
      style={{ animation: 'fadeIn 0.15s ease-out' }}
      onClick={onCancel}
    >
      <div
        className="max-w-sm w-full bg-white border border-slate-200 rounded-2xl p-6 shadow-2xl shadow-slate-400/20"
        onClick={(e) => e.stopPropagation()}
        style={{ animation: 'slideIn 0.2s ease-out' }}
      >
        <h3 className="text-sm font-black uppercase tracking-widest text-slate-900 mb-2">{title}</h3>
        <p className="text-xs text-slate-500 font-mono leading-relaxed mb-6">{message}</p>
        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-xl text-xs font-mono uppercase tracking-wider text-slate-500 hover:text-slate-800 border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-all"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className={`px-4 py-2 rounded-xl text-xs font-mono uppercase tracking-wider font-bold text-white transition-all active:scale-95 shadow-lg ${
              danger ? 'bg-rose-600 hover:bg-rose-500 shadow-rose-500/25' : 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-500/25'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
