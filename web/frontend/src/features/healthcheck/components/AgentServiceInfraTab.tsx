import { InfraGauges } from '../../infra/components/InfraGauges';
import { InfraTrends } from '../../infra/components/InfraTrends';

interface Props {
  agentId: string;
  refreshKey: number;
}

export function AgentServiceInfraTab({ agentId, refreshKey }: Props) {
  return (
    <div>
      <InfraGauges hostId={agentId} refreshKey={refreshKey} />
      <InfraTrends hostId={agentId} refreshKey={refreshKey} />
    </div>
  );
}
