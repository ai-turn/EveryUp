import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Toaster } from 'react-hot-toast'
import './index.css'
import './i18n.ts';
import App from './App.tsx'
import { ErrorBoundary } from './components/error/index.ts'
import { AppProviders } from './components/AppProviders.tsx'

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
                primary: 'var(--color-status-healthy)',
                secondary: '#fff',
              },
            },
            error: {
              duration: 5000,
              iconTheme: {
                primary: 'var(--color-status-error)',
                secondary: '#fff',
              },
            },
          }}
        />
      </AppProviders>
    </ErrorBoundary>
  </StrictMode>,
)
