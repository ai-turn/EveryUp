import { AlertsMobile } from './AlertsPage.mobile';
import { AlertsDesktop } from './AlertsPage.desktop';
import { useIsMobile } from '../hooks/useMediaQuery';

export function AlertsPage() {
  const isMobile = useIsMobile();

  if (isMobile) return <AlertsMobile />;

  return <AlertsDesktop />;
}
