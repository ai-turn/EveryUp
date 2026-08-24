import type { ObservedService } from '../../../services/api';
import { DirectTelemetrySetupDialog } from '../../telemetry/components/DirectTelemetrySetupDialog';

interface DirectMetricsSetupDialogProps {
  onClose: () => void;
  onCreated: (service: ObservedService) => void;
}

export function DirectMetricsSetupDialog(props: DirectMetricsSetupDialogProps) {
  return (
    <DirectTelemetrySetupDialog
      {...props}
      signal="metrics"
      capabilityLabel="Metrics"
      title="Metrics 직접 연결"
      description="애플리케이션의 OTLP 메트릭을 직접 연결합니다."
    />
  );
}
