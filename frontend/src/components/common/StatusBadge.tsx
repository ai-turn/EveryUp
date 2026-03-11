import { useTranslation } from 'react-i18next';

interface StatusBadgeProps {
  status: string;
}

type StatusStyle = { bg: string; text: string; pulse: string };

const styleMap: Record<string, StatusStyle> = {
  healthy:   { bg: 'bg-emerald-500/10', text: 'text-emerald-500', pulse: 'bg-emerald-500' },
  online:    { bg: 'bg-emerald-500/10', text: 'text-emerald-500', pulse: 'bg-emerald-500' },
  warning:   { bg: 'bg-amber-500/10',   text: 'text-amber-500',   pulse: 'bg-amber-500' },
  degraded:  { bg: 'bg-red-500/10',     text: 'text-red-500',     pulse: 'bg-red-500' },
  unhealthy: { bg: 'bg-red-500/10',     text: 'text-red-500',     pulse: 'bg-red-500' },
  critical:  { bg: 'bg-red-500/10',     text: 'text-red-500',     pulse: 'bg-red-500' },
  error:     { bg: 'bg-red-500/10',     text: 'text-red-500',     pulse: 'bg-red-500' },
  offline:   { bg: 'bg-slate-500/10',   text: 'text-slate-500',   pulse: 'bg-slate-500' },
  unknown:   { bg: 'bg-slate-500/10',   text: 'text-slate-500',   pulse: 'bg-slate-500' },
};

const fallbackStyle: StatusStyle = { bg: 'bg-slate-500/10', text: 'text-slate-500', pulse: 'bg-slate-500' };

const labelMap: Record<string, string> = {
  healthy:   'common.healthy',
  online:    'common.online',
  warning:   'common.warning',
  degraded:  'common.degraded',
  unhealthy: 'common.degraded',
  critical:  'common.critical',
  error:     'common.error',
  offline:   'common.offline',
  unknown:   'common.unknown',
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const { t } = useTranslation();
  const colors = styleMap[status] ?? fallbackStyle;
  const labelKey = labelMap[status] ?? 'common.unknown';

  return (
    <div className={`flex items-center gap-2 px-2 py-1 rounded ${colors.bg} ${colors.text}`}>
      <span className={`status-pulse ${colors.pulse}`} />
      <span className="text-xs font-bold uppercase">{t(labelKey, { defaultValue: status })}</span>
    </div>
  );
}
