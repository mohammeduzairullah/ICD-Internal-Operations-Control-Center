export default function EmptyState({ title, message }) {
  return (
    <div className="p-12 text-center">
      <div className="text-4xl mb-3 opacity-40">📦</div>
      <p className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider">{title}</p>
      {message && <p className="text-[11px] font-mono text-slate-600 mt-1.5">{message}</p>}
    </div>
  );
}
