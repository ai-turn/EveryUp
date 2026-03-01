import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { MainLayout } from './components/layout';
import { NetworkStatusBanner } from './components/feedback/NetworkStatusBanner';
import {
  DashboardPage,
  ServiceDetailPage,
  ServicesPage,
  LogListPage,
  LogDetailPage,
  MonitoringPage,
  MonitoringListPage,
  AlertsSetupPage,
  SettingsPage,
  NotFoundPage,
  LoginPage,
} from './pages';
import { useAuth } from './contexts/AuthContext';
import { env } from './config/env';

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
        <Routes>
          {/* 데모 모드에서는 /login 접근 시 홈으로 리다이렉트 */}
          <Route path="/login" element={env.isDemoMode ? <Navigate to="/" replace /> : <LoginPage />} />
          <Route element={<ProtectedRoute />}>
            <Route element={<MainLayout />}>
              <Route index element={<DashboardPage />} />
              <Route path="/services" element={<ServicesPage />} />
              <Route path="/services/:serviceId" element={<ServiceDetailPage />} />
              <Route path="/logs" element={<LogListPage />} />
              <Route path="/logs/:serviceId" element={<LogDetailPage />} />
              <Route path="/monitoring" element={<MonitoringListPage />} />
              <Route path="/monitoring/:resourceId" element={<MonitoringPage />} />
              <Route path="/alerts" element={<AlertsSetupPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="*" element={<NotFoundPage />} />
            </Route>
          </Route>
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;
