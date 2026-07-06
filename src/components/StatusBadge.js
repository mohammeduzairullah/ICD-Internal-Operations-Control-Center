import { calculateContainerStatus } from '../utils/tracker';

const TONE_CLASSES = {
  emerald: 'bg-emerald-950/60 text-emerald-400 border-emerald-900',
  amber: 'bg-amber-950/60 text-amber-400 border-amber-900',
  rose: 'bg-rose-950/60 text-rose-400 border-rose-900 animate-pulse',
  slate: 'bg-slate-900 text-slate-400 border-slate-800',
};

export default function StatusBadge({ gateInTime, gateOutTime, status }) {
  const metrics = calculateContainerStatus(gateInTime, gateOutTime);
  const stopped = status === 'GATE_OUT';

  let tone = 'emerald';
  let label = `${metrics.hoursRemaining}h left`;
  let icon = '🟢';

  if (stopped) {
    tone = 'slate';
    label = 'Gated Out';
    icon = '✅';
  } else if (metrics.isBreached) {
    tone = 'rose';
    label = `Breached +${metrics.hoursElapsed - 72}h`;
    icon = '🚨';
  } else if (metrics.hoursRemaining <= 12) {
    tone = 'rose';
    icon = '🔴';
  } else if (metrics.hoursRemaining <= 24) {
    tone = 'amber';
    icon = '🟡';
  }

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[10px] font-bold font-mono uppercase tracking-wider transition-colors duration-500 ${TONE_CLASSES[tone]}`}>
      <span>{icon}</span>{label}
    </span>
  );
}
