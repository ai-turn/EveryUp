import type { UptimeMonitor } from '../../../services/api';

export function UptimeMonitorStatusBadge({ monitor }: { monitor: UptimeMonitor }) {
  const label = !monitor.isActive
    ? '일시정지'
    : monitor.status === 'healthy'
      ? '정상'
      : monitor.status === 'unhealthy'
        ? '장애'
        : '확인 대기';
  const className = !monitor.isActive
    ? 'border-status-idle/20 bg-status-idle/10 text-status-idle'
    : monitor.status === 'healthy'
      ? 'border-status-healthy/20 bg-status-healthy/10 text-status-healthy'
      : monitor.status === 'unhealthy'
        ? 'border-status-error/20 bg-status-error/10 text-status-error'
        : 'border-status-idle/20 bg-status-idle/10 text-status-idle';
  return <span className={`badge ${className}`}>{label}</span>;
}
