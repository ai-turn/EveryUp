import { createContext, useContext, useState, ReactNode, useCallback } from 'react';

export type SidePanelSize = 'default' | 'wide';

interface SidePanelContextType {
  isOpen: boolean;
  title: string;
  content: ReactNode | null;
  size: SidePanelSize;
  openPanel: (title: string, content: ReactNode, size?: SidePanelSize) => void;
  closePanel: () => void;
}

const SidePanelContext = createContext<SidePanelContextType | undefined>(undefined);

export function SidePanelProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState<ReactNode | null>(null);
  const [size, setSize] = useState<SidePanelSize>('default');

  const openPanel = useCallback((title: string, content: ReactNode, size: SidePanelSize = 'default') => {
    setTitle(title);
    setContent(content);
    setSize(size);
    setIsOpen(true);
  }, []);

  const closePanel = useCallback(() => {
    setIsOpen(false);
    // Note: title and content are cleared after transition if needed, 
    // but usually kept for closing animation stability.
  }, []);

  return (
    <SidePanelContext.Provider value={{ isOpen, title, content, size, openPanel, closePanel }}>
      {children}
    </SidePanelContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useSidePanel() {
  const context = useContext(SidePanelContext);
  if (context === undefined) {
    throw new Error('useSidePanel must be used within a SidePanelProvider');
  }
  return context;
}
