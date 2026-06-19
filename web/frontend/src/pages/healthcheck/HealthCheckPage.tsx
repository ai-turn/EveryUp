import { useState, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useIsMobile } from '../../hooks/useMediaQuery';
import { useDashboardServices } from '../../hooks/useDashboard';
import { api, type CheckEntry, type ServiceUptimeSummary } from '../../services/api';
import { HealthCheckDesktopView } from '../../features/healthcheck/components/HealthCheckDesktopView';
import { HealthCheckMobileView } from '../../features/healthcheck/components/HealthCheckMobileView';

export type HealthCheckTab = 'services' | 'history' | 'uptime';

export function HealthCheckPage() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const location = useLocation();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [activeTab, setActiveTab] = useState<HealthCheckTab>('services');
  const [refreshKey] = useState(0);

  const { data: services, loading, error } = useDashboardServices();

  const [recentChecks, setRecentChecks] = useState<CheckEntry[]>([]);
  const [failuresLoading, setFailuresLoading] = useState(false);

  const [uptimeSummary, setUptimeSummary] = useState<ServiceUptimeSummary[]>([]);
  const [uptimeLoading, setUptimeLoading] = useState(false);

  const loadFailures = useCallback(async () => {
    setFailuresLoading(true);
    try {
      const data = await api.getRecentChecks(300);
      setRecentChecks(data);
    } catch {
      // non-critical
    } finally {
      setFailuresLoading(false);
    }
  }, []);

  const loadUptimeSummary = useCallback(async () => {
    setUptimeLoading(true);
    try {
      const data = await api.getUptimeSummaryAll(90);
      setUptimeSummary(data);
    } catch {
      // non-critical
    } finally {
      setUptimeLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'history') loadFailures();
    if (activeTab === 'uptime') loadUptimeSummary();
  }, [activeTab, loadFailures, loadUptimeSummary]);

  const handleAddService = () => {
    navigate('/healthcheck/new');
  };

  useEffect(() => {
    if (location.state?.openAddModal) {
      handleAddService();
      window.history.replaceState({}, document.title);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state]);

  const sharedProps = {
    services: services || [],
    loading,
    error,
    searchQuery,
    statusFilter,
    activeTab,
    refreshKey,
    failures: recentChecks,
    failuresLoading,
    uptimeSummary,
    uptimeLoading,
    onSearchChange: setSearchQuery,
    onStatusFilterChange: setStatusFilter,
    onTabChange: setActiveTab,
    onAddService: handleAddService,
  } as const;

  if (isMobile) return <HealthCheckMobileView {...sharedProps} />;

  return <HealthCheckDesktopView {...sharedProps} />;
}
