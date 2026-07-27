import { useTranslation } from 'react-i18next';

interface StatusBadgeProps {
  status: string;
}

type StatusStyle = { chip: string };

// Border-chip grammar: tinted bg + matching border. 색은 status 시맨틱 토큰이 담당한다 —
// 토큰이 .dark에서 자가 전환하므로 dark: 짝이 필요 없고, 대비 조정도 index.css 한 곳에서 끝난다.
const CHIP = {
  healthy: 'text-status-healthy bg-status-healthy/10 border-status-healthy/20',
  warn:    'text-status-warn bg-status-warn/10 border-status-warn/20',
  error:   'text-status-error bg-status-error/10 border-status-error/20',
  idle:    'text-status-idle bg-status-idle/10 border-status-idle/20',
} as const;

const styleMap: Record<string, StatusStyle> = {
  healthy:   { chip: CHIP.healthy },
  online:    { chip: CHIP.healthy },
  warning:   { chip: CHIP.warn },
  degraded:  { chip: CHIP.error },
  unhealthy: { chip: CHIP.error },
  critical:  { chip: CHIP.error },
  error:     { chip: CHIP.error },
  paused:    { chip: CHIP.idle },
  offline:   { chip: CHIP.idle },
  unknown:   { chip: CHIP.idle },
};

const fallbackStyle: StatusStyle = { chip: CHIP.idle };

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
