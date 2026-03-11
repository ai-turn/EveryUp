import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MaterialIcon } from '../components/common';
import { IconHealthCheck, IconLogs, IconInfra, IconAlerts, IconSettings } from '../components/icons/SidebarIcons';
import { useDashboardKPI, useDashboardServices, useDashboardIncidents, useMonitoringResources, useNotificationChannels } from '../hooks/useData';
import { api, type Service, type LogEntry } from '../services/api';
import { incidentTypeConfig } from '../mocks/configs';
import { relativeTime } from '../utils/formatters';


const logLevelBadge: Record<string, string> = {
  error:   'bg-red-500 text-white',
  warning: 'bg-amber-500 text-white',
  info:    'bg-blue-500 text-white',
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

export function DashboardMobile() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: kpiData, loading: kpiLoading } = useDashboardKPI();
  const { data: services, loading: svcLoading } = useDashboardServices();
  const { data: incidents } = useDashboardIncidents();
  const { data: resources, loading: resourceLoading } = useMonitoringResources();
  const { data: channels } = useNotificationChannels();
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

  const kpiColors: Record<string, string> = {
    primary: 'text-primary',
    red: 'text-red-500',
    emerald: 'text-emerald-500',
    amber: 'text-amber-500',
  };

  const kpiLabelMap: Record<string, string> = {
    'Total Services': 'dashboard.kpi.totalServices',
    'Active Alerts': 'dashboard.kpi.criticalAlerts',
    'Global Uptime': 'dashboard.kpi.overallUptime',
  };

  return (
    <div className="space-y-4">
      {/* KPI Strip */}
      <div className="flex gap-3 overflow-x-auto pb-1 -mx-4 px-4 scrollbar-hide">
        {kpiLoading ? (
          [1, 2, 3].map(i => (
            <div key={i} className="shrink-0 w-32 h-20 rounded-xl bg-slate-100 dark:bg-ui-hover-dark animate-pulse" />
          ))
        ) : (
          (kpiData || []).map(kpi => (
            <div
              key={kpi.label}
              onClick={kpi.href ? () => navigate(kpi.href!) : undefined}
              className={`shrink-0 flex-1 min-w-[110px] bg-white dark:bg-bg-surface-dark border border-slate-200 dark:border-ui-border-dark rounded-xl p-3 ${kpi.href ? 'active:scale-95 cursor-pointer' : ''}`}
            >
              <p className="text-xs font-medium text-slate-500 dark:text-text-muted-dark truncate">
                {kpiLabelMap[kpi.label] ? t(kpiLabelMap[kpi.label]) : kpi.label}
              </p>
              <p className={`text-xl font-bold ${kpiColors[kpi.color] || 'text-slate-900 dark:text-white'}`}>
                {kpi.value}
              </p>
              {kpi.subValue && (
                <p className="text-xs text-slate-400 dark:text-text-dim-dark">{kpi.subValue}</p>
              )}
            </div>
          ))
        )}
      </div>

      {/* Services Quick Status */}
      <section className="bg-white dark:bg-bg-surface-dark border border-slate-200 dark:border-ui-border-dark rounded-xl">
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
            <div className="py-6 text-center">
              <IconHealthCheck size={28} className="text-slate-300 dark:text-text-dim-dark block mx-auto" />
              <p className="text-xs font-medium text-slate-400 dark:text-text-muted-dark mt-2">
                {t('dashboard.emptyState')}
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
                    className="w-full flex items-center gap-3 p-2.5 rounded-lg hover:bg-slate-50 dark:hover:bg-ui-hover-dark active:bg-slate-100 dark:active:bg-ui-active-dark transition-colors text-left"
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
      </section>

      {/* Log Services */}
      <section className="bg-white dark:bg-bg-surface-dark border border-slate-200 dark:border-ui-border-dark rounded-xl">
        <div className="flex items-center justify-between p-4 pb-3">
          <div className="flex items-center gap-2">
            <IconLogs size={18} className="text-primary" />
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              {t('nav.logs')}
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
            <div className="py-6 text-center">
              <IconLogs size={28} className="text-slate-300 dark:text-text-dim-dark block mx-auto" />
              <p className="text-xs font-medium text-slate-400 dark:text-text-muted-dark mt-2">
                {t('dashboard.logServices.empty')}
              </p>
              <p className="text-xs text-slate-300 dark:text-text-dim-dark mt-0.5">
                {t('dashboard.logServices.emptyDesc')}
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
                            {latest.level === 'warning' ? 'WARN' : latest.level.toUpperCase()}
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
                          {t('dashboard.logServices.noLogs', { defaultValue: 'No logs yet' })}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* Infrastructure Quick Status */}
      <section className="bg-white dark:bg-bg-surface-dark border border-slate-200 dark:border-ui-border-dark rounded-xl">
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
            <div className="flex flex-col items-center justify-center py-6 text-center">
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
                {t('dashboard.infrastructure.addHost', { defaultValue: 'Add Host' })} →
              </button>
            </div>
          ) : (
            <div className="space-y-1.5">
              {resources.slice(0, 3).map(res => (
                <button
                  key={res.id}
                  onClick={() => navigate(`/infra/${res.id}`)}
                  className="w-full flex items-center gap-3 p-2.5 rounded-lg hover:bg-slate-50 dark:hover:bg-ui-hover-dark active:bg-slate-100 dark:active:bg-ui-active-dark transition-colors text-left cursor-pointer"
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
      </section>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => navigate('/alerts')}
          className="flex items-center gap-3 p-4 bg-white dark:bg-bg-surface-dark border border-slate-200 dark:border-ui-border-dark rounded-xl active:scale-95 transition-transform"
        >
          <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
            <IconAlerts size={20} className="text-amber-500" />
          </div>
          <div className="text-left">
            <p className="text-sm font-bold text-slate-900 dark:text-white">
              {t('nav.alerts')}
            </p>
            <p className="text-xs text-slate-400 dark:text-text-dim-dark">
              {(channels || []).filter(c => c.isEnabled).length} {t('dashboard.notifications.active')}
            </p>
          </div>
        </button>
        <button
          onClick={() => navigate('/settings')}
          className="flex items-center gap-3 p-4 bg-white dark:bg-bg-surface-dark border border-slate-200 dark:border-ui-border-dark rounded-xl active:scale-95 transition-transform"
        >
          <div className="w-10 h-10 rounded-lg bg-slate-500/10 flex items-center justify-center">
            <IconSettings size={20} className="text-slate-500" />
          </div>
          <div className="text-left">
            <p className="text-sm font-bold text-slate-900 dark:text-white">
              {t('nav.settings')}
            </p>
            <p className="text-xs text-slate-400 dark:text-text-dim-dark">
              {t('alerts.features.channels')}
            </p>
          </div>
        </button>
      </div>

      {/* Recent Events */}
      {incidents && incidents.length > 0 && (
        <section className="bg-white dark:bg-bg-surface-dark border border-slate-200 dark:border-ui-border-dark rounded-xl">
          <div className="flex items-center gap-2 p-4 pb-0">
            <MaterialIcon name="timeline" className="text-lg text-primary" />
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              {t('dashboard.timeline.title')}
            </h2>
          </div>
          <div className="p-3 space-y-1">
            {incidents.slice(0, 6).map(incident => {
              const incidentType = incident.type as keyof typeof incidentTypeConfig;
              const config = incidentTypeConfig[incidentType] || incidentTypeConfig.info;
              return (
                <div
                  key={incident.id}
                  className="flex items-start gap-3 p-2 rounded-lg"
                >
                  <MaterialIcon
                    name={config.icon}
                    className={`text-base mt-0.5 shrink-0 ${config.colorClasses.icon}`}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-slate-700 dark:text-text-base-dark">
                      <span className="font-semibold">{incident.serviceName}</span>{' '}
                      <span className="text-slate-500 dark:text-text-muted-dark">{incident.message}</span>
                    </p>
                  </div>
                  <span className="text-xs text-slate-400 dark:text-text-dim-dark shrink-0 mt-0.5">
                    {incident.time}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
