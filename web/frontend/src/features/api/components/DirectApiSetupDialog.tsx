import type { ObservedService } from '../../../services/api';
import { DirectTelemetrySetupDialog } from '../../telemetry/components/DirectTelemetrySetupDialog';

interface DirectApiSetupDialogProps {
  onClose: () => void;
  onCreated: (service: ObservedService) => void;
}

export function DirectApiSetupDialog(props: DirectApiSetupDialogProps) {
  return (
    <DirectTelemetrySetupDialog
      {...props}
      signal="traces"
      capabilityLabel="API"
      title="API 직접 연결"
      description="애플리케이션의 OTLP traces를 직접 연결합니다."
    />
  );
}
