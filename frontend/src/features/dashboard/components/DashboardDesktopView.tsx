import { ServiceHealthGrid } from './ServiceHealthGrid';
import { ResourceStatusGrid } from './ResourceStatusGrid';
import { LogServicesGrid } from './LogServicesGrid';
import { IncidentTimeline } from './IncidentTimeline';
import { NotificationChannelStatus } from './NotificationChannelStatus';
import { AlertRulesStatus } from './AlertRulesStatus';

export function DashboardDesktopView() {
  return (
    <div className="space-y-8">
      <ServiceHealthGrid maxItems={3} />
      <LogServicesGrid />
      <ResourceStatusGrid />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <NotificationChannelStatus />
        <AlertRulesStatus />
      </div>
      <IncidentTimeline />
    </div>
  );
}
