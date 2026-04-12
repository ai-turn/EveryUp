import { createContext, useContext, useState, ReactNode, useCallback } from 'react';

interface SidebarContextType {
  isCollapsed: boolean;
  toggleSidebar: () => void;
  setCollapsed: (collapsed: boolean) => void;
}

const SidebarContext = createContext<SidebarContextType | undefined>(undefined);

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    const stored = localStorage.getItem('sidebar-collapsed');
    return stored === 'true';
  });

  const setCollapsed = useCallback((collapsed: boolean) => {
    setIsCollapsed(collapsed);
    localStorage.setItem('sidebar-collapsed', String(collapsed));
  }, []);

  const toggleSidebar = useCallback(() => {
    setCollapsed(!isCollapsed);
  }, [isCollapsed, setCollapsed]);

  return (
    <SidebarContext.Provider value={{ isCollapsed, toggleSidebar, setCollapsed }}>
      {children}
    </SidebarContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useSidebar() {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error('useSidebar must be used within SidebarProvider');
  }
  return context;
}
