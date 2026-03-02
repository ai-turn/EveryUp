import { useTranslation } from 'react-i18next';
import { Timeline } from '../../../components/common';
import { useDashboardIncidents } from '../../../hooks/useData';
import { incidentTypeConfig } from '../../../mocks/configs';
import { TableSkeleton } from '../../../components/skeleton';

export function IncidentTimeline() {
  const { t } = useTranslation();
  const { data: incidents, loading, error } = useDashboardIncidents();

  if (loading) {
    return <TableSkeleton rows={4} columns={3} />;
  }

  if (error) {
    return (
      <div className="bg-white dark:bg-bg-surface-dark border border-slate-200 dark:border-ui-border-dark rounded-xl p-6">
        <p className="text-red-500 text-sm">{t('common.error')}</p>
      </div>
    );
  }

  const events = (incidents || []).map(incident => {
    const incidentType = incident.type as keyof typeof incidentTypeConfig;
    const config = incidentTypeConfig[incidentType] || incidentTypeConfig.info;
    return {
      id: incident.id,
      time: incident.time,
      icon: config.icon,
      iconColorClass: config.colorClasses.icon,
      content: (
        <p>
          <span className="font-semibold">{incident.serviceName}</span>{' '}
          <span>{incident.message}</span>
        </p>
      )
    };
  });

  return (
    <Timeline
      title={t('dashboard.timeline.title')}
      events={events}
      emptyMessage={t('dashboard.timeline.empty')}
      action={{
        label: t('dashboard.timeline.history'),
        onClick: () => console.log('View history clicked')
      }}
    />
  );
}
