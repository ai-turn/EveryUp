import { useNavigate } from 'react-router-dom';
import { MaterialIcon } from '../../../components/common';
import type { AgentServiceFlat } from '../../../services/api';

interface Props {
  service: AgentServiceFlat;
  onDelete?: (service: AgentServiceFlat) => void;
}

function relativeTime(iso: string): string {
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (secs < 60) return `${secs}초 전`;
  if (secs < 3600) return `${Math.floor(secs / 60)}분 전`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}시간 전`;
  return `${Math.floor(secs / 86400)}일 전`;
}

function CheckTypeBadge({ type }: { type: string }) {
  const label = type.toUpperCase();
  const cls = type.toLowerCase() === 'http'
    ? 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400'
    : 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400';
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase ${cls}`}>{label}</span>
  );
}

export function AgentServiceCard({ service, onDelete }: Props) {
  const navigate = useNavigate();

  return (
    <div
      onClick={() => navigate(`/services/${service.agentId}/${encodeURIComponent(service.key)}`)}
      className="bg-white dark:bg-bg-surface-dark border border-slate-200 dark:border-ui-border-dark rounded-xl p-4 cursor-pointer hover:border-primary/40 hover:shadow-md hover:-translate-y-0.5 transition-all duration-150 active:translate-y-0 flex flex-col gap-3"
    >
      {/* Header: status + name + type */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="relative flex h-2.5 w-2.5 shrink-0 mt-0.5">
            {service.healthy && (
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            )}
            <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${service.healthy ? 'bg-emerald-500' : 'bg-red-500'}`} />
          </span>
          <h3 className="font-semibold text-base text-slate-900 dark:text-white truncate leading-tight">
            {service.name}
          </h3>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <CheckTypeBadge type={service.checkType} />
          {onDelete && (
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(service); }}
              title="서비스 삭제"
              className="p-1 rounded-lg text-slate-300 dark:text-text-dim-dark hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
            >
              <MaterialIcon name="delete_outline" className="text-base" />
            </button>
          )}
        </div>
      </div>

      {/* Endpoint */}
      <p className="text-xs font-mono text-slate-400 dark:text-text-dim-dark truncate">
        {service.endpoint || '—'}
      </p>

      {/* Divider */}
      <div className="border-t border-slate-100 dark:border-ui-border-dark" />

      {/* Stats row */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          {service.lastLatency ? (
            <span className="text-sm font-mono font-semibold text-slate-700 dark:text-text-base-dark">
              {service.lastLatency}
            </span>
          ) : (
            <span className="text-sm text-slate-400 dark:text-text-dim-dark">—</span>
          )}
          {service.lastStatus != null && service.lastStatus > 0 && (
            <span className={`text-xs font-bold ${service.lastStatus < 400 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>
              {service.lastStatus}
            </span>
          )}
        </div>
        <span className={`flex items-center gap-1 text-xs font-semibold ${service.healthy ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>
          <MaterialIcon name={service.healthy ? 'check_circle' : 'cancel'} className="text-sm" />
          {service.healthy ? '정상' : '장애'}
        </span>
      </div>

      {/* Error message */}
      {!service.healthy && service.lastError && (
        <p className="text-xs text-red-500 dark:text-red-400 truncate -mt-1">
          {service.lastError}
        </p>
      )}

      {/* Footer: agent + time */}
      <div className="flex items-center justify-between gap-2 text-xs text-slate-400 dark:text-text-dim-dark">
        <span className="flex items-center gap-1 truncate">
          <MaterialIcon name="sensors" className="text-sm shrink-0" />
          <span className="truncate">{service.agentName}</span>
        </span>
        <span className="shrink-0">{relativeTime(service.observedAt)}</span>
      </div>
    </div>
  );
}
