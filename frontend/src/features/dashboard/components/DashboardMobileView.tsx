import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { IconHealthCheck, IconLogs, IconInfra } from '../../../components/icons/SidebarIcons';
import { useDashboardServices, useMonitoringResources } from '../../../hooks/useData';
import { api, type Service, type LogEntry } from '../../../services/api';
import { relativeTime } from '../../../utils/formatters';
import { IncidentTimeline } from './IncidentTimeline';

const logLevelBadge: Record<string, string> = {
  error: 'bg-red-500 text-white',
  warn:  'bg-amber-500 text-white',
  info:  'bg-blue-500 text-white',
};

const statusColors: Record<string, { dot: string; text: string }> = {
  healthy:   { dot: 'bg-emerald-500', text: 'text-emerald-600 dark:text-emerald-400' },
  online:    { dot: 'bg-emerald-500', text: 'text-emerald-600 dark:text-emerald-400' },
  warning:   { dot: 'bg-amber-500',   text: 'text-amber-600 dark:text-amber-400' },
  degraded:  { dot: 'bg-red-500',     text: 'text-red-600 dark:text-red-400' },
  unhealthy: { dot: 'bg-red-500',     text: 'text-red-600 dark:text-red-400' },
  critical:  { dot: 'bg-red-500',     text: 'text-red-600 dark:text-red-400' },
  error:     { dot: 'bg-red-500',     text: 'text-red-600 dark:text-red-400' },
  offline:   { dot: 'bg-slate-400',   text: 'text-slate-400 dark:text-text-dim-dark' },
  unknown:   { dot: 'bg-slate-400',   text: 'text-slate-400 dark:text-text-dim-dark' },
};

const resourceStatusDot: Record<string, string> = {
  healthy:   'bg-emerald-500',
  warning:   'bg-amber-500',
  degraded:  'bg-red-500',
  unhealthy: 'bg-red-500',
  critical:  'bg-red-500',
  error:     'bg-red-500',
  offline:   'bg-slate-400',
  unknown:   'bg-slate-400',
};

const resourceStatusText: Record<string, string> = {
  healthy:   'text-emerald-600 dark:text-emerald-400',
  warning:   'text-amber-600 dark:text-amber-400',
  degraded:  'text-red-600 dark:text-red-400',
  unhealthy: 'text-red-600 dark:text-red-400',
  critical:  'text-red-600 dark:text-red-400',
  error:     'text-red-600 dark:text-red-400',
  offline:   'text-slate-400 dark:text-text-dim-dark',
  unknown:   'text-slate-400 dark:text-text-dim-dark',
};

export function DashboardMobileView() {
  const { t } = useTranslation(['dashboard', 'logs', 'common']);
  const navigate = useNavigate();
  const { data: services, loading: svcLoading } = useDashboardServices();
  const { data: resources, loading: resourceLoading } = useMonitoringResources();
  const [logServices, setLogServices] = useState<Service[]>([]);
  const [latestLogs, setLatestLogs] = useState<Record<string, LogEntry | null>>({});
  const [logLoading, setLogLoading] = useState(true);

  const fetchLogServices = useCallback(async () => {
    try {
      const data = await api.getServices();
      setLogServices(data.filter(s => s.type === 'log'));
    } catch {
      // non-critical
    } finally {
      setLogLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLogServices();
  }, [fetchLogServices]);

  useEffect(() => {
    if (logServices.length === 0) return;
    logServices.forEach(async (svc) => {
      try {
        const logs = await api.getServiceLogs(svc.id, { limit: '1' });
        setLatestLogs(prev => ({ ...prev, [svc.id]: logs[0] ?? null }));
      } catch {
        setLatestLogs(prev => ({ ...prev, [svc.id]: null }));
      }
    });
  }, [logServices]);

  return (
    <div className="space-y-4">
      {/* Services Quick Status */}
      <section>
        <div className="flex items-center justify-between p-4 pb-0">
          <div className="flex items-center gap-2">
            <IconHealthCheck size={18} className="text-primary" />
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              {t('dashboard.healthCheck.title')}
            </h2>
          </div>
          <button
            onClick={() => navigate('/healthcheck')}
            className="text-xs font-semibold text-primary"
          >
            {t('common.viewMore', { defaultValue: 'View More' })}
          </button>
        </div>
        <div className="p-3">
          {svcLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-12 rounded-lg bg-slate-100 dark:bg-ui-hover-dark animate-pulse" />
              ))}
            </div>
          ) : !services || services.length === 0 ? (
            <div className="rounded-xl border-2 border-dashed border-slate-200 dark:border-ui-border-dark bg-slate-50/50 dark:bg-ui-hover-dark/30 py-6 text-center">
              <IconHealthCheck size={28} className="text-slate-300 dark:text-text-dim-dark block mx-auto" />
              <p className="text-xs font-medium text-slate-400 dark:text-text-muted-dark mt-2">
                {t('dashboard.healthCheck.empty')}
              </p>
              <p className="text-xs text-slate-300 dark:text-text-dim-dark mt-0.5">
                {t('dashboard.healthCheck.emptyDesc')}
              </p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {services.slice(0, 3).map(svc => {
                const sc = statusColors[svc.status] || statusColors.healthy;
                return (
                  <button
                    key={svc.id}
                    onClick={() => navigate(`/healthcheck/${svc.id}`)}
                    className="w-full flex items-center gap-3 py-2.5 pl-2.5 pr-1 rounded-lg hover:bg-slate-50 dark:hover:bg-ui-hover-dark active:bg-slate-100 dark:active:bg-ui-active-dark transition-colors text-left"
                  >
                    <span className={`w-2 h-2 rounded-full shrink-0 ${sc.dot}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-800 dark:text-text-base-dark truncate">
                        {svc.name}
                      </p>
                    </div>
                    <span className="text-xs font-mono text-slate-500 dark:text-text-muted-dark shrink-0">
                      {svc.latency}
                    </span>
                    <span className={`text-xs font-bold shrink-0 ${sc.text}`}>
                      {svc.uptime}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
        <div className="mx-4 h-px bg-slate-200 dark:bg-ui-border-dark" />
      </section>

      {/* Log Services */}
      <section>
        <div className="flex items-center justify-between p-4 pb-3">
          <div className="flex items-center gap-2">
            <IconLogs size={18} className="text-primary" />
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              {t('dashboard.logs.title')}
            </h2>
          </div>
          <button
            onClick={() => navigate('/logs')}
            className="text-xs font-semibold text-primary cursor-pointer"
          >
            {t('common.viewMore', { defaultValue: 'View More' })}
          </button>
        </div>
        <div className="px-3 pb-3">
          {logLoading ? (
            <div className="space-y-2">
              {[1, 2].map(i => (
                <div key={i} className="h-14 rounded-lg bg-slate-100 dark:bg-ui-hover-dark animate-pulse" />
              ))}
            </div>
          ) : logServices.length === 0 ? (
            <div className="rounded-xl border-2 border-dashed border-slate-200 dark:border-ui-border-dark bg-slate-50/50 dark:bg-ui-hover-dark/30 py-6 text-center">
              <IconLogs size={28} className="text-slate-300 dark:text-text-dim-dark block mx-auto" />
              <p className="text-xs font-medium text-slate-400 dark:text-text-muted-dark mt-2">
                {t('dashboard.logs.empty')}
              </p>
              <p className="text-xs text-slate-300 dark:text-text-dim-dark mt-0.5">
                {t('dashboard.logs.emptyDesc')}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {logServices.slice(0, 3).map(svc => {
                const sc = statusColors[svc.status] ?? statusColors.unknown;
                const latest = latestLogs[svc.id];
                return (
                  <button
                    key={svc.id}
                    onClick={() => navigate(`/logs/${svc.id}`)}
                    className="w-full flex flex-col gap-1.5 p-3 rounded-lg bg-slate-50 dark:bg-ui-hover-dark hover:bg-slate-100 dark:hover:bg-ui-active-dark active:scale-[0.99] transition-all text-left"
                  >
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${sc.dot}`} />
                      <span className="text-sm font-semibold text-slate-800 dark:text-text-base-dark flex-1 truncate">
                        {svc.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 pl-4">
                      {latest ? (
                        <>
                          <span className={`text-xs font-bold px-1.5 py-0.5 rounded uppercase shrink-0 ${logLevelBadge[latest.level]}`}>
                            {latest.level.toUpperCase()}
                          </span>
                          <span className="text-xs text-slate-500 dark:text-text-muted-dark flex-1 truncate">
                            {latest.message}
                          </span>
                          <span className="text-xs text-slate-400 dark:text-text-dim-dark shrink-0">
                            {relativeTime(latest.createdAt)}
                          </span>
                        </>
                      ) : (
                        <span className="text-xs text-slate-400 dark:text-text-dim-dark italic">
                          {t('logs.noLogs')}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
        <div className="mx-4 h-px bg-slate-200 dark:bg-ui-border-dark" />
      </section>

      {/* Infrastructure Quick Status */}
      <section>
        <div className="flex items-center justify-between p-4 pb-3">
          <div className="flex items-center gap-2">
            <IconInfra size={18} className="text-primary" />
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              {t('dashboard.infrastructure.title', { defaultValue: 'Infrastructure' })}
            </h2>
          </div>
          <button
            onClick={() => navigate('/infra')}
            className="text-xs font-semibold text-primary cursor-pointer"
          >
            {t('common.viewMore', { defaultValue: 'View More' })}
          </button>
        </div>
        <div className="px-3 pb-3">
          {resourceLoading ? (
            <div className="space-y-1.5">
              {[1, 2].map(i => (
                <div key={i} className="flex items-center gap-3 p-2.5 rounded-lg bg-slate-50 dark:bg-ui-hover-dark animate-pulse">
                  <div className="w-2 h-2 rounded-full bg-slate-200 dark:bg-ui-active-dark shrink-0" />
                  <div className="flex-1 h-3 bg-slate-200 dark:bg-ui-active-dark rounded" />
                  <div className="w-12 h-3 bg-slate-200 dark:bg-ui-active-dark rounded" />
                </div>
              ))}
            </div>
          ) : !resources || resources.length === 0 ? (
            <div className="rounded-xl border-2 border-dashed border-slate-200 dark:border-ui-border-dark bg-slate-50/50 dark:bg-ui-hover-dark/30 flex flex-col items-center justify-center py-6 text-center">
              <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-ui-hover-dark flex items-center justify-center mb-2">
                <IconInfra size={20} className="text-slate-400" />
              </div>
              <p className="text-xs font-medium text-slate-400 dark:text-text-dim-dark">
                {t('dashboard.infrastructure.empty', { defaultValue: 'No hosts registered' })}
              </p>
              <button
                onClick={() => navigate('/infra')}
                className="mt-2 text-xs font-semibold text-primary hover:text-primary/80 transition-colors cursor-pointer"
              >
                {t('dashboard.infrastructure.add', { defaultValue: 'Add Infrastructure' })} →
              </button>
            </div>
          ) : (
            <div className="space-y-1.5">
              {resources.slice(0, 3).map(res => (
                <button
                  key={res.id}
                  onClick={() => navigate(`/infra/${res.id}`)}
                  className="w-full flex items-center gap-3 py-2.5 pl-2.5 pr-1 rounded-lg hover:bg-slate-50 dark:hover:bg-ui-hover-dark active:bg-slate-100 dark:active:bg-ui-active-dark transition-colors text-left cursor-pointer"
                >
                  <span className={`w-2 h-2 rounded-full shrink-0 ${resourceStatusDot[res.status] || 'bg-slate-400'}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800 dark:text-text-base-dark truncate">
                      {res.name}
                    </p>
                  </div>
                  <span className={`text-xs font-bold capitalize ${resourceStatusText[res.status] || 'text-slate-400'}`}>
                    {res.status}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="mx-4 h-px bg-slate-200 dark:bg-ui-border-dark" />
      </section>

      {/* Recent Events */}
      <IncidentTimeline />
    </div>
  );
}
