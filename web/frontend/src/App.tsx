import { Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { MainLayout } from './components/layout';
import { NetworkStatusBanner } from './components/feedback/NetworkStatusBanner';
import { useAuth } from './contexts/AuthContext';
import { env } from './config/env';
import { lazyWithRetry as lazy } from './utils/lazyWithRetry';

const ServiceGridPage      = lazy(() => import('./pages/services/ServiceGridPage').then(m => ({ default: m.ServiceGridPage })));
const HealthCheckDetailPage = lazy(() => import('./pages/healthcheck/HealthCheckDetailPage').then(m => ({ default: m.HealthCheckDetailPage })));
const LogListPage          = lazy(() => import('./pages/logs/LogListPage').then(m => ({ default: m.LogListPage })));
const LogDetailPage        = lazy(() => import('./pages/logs/LogDetailPage').then(m => ({ default: m.LogDetailPage })));
const InfraPage            = lazy(() => import('./pages/infra/InfraPage').then(m => ({ default: m.InfraPage })));
const InfraDetailPage      = lazy(() => import('./pages/infra/InfraDetailPage').then(m => ({ default: m.InfraDetailPage })));
const AlertsPage           = lazy(() => import('./pages/alerts/AlertsPage').then(m => ({ default: m.AlertsPage })));
const SettingsPage         = lazy(() => import('./pages/settings/SettingsPage').then(m => ({ default: m.SettingsPage })));
const NotFoundPage         = lazy(() => import('./pages/NotFoundPage').then(m => ({ default: m.NotFoundPage })));
const LoginPage            = lazy(() => import('./pages/auth/LoginPage').then(m => ({ default: m.LoginPage })));

// Form pages (replace SidePanel-based forms in v2)
const ChannelFormPage      = lazy(() => import('./pages/alerts/ChannelFormPage').then(m => ({ default: m.ChannelFormPage })));
const AlertRuleFormPage    = lazy(() => import('./pages/alerts/AlertRuleFormPage').then(m => ({ default: m.AlertRuleFormPage })));
const InfraFormPage        = lazy(() => import('./pages/infra/InfraFormPage').then(m => ({ default: m.InfraFormPage })));
const LogServiceFormPage   = lazy(() => import('./pages/logs/LogServiceFormPage').then(m => ({ default: m.LogServiceFormPage })));
const LogServiceEditPage   = lazy(() => import('./pages/logs/LogServiceEditPage').then(m => ({ default: m.LogServiceEditPage })));

function PageLoader() {
  return (
    <div className="flex-1 p-4 sm:p-6 md:p-8 space-y-4 animate-pulse">
      <div className="h-8 bg-slate-200 dark:bg-ui-active-dark rounded-lg w-48" />
      <div className="h-4 bg-slate-100 dark:bg-ui-hover-dark rounded w-72" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-40 bg-slate-100 dark:bg-ui-hover-dark rounded-xl" />
        ))}
      </div>
    </div>
  );
}

function ProtectedRoute() {
  const { isAuthenticated } = useAuth();
  // 데모 모드에서는 인증 없이 통과
  if (env.isDemoMode) return <Outlet />;
  return isAuthenticated
    ? <Outlet />
    : <Navigate to="/login" replace state={{ from: location.pathname }} />;
}

function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <NetworkStatusBanner />
      <div className="bg-background-light dark:bg-bg-main-dark text-slate-900 dark:text-text-base-dark transition-colors duration-200">
        <Suspense fallback={<PageLoader />}>
          <Routes>
            {/* 데모 모드에서는 /login 접근 시 홈으로 리다이렉트 */}
            <Route path="/login" element={env.isDemoMode ? <Navigate to="/" replace /> : <LoginPage />} />
            <Route element={<ProtectedRoute />}>
              <Route element={<MainLayout />}>
                <Route index element={<ServiceGridPage />} />
                <Route path="/services" element={<Navigate to="/" replace />} />
                <Route path="/services/:agentId/:key" element={<HealthCheckDetailPage />} />
                <Route path="/logs" element={<LogListPage />} />
                <Route path="/logs/new" element={<LogServiceFormPage />} />
                <Route path="/logs/:serviceId/edit" element={<LogServiceEditPage />} />
                <Route path="/logs/:serviceId" element={<LogDetailPage />} />
                <Route path="/infra" element={<InfraPage />} />
                <Route path="/infra/new" element={<InfraFormPage />} />
                <Route path="/infra/:resourceId/edit" element={<InfraFormPage />} />
                <Route path="/infra/:resourceId" element={<InfraDetailPage />} />
                <Route path="/alerts" element={<AlertsPage />} />
                <Route path="/alerts/channels/new" element={<ChannelFormPage />} />
                <Route path="/alerts/channels/:id/edit" element={<ChannelFormPage />} />
                <Route path="/alerts/rules/new" element={<AlertRuleFormPage />} />
                <Route path="/alerts/rules/:id/edit" element={<AlertRuleFormPage />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="*" element={<NotFoundPage />} />
              </Route>
            </Route>
          </Routes>
        </Suspense>
      </div>
    </BrowserRouter>
  );
}

export default App;
