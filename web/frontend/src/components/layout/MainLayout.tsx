import { Outlet } from 'react-router-dom';
import { Header } from './Header';
import { CommandPalette } from './CommandPalette';
import { Sidebar } from './Sidebar';
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

      {/* ⌘K / Ctrl+K project·service·page jumper */}
      <CommandPalette />

      {/* Content area: 좌측 Sidebar(lg+) + 우측 본문 */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Sidebar: lg 이상 데스크톱 전용 내비게이션 */}
        <Sidebar />

        {/* Right column: 모바일 Header + 본문 */}
        <div className="flex flex-1 flex-col overflow-hidden min-w-0">
          {/* Header: 모바일 전용 (lg 미만). 데스크톱은 Sidebar가 대체 */}
          <div className="lg:hidden">
            <Header />
          </div>

          <div className="flex flex-1 overflow-hidden relative">
            {/* ver2: full-bleed content on a slate-50 canvas (white cards pop), 24px/20px padding */}
            <main id="main-content" className="flex-1 flex flex-col overflow-hidden relative min-w-0 bg-slate-50 dark:bg-bg-main-dark transition-all duration-500 ease-in-out">
              <div className="flex-1 overflow-y-auto scroll-smooth [scrollbar-gutter:stable]">
                <div className="flex flex-col min-h-full pb-safe-bottom lg:pb-0">
                  <div className="p-4 sm:px-6 sm:py-5 space-y-5 flex-1 w-full">
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
        </div>
      </div>

      {/* Bottom Navigation: 모바일 전용 (lg 미만) */}
      <BottomNavMobile />
    </div>
  );
}
