import { Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet, useParams } from 'react-router-dom';
import { MainLayout } from './components/layout';
import { NetworkStatusBanner } from './components/feedback/NetworkStatusBanner';
import { useAuth } from './contexts/AuthContext';
import { env } from './config/env';
import { lazyWithRetry as lazy } from './utils/lazyWithRetry';

const ServiceGridPage       = lazy(() => import('./pages/services/ServiceGridPage').then(m => ({ default: m.ServiceGridPage })));
const ProjectDetailPage     = lazy(() => import('./pages/services/ProjectDetailPage').then(m => ({ default: m.ProjectDetailPage })));
const HealthCheckDetailPage = lazy(() => import('./pages/healthcheck/HealthCheckDetailPage').then(m => ({ default: m.HealthCheckDetailPage })));
const AlertsPage            = lazy(() => import('./pages/alerts/AlertsPage').then(m => ({ default: m.AlertsPage })));
const SettingsPage          = lazy(() => import('./pages/settings/SettingsPage').then(m => ({ default: m.SettingsPage })));
const NotFoundPage          = lazy(() => import('./pages/NotFoundPage').then(m => ({ default: m.NotFoundPage })));
const LoginPage             = lazy(() => import('./pages/auth/LoginPage').then(m => ({ default: m.LoginPage })));
const ChannelFormPage       = lazy(() => import('./pages/alerts/ChannelFormPage').then(m => ({ default: m.ChannelFormPage })));
const AgentServiceCapabilityPage = lazy(() => import('./pages/capabilities/AgentServiceCapabilityPage').then(m => ({ default: m.AgentServiceCapabilityPage })));
const LogsPage              = lazy(() => import('./pages/capabilities/LogsPage').then(m => ({ default: m.LogsPage })));
const ApiPage               = lazy(() => import('./pages/capabilities/ApiPage').then(m => ({ default: m.ApiPage })));
const MetricsPage           = lazy(() => import('./pages/capabilities/MetricsPage').then(m => ({ default: m.MetricsPage })));
const InfrastructurePage    = lazy(() => import('./pages/capabilities/InfrastructurePage').then(m => ({ default: m.InfrastructurePage })));
const MorePage              = lazy(() => import('./pages/capabilities/MorePage').then(m => ({ default: m.MorePage })));
const ProjectsPage          = lazy(() => import('./pages/projects/ProjectsPage').then(m => ({ default: m.ProjectsPage })));

function PageLoader() {
  return (
    <div className="flex-1 p-4 sm:p-6 md:p-8 space-y-4 animate-pulse">
      <div className="h-8 bg-ui-active rounded-lg w-48" />
      <div className="h-4 bg-ui-hover rounded w-72" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-40 bg-ui-hover rounded-xl" />
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

function LegacyAgentProjectRoute() {
  const { agentId } = useParams();
  return <Navigate to={`/agents/${agentId ?? ''}`} replace />;
}

function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <NetworkStatusBanner />
      <div className="bg-bg-main text-text-base transition-colors duration-200">
        <Suspense fallback={<PageLoader />}>
          <Routes>
            {/* 데모 모드에서는 /login 접근 시 홈으로 리다이렉트 */}
            <Route path="/login" element={env.isDemoMode ? <Navigate to="/" replace /> : <LoginPage />} />
            <Route element={<ProtectedRoute />}>
              <Route element={<MainLayout />}>
                <Route index element={<ServiceGridPage />} />
                <Route path="/agents" element={<Navigate to="/" replace />} />
                <Route path="/services" element={<Navigate to="/uptime" replace />} />
                <Route path="/uptime" element={<AgentServiceCapabilityPage />} />
                <Route path="/logs" element={<LogsPage />} />
                <Route path="/infrastructure" element={<InfrastructurePage />} />
                <Route path="/api" element={<ApiPage />} />
                <Route path="/metrics" element={<MetricsPage />} />
                <Route path="/more" element={<MorePage />} />
                <Route path="/projects" element={<ProjectsPage />} />
                <Route path="/agents/:agentId" element={<ProjectDetailPage />} />
                <Route path="/projects/:agentId" element={<LegacyAgentProjectRoute />} />
                <Route path="/services/:agentId/:key" element={<HealthCheckDetailPage />} />
                <Route path="/alerts" element={<AlertsPage />} />
                <Route path="/alerts/channels/new" element={<ChannelFormPage />} />
                <Route path="/alerts/channels/:id/edit" element={<ChannelFormPage />} />
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
