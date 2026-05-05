import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useIsMobile } from '../hooks/useMediaQuery';
import { LogListDesktopView } from '../features/logs/components/LogListDesktopView';
import { LogListMobileView } from '../features/logs/components/LogListMobileView';
import { api, type Service, type LogEntry } from '../services/api';

export type LogListTab = 'services' | 'stream' | 'errors';

export function LogListPage() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<LogListTab>('services');

  // Services tab state
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [latestLogs, setLatestLogs] = useState<Record<string, LogEntry | null>>({});
  const [serviceLogs, setServiceLogs] = useState<Record<string, LogEntry[]>>({});

  // Stream / Errors tab state
  const [streamLogs, setStreamLogs] = useState<LogEntry[]>([]);
  const [streamLoading, setStreamLoading] = useState(false);
  const [errorLogs, setErrorLogs] = useState<LogEntry[]>([]);
  const [errorsLoading, setErrorsLoading] = useState(false);

  const fetchServices = useCallback(async () => {
    try {
      const data = await api.getServices();
      const logServices = data.filter((s) => s.type === 'log');
      setServices(logServices);
      setError(null);
      const entries = await Promise.all(
        logServices.map(async (svc) => {
          try {
            const logs = await api.getServiceLogs(svc.id, { limit: '24' });
            return [svc.id, logs] as const;
          } catch {
            return [svc.id, []] as const;
          }
        })
      );
      const nextServiceLogs = Object.fromEntries(entries);
      setServiceLogs(nextServiceLogs);
      setLatestLogs(
        Object.fromEntries(entries.map(([id, logs]) => [id, logs[0] ?? null]))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch services');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchStreamLogs = useCallback(async () => {
    setStreamLoading(true);
    try {
      const data = await api.getLogs({ limit: '100' });
      setStreamLogs(data);
    } catch {
      // non-critical
    } finally {
      setStreamLoading(false);
    }
  }, []);

  const fetchErrorLogs = useCallback(async () => {
    setErrorsLoading(true);
    try {
      const [errors, warns] = await Promise.all([
        api.getLogs({ level: 'error', limit: '50' }),
        api.getLogs({ level: 'warn', limit: '50' }),
      ]);
      const combined = [...errors, ...warns].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      setErrorLogs(combined);
    } catch {
      // non-critical
    } finally {
      setErrorsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchServices();
  }, [fetchServices]);

  useEffect(() => {
    if (activeTab === 'stream') fetchStreamLogs();
    if (activeTab === 'errors') fetchErrorLogs();
  }, [activeTab, fetchStreamLogs, fetchErrorLogs]);

  const filteredServices = services.filter((s) =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (s.tags?.[0] || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const sharedProps = {
    services,
    filteredServices,
    latestLogs,
    serviceLogs,
    loading,
    error,
    activeTab,
    searchQuery,
    streamLogs,
    streamLoading,
    errorLogs,
    errorsLoading,
    onTabChange: setActiveTab,
    onSearchChange: setSearchQuery,
    onAddService: () => navigate('/logs/new'),
    onServiceClick: (id: string) => navigate(`/logs/${id}`),
    onRefreshStream: fetchStreamLogs,
    onRefreshErrors: fetchErrorLogs,
  } as const;

  if (isMobile) return <LogListMobileView {...sharedProps} />;
  return <LogListDesktopView {...sharedProps} />;
}
