import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Toaster } from 'react-hot-toast'
import './index.css'
import './i18n.ts';
import App from './App.tsx'
import { ErrorBoundary } from './components/error/index.ts'
import { AppProviders } from './components/AppProviders.tsx'

const cssVars = getComputedStyle(document.documentElement);
const colorSuccess = cssVars.getPropertyValue('--color-success').trim() || '#10b981';
const colorError   = cssVars.getPropertyValue('--color-error').trim()   || '#ef4444';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <AppProviders>
        <App />
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 3000,
            style: {
              background: 'var(--toast-bg, #fff)',
              color: 'var(--toast-color, #1e293b)',
              border: '1px solid var(--toast-border, #e2e8f0)',
            },
            success: {
              iconTheme: {
                primary: colorSuccess,
                secondary: '#fff',
              },
            },
            error: {
              duration: 5000,
              iconTheme: {
                primary: colorError,
                secondary: '#fff',
              },
            },
          }}
        />
      </AppProviders>
    </ErrorBoundary>
  </StrictMode>,
)
