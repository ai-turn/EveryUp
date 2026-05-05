import { MaterialIcon } from './MaterialIcon';

const KPI_TONES: Record<string, string> = {
  primary: 'text-primary',
  emerald: 'text-emerald-500',
  amber:   'text-amber-500',
  red:     'text-red-500',
  slate:   'text-slate-400 dark:text-slate-500',
};

interface KPIChipProps {
  label: string;
  value: string | number;
  tone: string;
  icon: string;
}

export function KPIChip({ label, value, tone, icon }: KPIChipProps) {
  const iconClass = KPI_TONES[tone] ?? KPI_TONES.slate;
  return (
    <div className="flex items-center justify-between bg-white dark:bg-bg-surface-dark border border-slate-200 dark:border-ui-border-dark rounded-lg px-4 py-3 min-w-0 gap-3">
      <div className="flex items-center gap-1.5 min-w-0">
        <MaterialIcon name={icon} className={`${iconClass} text-sm shrink-0`} />
        <span className="text-xs text-slate-500 dark:text-text-muted-dark truncate">{label}</span>
      </div>
      <span className="text-lg font-bold tabular-nums text-slate-900 dark:text-white shrink-0">{value}</span>
    </div>
  );
}
