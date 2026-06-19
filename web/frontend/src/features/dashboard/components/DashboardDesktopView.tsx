import { ServiceHealthGrid } from './ServiceHealthGrid';
import { ResourceStatusGrid } from './ResourceStatusGrid';
import { LogServicesGrid } from './LogServicesGrid';
import { IncidentTimeline } from './IncidentTimeline';
import { NotificationChannelStatus } from './NotificationChannelStatus';
import { AlertRulesStatus } from './AlertRulesStatus';
import { ConnectedAgentsStatus } from './ConnectedAgentsStatus';

export function DashboardDesktopView() {
  return (
    <div className="space-y-10">
      <ServiceHealthGrid maxItems={3} />
      <LogServicesGrid />
      <ResourceStatusGrid />
      <ConnectedAgentsStatus />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        <NotificationChannelStatus />
        <AlertRulesStatus />
      </div>
      <IncidentTimeline />
    </div>
  );
}
