import { MaterialIcon } from '../../../components/common';
import type { UptimeMonitor } from '../../../services/api';

export function UptimeMonitorStatusBadge({ monitor, onToggle }: { monitor: UptimeMonitor; onToggle?: () => void }) {
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
  const base = `inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold ${className}`;
  const content = (
    <>
      <MaterialIcon name={monitor.isActive ? 'play_arrow' : 'pause'} className="text-sm" />
      {label}
    </>
  );

  if (!onToggle) return <span className={base}>{content}</span>;

  return (
    <button type="button" onClick={onToggle} aria-label={monitor.isActive ? '일시정지' : '재개'} className={`${base} transition-opacity hover:opacity-70`}>
      {content}
    </button>
  );
}
