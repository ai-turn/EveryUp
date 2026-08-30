import type { ReactNode } from 'react';
import { TolgeeProvider } from '@tolgee/react';
import { tolgee } from '../tolgee';
import { AuthProvider } from '../contexts/AuthContext';
import { ThemeProvider } from '../contexts/ThemeContext';
import { SidePanelProvider } from '../contexts/SidePanelContext';

/**
 * Composes all app-level React context providers in the required dependency order:
 *
 *   TolgeeProvider      — 한국어 전용. 문자열은 source-as-key로 원문이 곧 키다.
 *     AuthProvider      — must wrap all authenticated UI
 *       ThemeProvider   — reads user theme preference (may depend on auth state)
 *         SidePanelProvider — read-only side panel for detail viewers (e.g. API
 *                             request inspector). Form panels were converted to
 *                             route-based pages in v2; this provider only
 *                             remains for non-form drawers.
 *
 * If you add a new provider, document its position and reason here.
 */
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <TolgeeProvider tolgee={tolgee}>
      <AuthProvider>
        <ThemeProvider>
          <SidePanelProvider>
            {children}
          </SidePanelProvider>
        </ThemeProvider>
      </AuthProvider>
    </TolgeeProvider>
  );
}
