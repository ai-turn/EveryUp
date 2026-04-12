import { createContext, useContext, useState, ReactNode, useCallback } from 'react';

interface SidePanelContextType {
  isOpen: boolean;
  title: string;
  content: ReactNode | null;
  openPanel: (title: string, content: ReactNode) => void;
  closePanel: () => void;
}

const SidePanelContext = createContext<SidePanelContextType | undefined>(undefined);

export function SidePanelProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState<ReactNode | null>(null);

  const openPanel = useCallback((title: string, content: ReactNode) => {
    setTitle(title);
    setContent(content);
    setIsOpen(true);
  }, []);

  const closePanel = useCallback(() => {
    setIsOpen(false);
    // Note: title and content are cleared after transition if needed, 
    // but usually kept for closing animation stability.
  }, []);

  return (
    <SidePanelContext.Provider value={{ isOpen, title, content, openPanel, closePanel }}>
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
