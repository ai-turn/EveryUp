import { useTranslation } from 'react-i18next';

interface StatusBadgeProps {
  status: string;
}

type StatusStyle = { chip: string };

// Border-chip grammar (AgentHealthCheckDetailView 기준안): tinted bg + matching border.
const styleMap: Record<string, StatusStyle> = {
  healthy:   { chip: 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
  online:    { chip: 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
  warning:   { chip: 'text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/20' },
  degraded:  { chip: 'text-red-600 dark:text-red-400 bg-red-500/10 border-red-500/20' },
  unhealthy: { chip: 'text-red-600 dark:text-red-400 bg-red-500/10 border-red-500/20' },
  critical:  { chip: 'text-red-600 dark:text-red-400 bg-red-500/10 border-red-500/20' },
  error:     { chip: 'text-red-600 dark:text-red-400 bg-red-500/10 border-red-500/20' },
  paused:    { chip: 'text-slate-500 dark:text-slate-400 bg-slate-500/10 border-slate-500/20' },
  offline:   { chip: 'text-slate-500 dark:text-slate-400 bg-slate-500/10 border-slate-500/20' },
  unknown:   { chip: 'text-slate-500 dark:text-slate-400 bg-slate-500/10 border-slate-500/20' },
};

const fallbackStyle: StatusStyle = { chip: 'text-slate-500 dark:text-slate-400 bg-slate-500/10 border-slate-500/20' };

const labelMap: Record<string, string> = {
  healthy:   'common.healthy',
  online:    'common.online',
  warning:   'common.warning',
  degraded:  'common.degraded',
  unhealthy: 'common.degraded',
  critical:  'common.critical',
  error:     'common.error',
  paused:    'common.paused',
  offline:   'common.offline',
  unknown:   'common.unknown',
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const { t } = useTranslation('common');
  const colors = styleMap[status] ?? fallbackStyle;
  const labelKey = labelMap[status] ?? 'common.unknown';

  return (
    <span className={`text-2xs font-bold px-1.5 py-0.5 rounded border ${colors.chip}`}>
      {t(labelKey, { defaultValue: status })}
    </span>
  );
}
