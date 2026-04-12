import { RadialGauge } from '../../../components/charts/RadialGauge';
import { useMonitoringGauges } from '../../../hooks/useInfra';
import { Skeleton } from '../../../components/skeleton';

interface InfraGaugesProps {
  hostId: string;
}

export function InfraGauges({ hostId }: InfraGaugesProps) {
  const { data: gauges, loading } = useMonitoringGauges(hostId);

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-48 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
      {(gauges || []).map((gauge) => (
        <RadialGauge key={gauge.label} {...gauge} />
      ))}
    </div>
  );
}
