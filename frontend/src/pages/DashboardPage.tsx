import { KPISummary, ServiceHealthGrid, ResourceStatusGrid, LogServicesGrid, IncidentTimeline, NotificationChannelStatus, AlertRulesStatus } from '../features/dashboard';
import { DashboardMobile } from './DashboardPage.mobile';
import { useIsMobile } from '../hooks/useMediaQuery';

export function DashboardPage() {
  const isMobile = useIsMobile();

  if (isMobile) return <DashboardMobile />;

  return (
    <div className="space-y-8">
      <KPISummary />
      <ServiceHealthGrid maxItems={3} />
      <LogServicesGrid />
      <ResourceStatusGrid />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <NotificationChannelStatus />
        <AlertRulesStatus />
      </div>
      <IncidentTimeline />
    </div>
  );
}
