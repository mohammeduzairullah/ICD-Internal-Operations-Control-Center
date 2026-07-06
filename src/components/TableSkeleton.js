export default function TableSkeleton({ rows = 5, cols = 4 }) {
  return (
    <div className="divide-y divide-slate-800/60">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex items-center gap-4 p-4">
          {Array.from({ length: cols }).map((_, c) => (
            <div
              key={c}
              className="h-4 flex-1 bg-slate-800/60 rounded animate-pulse"
              style={{ animationDelay: `${(r * cols + c) * 40}ms` }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
