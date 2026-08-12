import type { ObservedService } from '../../../services/api';
import { DirectTelemetrySetupDialog } from '../../telemetry/components/DirectTelemetrySetupDialog';

interface DirectLogsSetupDialogProps {
  onClose: () => void;
  onCreated: (service: ObservedService) => void;
}

export function DirectLogsSetupDialog(props: DirectLogsSetupDialogProps) {
  return (
    <DirectTelemetrySetupDialog
      {...props}
      signal="logs"
      capabilityLabel="Logs"
      title="Logs 직접 연결"
      description="Agent 없이 애플리케이션의 OTLP 로그를 연결합니다."
    />
  );
}
