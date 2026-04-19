import { Service } from '../../../services/api';
import { ApiCaptureSettings } from '../../api-requests/components/ApiCaptureSettings';

interface Props {
  service: Service;
  onSuccess: (updated: Service) => void;
}

// Log-level filter has moved into the service header popover (LogServiceIdentity).
// This tab now hosts the API capture configuration only.
export function LogServiceSettings({ service }: Props) {
  return <ApiCaptureSettings serviceId={service.id} />;
}
