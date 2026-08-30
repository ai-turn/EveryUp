import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';
import {
  Button, EmptyState, MaterialIcon, PageHeader, SearchInput, StatusBadge,
} from '../../components/common';
import { UptimeMonitorDialog } from '../../features/uptime/components/UptimeMonitorDialog';
import { UptimeMonitorStatusBadge } from '../../features/uptime/components/UptimeMonitorStatusBadge';
import { UptimeTargetCard } from '../../features/uptime/components/UptimeTargetCard';
import { api, type AgentServiceFlat, type UptimeMonitor, type UptimeMonitorInput } from '../../services/api';
import { getErrorMessage } from '../../utils/errors';

function ServiceListSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
      {[0, 1, 2].map((item) => (
        <div key={item} className="h-36 animate-pulse rounded-xl border border-ui-border bg-bg-surface" />
      ))}
    </div>
  );
}


export function AgentServiceCapabilityPage() {

  const [agentServices, setAgentServices] = useState<AgentServiceFlat[]>([]);
  const [monitors, setMonitors] = useState<UptimeMonitor[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [services, configuredMonitors] = await Promise.all([
        api.getAllAgentServicesFlat(),
        api.getUptimeMonitors(),
      ]);
      setAgentServices(services ?? []);
      setMonitors(configuredMonitors ?? []);
    } catch (error) {
      setError(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const normalizedQuery = query.trim().toLowerCase();
  const filteredAgentServices = useMemo(() => agentServices.filter((service) => !normalizedQuery
    || service.name.toLowerCase().includes(normalizedQuery)
    || service.agentName.toLowerCase().includes(normalizedQuery)
    || service.endpoint.toLowerCase().includes(normalizedQuery)), [agentServices, normalizedQuery]);
  const filteredMonitors = useMemo(() => monitors.filter((monitor) => !normalizedQuery
    || monitor.name.toLowerCase().includes(normalizedQuery)
    || monitor.url.toLowerCase().includes(normalizedQuery)), [monitors, normalizedQuery]);

  const saveMonitor = async (input: UptimeMonitorInput) => {
    await api.createUptimeMonitor(input);
    await load();
  };

  const setActive = async (monitor: UptimeMonitor) => {
    try {
      await api.updateUptimeMonitor(monitor.id, {
        name: monitor.name, type: monitor.type, url: monitor.type === 'http' ? monitor.url : undefined,
        host: monitor.type === 'tcp' ? monitor.url : undefined, port: monitor.port, method: monitor.method,
        expectedStatus: monitor.expectedStatus, timeout: monitor.timeout, interval: monitor.interval,
        isActive: !monitor.isActive,
      });
      await load();
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const empty = filteredAgentServices.length === 0 && filteredMonitors.length === 0;

  return (
    <div>
      <PageHeader title="업타임" subtitle="Docker에서 발견한 서비스와 직접 추가한 업타임 모니터를 확인합니다.">
        <div className="flex w-full flex-col gap-2 sm:flex-row md:w-auto">
          <SearchInput value={query} onChange={(event) => setQuery(event.target.value)} placeholder="서비스 또는 대상 검색" aria-label="서비스 또는 대상 검색" wrapperClassName="w-full sm:w-72" />
          <Button onClick={() => setAdding(true)}><MaterialIcon name="add" />업타임 추가</Button>
        </div>
      </PageHeader>

      {loading ? <ServiceListSkeleton /> : error ? (
        <EmptyState icon="error_outline" title="대상을 불러오지 못했습니다" description={error} />
      ) : empty ? (
        <EmptyState icon="monitor_heart" title={normalizedQuery ? '검색 결과가 없습니다' : '표시할 업타임 대상이 없습니다'} description={normalizedQuery ? '검색어를 바꿔 다시 시도해 보세요.' : 'Docker 환경을 연결하거나 업타임 모니터를 직접 추가해 보세요.'} />
      ) : (
        <div className="space-y-8">
          {filteredMonitors.length > 0 && (
            <section>
              <div className="mb-3 flex items-center gap-2"><MaterialIcon name="public" className="text-lg text-primary" /><h2 className="text-base font-bold text-text-base">직접 추가한 업타임</h2></div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                {filteredMonitors.map((monitor) => (
                  <UptimeTargetCard
                    key={monitor.id}
                    to={`/uptime/${monitor.id}`}
                    title={monitor.name}
                    subtitle="직접 설정한 HTTP/TCP 모니터"
                    status={<UptimeMonitorStatusBadge monitor={monitor} onToggle={() => void setActive(monitor)} />}
                    endpoint={monitor.type === 'tcp' ? `${monitor.url}:${monitor.port}` : monitor.url}
                    meta={<p className="text-xs text-text-muted">{monitor.type.toUpperCase()} · {monitor.interval}초</p>}
                  />
                ))}
              </div>
            </section>
          )}
          {filteredAgentServices.length > 0 && (
            <section>
              <div className="mb-3 flex items-center gap-2"><MaterialIcon name="smart_toy" className="text-lg text-primary" /><h2 className="text-base font-bold text-text-base">Docker에서 발견한 서비스</h2></div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                {filteredAgentServices.map((service) => (
                  <UptimeTargetCard
                    key={`${service.agentId}:${service.key}`}
                    to={`/services/${service.agentId}/${encodeURIComponent(service.key)}?tab=health`}
                    title={service.name}
                    subtitle={service.agentName}
                    status={<StatusBadge healthy={service.healthy} />}
                    endpoint={service.endpoint || service.key}
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {adding && <UptimeMonitorDialog monitor={null} onClose={() => setAdding(false)} onSave={saveMonitor} />}
    </div>
  );
}
