import { useParams } from 'react-router-dom';
import { InfraDetailMobile } from './InfraDetailPage.mobile';
import { InfraDetailDesktop } from './InfraDetailPage.desktop';
import { useIsMobile } from '../hooks/useMediaQuery';

export function InfraDetailPage() {
  const { resourceId } = useParams();
  const isMobile = useIsMobile();
  const hostId = resourceId || 'local';

  if (isMobile) return <InfraDetailMobile hostId={hostId} />;

  return <InfraDetailDesktop hostId={hostId} />;
}
