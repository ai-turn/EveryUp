import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MaterialIcon } from '../components/common';
import { useDashboardKPI, useDashboardServices, useDashboardIncidents, useMonitoringResources, useNotificationChannels } from '../hooks/useData';
import { api, type Service } from '../services/api';
import { incidentTypeConfig } from '../mocks/configs';

const statusColors: Record<string, { dot: string; text: string }> = {
  healthy: { dot: 'bg-emerald-500', text: 'text-emerald-600 dark:text-emerald-400' },
  degraded: { dot: 'bg-amber-500', text: 'text-amber-600 dark:text-amber-400' },
  warning: { dot: 'bg-amber-500', text: 'text-amber-600 dark:text-amber-400' },
  offline: { dot: 'bg-red-500', text: 'text-red-600 dark:text-red-400' },
};

const resourceStatusDot: Record<string, string> = {
  healthy: 'bg-emerald-500',
  warning: 'bg-amber-500',
  critical: 'bg-red-500',
  error: 'bg-red-500',
};

const resourceStatusText: Record<string, string> = {
  healthy: 'text-emerald-600 dark:text-emerald-400',
  warning: 'text-amber-600 dark:text-amber-400',
  critical: 'text-red-600 dark:text-red-400',
  error: 'text-red-600 dark:text-red-400',
};

export function DashboardMobile() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: kpiData, loading: kpiLoading } = useDashboardKPI();
  const { data: services, loading: svcLoading } = useDashboardServices();
  const { data: incidents } = useDashboardIncidents();
  const { data: resources } = useMonitoringResources();
  const { data: channels } = useNotificationChannels();
  const [logServices, setLogServices] = useState<Service[]>([]);

  const fetchLogServices = useCallback(async () => {
    try {
      const data = await api.getServices();
      setLogServices(data.filter(s => s.type === 'log'));
    } catch {
      // non-critical
    }
  }, []);

  useEffect(() => {
    fetchLogServices();
  }, [fetchLogServices]);

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
              <p className="text-[11px] font-medium text-slate-500 dark:text-text-muted-dark truncate">
                {kpiLabelMap[kpi.label] ? t(kpiLabelMap[kpi.label]) : kpi.label}
              </p>
              <p className={`text-xl font-bold ${kpiColors[kpi.color] || 'text-slate-900 dark:text-white'}`}>
                {kpi.value}
              </p>
              {kpi.subValue && (
                <p className="text-[10px] text-slate-400 dark:text-text-dim-dark">{kpi.subValue}</p>
              )}
            </div>
          ))
        )}
      </div>

      {/* Services Quick Status */}
      <section className="bg-white dark:bg-bg-surface-dark border border-slate-200 dark:border-ui-border-dark rounded-xl">
        <div className="flex items-center justify-between p-4 pb-0">
          <div className="flex items-center gap-2">
            <MaterialIcon name="monitor_heart" className="text-lg text-primary" />
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
              <MaterialIcon name="monitor_heart" className="text-3xl text-slate-300 dark:text-text-dim-dark" />
              <p className="text-xs text-slate-400 dark:text-text-muted-dark mt-1">
                {t('dashboard.emptyState')}
              </p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {services.slice(0, 5).map(svc => {
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
      {logServices.length > 0 && (
        <section className="bg-white dark:bg-bg-surface-dark border border-slate-200 dark:border-ui-border-dark rounded-xl">
          <div className="flex items-center justify-between p-4 pb-0">
            <div className="flex items-center gap-2">
              <MaterialIcon name="article" className="text-lg text-primary" />
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                {t('dashboard.logServices.title', { defaultValue: 'Log Services' })}
              </h2>
            </div>
            <button
              onClick={() => navigate('/logs')}
              className="text-xs font-semibold text-primary"
            >
              {t('common.viewMore', { defaultValue: 'View More' })}
            </button>
          </div>
          <div className="p-3">
            <div className="space-y-1.5">
              {logServices.slice(0, 4).map(svc => {
                const svcStatus = svc.status === 'healthy' ? statusColors.healthy
                  : svc.status === 'unhealthy' ? statusColors.offline
                  : statusColors.warning;
                return (
                  <button
                    key={svc.id}
                    onClick={() => navigate(`/logs/${svc.id}`)}
                    className="w-full flex items-center gap-3 p-2.5 rounded-lg hover:bg-slate-50 dark:hover:bg-ui-hover-dark active:bg-slate-100 dark:active:bg-ui-active-dark transition-colors text-left"
                  >
                    <span className={`w-2 h-2 rounded-full shrink-0 ${svcStatus.dot}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-800 dark:text-text-base-dark truncate">
                        {svc.name}
                      </p>
                    </div>
                    <span className="text-[11px] font-mono text-slate-500 dark:text-text-muted-dark shrink-0">
                      {svc.tags?.[0] || svc.type}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* Infrastructure Quick Status */}
      {resources && resources.length > 0 && (
        <section className="bg-white dark:bg-bg-surface-dark border border-slate-200 dark:border-ui-border-dark rounded-xl">
          <div className="flex items-center justify-between p-4 pb-0">
            <div className="flex items-center gap-2">
              <MaterialIcon name="dns" className="text-lg text-primary" />
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                {t('dashboard.infrastructure.title', { defaultValue: 'Infrastructure' })}
              </h2>
            </div>
            <button
              onClick={() => navigate('/infra')}
              className="text-xs font-semibold text-primary"
            >
              {t('common.viewMore', { defaultValue: 'View More' })}
            </button>
          </div>
          <div className="p-3">
            <div className="space-y-1.5">
              {resources.slice(0, 4).map(res => (
                <button
                  key={res.id}
                  onClick={() => navigate(`/infra/${res.id}`)}
                  className="w-full flex items-center gap-3 p-2.5 rounded-lg hover:bg-slate-50 dark:hover:bg-ui-hover-dark active:bg-slate-100 dark:active:bg-ui-active-dark transition-colors text-left"
                >
                  <span className={`w-2 h-2 rounded-full shrink-0 ${resourceStatusDot[res.status] || 'bg-slate-400'}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800 dark:text-text-base-dark truncate">
                      {res.name}
                    </p>
                  </div>
                  <span className={`text-[11px] font-bold capitalize ${resourceStatusText[res.status] || 'text-slate-400'}`}>
                    {res.status}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => navigate('/alerts')}
          className="flex items-center gap-3 p-4 bg-white dark:bg-bg-surface-dark border border-slate-200 dark:border-ui-border-dark rounded-xl active:scale-95 transition-transform"
        >
          <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
            <MaterialIcon name="notifications_active" className="text-xl text-amber-500" />
          </div>
          <div className="text-left">
            <p className="text-sm font-bold text-slate-900 dark:text-white">
              {t('nav.alerts')}
            </p>
            <p className="text-[11px] text-slate-400 dark:text-text-dim-dark">
              {(channels || []).filter(c => c.isEnabled).length} {t('dashboard.notifications.active')}
            </p>
          </div>
        </button>
        <button
          onClick={() => navigate('/settings')}
          className="flex items-center gap-3 p-4 bg-white dark:bg-bg-surface-dark border border-slate-200 dark:border-ui-border-dark rounded-xl active:scale-95 transition-transform"
        >
          <div className="w-10 h-10 rounded-lg bg-slate-500/10 flex items-center justify-center">
            <MaterialIcon name="settings" className="text-xl text-slate-500" />
          </div>
          <div className="text-left">
            <p className="text-sm font-bold text-slate-900 dark:text-white">
              {t('nav.settings')}
            </p>
            <p className="text-[11px] text-slate-400 dark:text-text-dim-dark">
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
                  <span className="text-[10px] text-slate-400 dark:text-text-dim-dark shrink-0 mt-0.5">
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
