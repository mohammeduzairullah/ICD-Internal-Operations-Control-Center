import { calculateContainerStatus } from '../utils/tracker';

const TONE_CLASSES = {
  emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  amber: 'bg-amber-50 text-amber-700 border-amber-200',
  rose: 'bg-rose-50 text-rose-700 border-rose-200 animate-pulse',
  slate: 'bg-slate-100 text-slate-500 border-slate-200',
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
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[10px] font-bold font-mono uppercase tracking-wider transition-all duration-500 hover:scale-105 ${TONE_CLASSES[tone]}`}>
      <span>{icon}</span>{label}
    </span>
  );
}
