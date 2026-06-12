import { Outlet } from 'react-router-dom';
import { Header } from './Header';
import { Footer } from './Footer';
import { DemoBanner } from './DemoBanner';
import { BottomNavMobile } from './BottomNav.mobile';
import { SidePanel } from './SidePanel';
import { useSidePanel } from '../../contexts/SidePanelContext';

export function MainLayout() {
  const { isOpen: isPanelOpen } = useSidePanel();

  return (
    <div className="flex flex-col h-dvh overflow-hidden bg-background-light dark:bg-bg-main-dark">
      {/* Skip to main content (accessibility) */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-100 focus:px-4 focus:py-2 focus:bg-primary focus:text-white focus:rounded-lg focus:font-bold focus:text-sm focus:shadow-lg"
      >
        Skip to main content
      </a>

      <DemoBanner />

      {/* Header (with horizontal nav, replaces left Sidebar) */}
      <Header />

      {/* Content area */}
      <div className="flex flex-1 overflow-hidden relative">
        <main id="main-content" className="flex-1 flex flex-col overflow-hidden relative min-w-0 bg-white dark:bg-bg-main-dark transition-all duration-500 ease-in-out">
          <div className="flex-1 overflow-y-auto scroll-smooth [scrollbar-gutter:stable]">
            <div className="flex flex-col min-h-full pb-safe-bottom lg:pb-0">
              <div className="p-4 sm:p-6 md:p-8 space-y-8 flex-1 w-full max-w-320 mx-auto">
                <Outlet />
              </div>
              <Footer />
            </div>
          </div>
        </main>

        {/* SidePanel space (legacy — will be replaced by full pages in later phase) */}
        <div
          className={`hidden lg:block transition-all duration-500 ease-in-out flex-shrink-0 ${isPanelOpen ? 'lg:w-[500px] xl:w-[600px]' : 'w-0'
            }`}
        />

        <SidePanel />
      </div>

      {/* Bottom Navigation: 모바일 전용 (lg 미만) */}
      <BottomNavMobile />
    </div>
  );
}
