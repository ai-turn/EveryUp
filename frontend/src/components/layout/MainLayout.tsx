import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { Footer } from './Footer';
import { DemoBanner } from './DemoBanner';
import { useSidebar } from '../../contexts/SidebarContext';
import { SidePanel } from './SidePanel';
import { useSidePanel } from '../../contexts/SidePanelContext';

export function MainLayout() {
  const { isCollapsed, toggleSidebar } = useSidebar();
  const { isOpen: isPanelOpen } = useSidePanel();

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-background-light dark:bg-bg-main-dark">
      {/* 0. Demo Banner (only in demo mode) */}
      <DemoBanner />

      {/* 1. Header (Full Width) */}
      <Header />

      {/* 2. Middle Area (Sidebar + Content + SidePanel) */}
      <div className="flex flex-1 overflow-hidden relative">
        <Sidebar />

        <main className="flex-1 flex flex-col overflow-hidden relative min-w-0 bg-white dark:bg-bg-main-dark transition-all duration-500 ease-in-out">
          {/* Toolbar Area */}
          <div className="h-12 border-b border-slate-100 dark:border-ui-border-dark flex items-center px-2 shrink-0 gap-4">
            <button
              onClick={toggleSidebar}
              className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-ui-hover-dark text-slate-500 dark:text-text-muted-dark transition-colors"
              title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
            >
              <svg width="20" height="20" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path fillRule="evenodd" clipRule="evenodd" d="M6.245 2.5H14.5V12.5C14.5 13.0523 14.0523 13.5 13.5 13.5H6.245V2.5ZM4.995 2.5H1.5V12.5C1.5 13.0523 1.94772 13.5 2.5 13.5H4.995V2.5ZM0 1H1.5H14.5H16V2.5V12.5C16 13.8807 14.8807 15 13.5 15H2.5C1.11929 15 0 13.8807 0 12.5V2.5V1Z" fill="currentColor" />
              </svg>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto scroll-smooth">
            <div className="flex flex-col min-h-full">
              <div className="p-6 md:p-8 space-y-8 flex-1">
                <Outlet />
              </div>
              <Footer />
            </div>
          </div>
        </main>

        {/* Desktop Panel Space (Phantom for Push Effect) */}
        <div
          className={`hidden lg:block transition-all duration-500 ease-in-out flex-shrink-0 ${isPanelOpen ? 'lg:w-[500px] xl:w-[600px]' : 'w-0'
            }`}
        />

        <SidePanel />
      </div>
    </div>
  );
}
