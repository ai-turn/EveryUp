import { useEffect, type ReactNode } from 'react';
import { TolgeeProvider } from '@tolgee/react';
import { useTranslation } from 'react-i18next';
import { tolgee } from '../tolgee';
import { AuthProvider } from '../contexts/AuthContext';
import { ThemeProvider } from '../contexts/ThemeContext';
import { SidebarProvider } from '../contexts/SidebarContext';
import { SidePanelProvider } from '../contexts/SidePanelContext';

function TolgeeLanguageSync() {
  const { i18n } = useTranslation();
  useEffect(() => {
    tolgee.changeLanguage(i18n.language);
  }, [i18n.language]);
  return null;
}

/**
 * Composes all app-level React context providers in the required dependency order:
 *
 *   TolgeeProvider      — i18n for new code (source-as-key). Coexists with
 *                         react-i18next during the gradual migration.
 *     AuthProvider      — must wrap all authenticated UI
 *       ThemeProvider   — reads user theme preference (may depend on auth state)
 *         SidebarProvider — UI state (no external deps)
 *           SidePanelProvider — UI state (no external deps)
 *
 * If you add a new provider, document its position and reason here.
 */
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <TolgeeProvider tolgee={tolgee}>
      <TolgeeLanguageSync />
      <AuthProvider>
        <ThemeProvider>
          <SidebarProvider>
            <SidePanelProvider>
              {children}
            </SidePanelProvider>
          </SidebarProvider>
        </ThemeProvider>
      </AuthProvider>
    </TolgeeProvider>
  );
}
