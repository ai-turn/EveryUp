import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Timeline, MaterialIcon } from '../../../components/common';
import { useDashboardIncidents } from '../../../hooks/useDashboard';
import { incidentTypeConfig } from '../../../constants';
import { TableSkeleton } from '../../../components/skeleton';
import { useIsMobile } from '../../../hooks/useMediaQuery';

export function IncidentTimeline() {
  const { t } = useTranslation(['dashboard', 'common']);
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { data: incidents, loading, error } = useDashboardIncidents();

  const handleIncidentClick = (serviceId?: string) => {
    if (serviceId) navigate(`/healthcheck/${serviceId}`);
  };

  /* ── Mobile layout ─────────────────────────────────────────── */
  if (isMobile) {
    return (
      <section>
        {/* Header */}
        <div className="flex items-center p-4 pb-3">
          <MaterialIcon name="history" className="text-primary text-lg mr-2" />
          <h2 className="text-sm font-bold text-slate-900 dark:text-white">
            {t('dashboard.timeline.title')}
          </h2>
        </div>

        <div className="px-3 pb-3">
          {loading ? (
            <div className="space-y-1">
              {[1, 2, 3].map(i => (
                <div key={i} className="flex items-center gap-3 py-2.5 px-1">
                  <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-ui-hover-dark animate-pulse shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3 w-28 bg-slate-100 dark:bg-ui-hover-dark animate-pulse rounded" />
                    <div className="h-2.5 w-40 bg-slate-100 dark:bg-ui-hover-dark animate-pulse rounded" />
                  </div>
                  <div className="w-12 h-3 bg-slate-100 dark:bg-ui-hover-dark animate-pulse rounded shrink-0" />
                </div>
              ))}
            </div>
          ) : error || !incidents || incidents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-6 text-center">
              <MaterialIcon name="check_circle" className="text-3xl text-emerald-400 dark:text-emerald-500 mb-2" />
              <p className="text-xs font-medium text-slate-400 dark:text-text-muted-dark">
                {t('dashboard.timeline.empty')}
              </p>
            </div>
          ) : (
            <div className="space-y-0.5">
              {incidents.map(incident => {
                const config = incidentTypeConfig[incident.type as keyof typeof incidentTypeConfig] ?? incidentTypeConfig.info;
                const clickable = !!incident.serviceId;
                return (
                  <div
                    key={incident.id}
                    onClick={() => handleIncidentClick(incident.serviceId)}
                    className={`flex items-center gap-3 py-2.5 px-1 min-h-11 rounded-lg transition-colors ${clickable ? 'cursor-pointer active:bg-slate-50 dark:active:bg-ui-hover-dark' : ''}`}
                    style={{ touchAction: 'manipulation' }}
                  >
                    {/* Status icon */}
                    <div className={`w-8 h-8 rounded-lg ${config.colorClasses.bg} flex items-center justify-center shrink-0`}>
                      <MaterialIcon name={config.icon} className={`text-sm ${config.colorClasses.icon}`} />
                    </div>
                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-800 dark:text-text-base-dark truncate">
                        {incident.serviceName}
                      </p>
                      <p className="text-xs text-slate-400 dark:text-text-dim-dark truncate">
                        {incident.message}
                      </p>
                    </div>
                    {/* Time / chevron */}
                    <span className="text-xs text-slate-400 dark:text-text-dim-dark shrink-0 font-mono">
                      {incident.time}
                    </span>
                    {clickable && (
                      <MaterialIcon name="chevron_right" className="text-slate-300 dark:text-text-dim-dark text-base shrink-0" />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="mx-4 h-px bg-slate-200 dark:bg-ui-border-dark" />
      </section>
    );
  }

  /* ── Desktop layout ─────────────────────────────────────────── */
  const events = loading ? [] : (incidents || []).map(incident => {
    const config = incidentTypeConfig[incident.type as keyof typeof incidentTypeConfig] ?? incidentTypeConfig.info;
    return {
      id: incident.id,
      time: incident.time,
      icon: config.icon,
      iconColorClass: config.colorClasses.icon,
      onClick: incident.serviceId ? () => handleIncidentClick(incident.serviceId) : undefined,
      content: (
        <p>
          <span className="font-semibold">{incident.serviceName}</span>{' '}
          <span>{incident.message}</span>
        </p>
      )
    };
  });

  return (
    <div>
      {/* Header */}
      <div className="flex items-center mb-6">
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">
          {t('dashboard.timeline.title')}
        </h2>
      </div>

      {loading ? (
        <TableSkeleton rows={4} columns={3} />
      ) : error ? (
        <div className="bg-white dark:bg-bg-surface-dark border border-slate-300 dark:border-ui-border-dark rounded-xl p-6">
          <p className="text-red-500 text-sm">{t('common.error')}</p>
        </div>
      ) : (
        <Timeline
          events={events}
          emptyMessage={t('dashboard.timeline.empty')}
        />
      )}
    </div>
  );
}
