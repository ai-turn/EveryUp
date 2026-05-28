import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useIsMobile } from '../../hooks/useMediaQuery';
import { LogListDesktopView } from '../../features/logs/components/LogListDesktopView';
import { LogListMobileView } from '../../features/logs/components/LogListMobileView';
import { api, type Service, type LogEntry } from '../../services/api';

export function LogListPage() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  const [searchQuery, setSearchQuery] = useState('');
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [latestLogs, setLatestLogs] = useState<Record<string, LogEntry | null>>({});
  const [serviceLogs, setServiceLogs] = useState<Record<string, LogEntry[]>>({});

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

  useEffect(() => {
    fetchServices();
  }, [fetchServices]);

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
    searchQuery,
    onSearchChange: setSearchQuery,
    onAddService: () => navigate('/logs/new'),
    onServiceClick: (id: string) => navigate(`/logs/${id}`),
  } as const;

  if (isMobile) return <LogListMobileView {...sharedProps} />;
  return <LogListDesktopView {...sharedProps} />;
}
