import { useTranslate } from '@tolgee/react';
import type { UptimeMonitor } from '../../../services/api';

export function UptimeMonitorStatusBadge({ monitor }: { monitor: UptimeMonitor }) {
  const { t } = useTranslate();
  const label = !monitor.isActive
    ? '일시정지'
    : monitor.status === 'healthy'
      ? '정상'
      : monitor.status === 'unhealthy'
        ? '장애'
        : '확인 대기';
  const className = !monitor.isActive
    ? 'bg-status-idle/10 text-status-idle'
    : monitor.status === 'healthy'
      ? 'bg-status-healthy/10 text-status-healthy'
      : monitor.status === 'unhealthy'
        ? 'bg-status-error/10 text-status-error'
        : 'bg-status-idle/10 text-status-idle';

  return <span className={`shrink-0 rounded-full px-2 py-1 text-xs font-semibold ${className}`}>{t(label)}</span>;
}
