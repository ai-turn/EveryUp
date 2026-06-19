import { DashboardDesktopView } from '../../features/dashboard/components/DashboardDesktopView';
import { DashboardMobileView } from '../../features/dashboard/components/DashboardMobileView';
import { useIsMobile } from '../../hooks/useMediaQuery';

export function DashboardPage() {
  const isMobile = useIsMobile();

  if (isMobile) return <DashboardMobileView />;

  return <DashboardDesktopView />;
}
