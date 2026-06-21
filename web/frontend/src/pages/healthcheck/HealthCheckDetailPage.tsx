import { useState, useCallback, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslate } from '@tolgee/react';
import { useTranslation } from 'react-i18next';
import { MaterialIcon } from '../../components/common';
import { useAutoRefresh } from '../../hooks/useAutoRefresh';
import { api, type AgentServiceFlat } from '../../services/api';
import { AgentHealthCheckDetailView } from '../../features/healthcheck/components/AgentHealthCheckDetailView';

export function HealthCheckDetailPage() {
  const { agentId, key } = useParams<{ agentId: string; key: string }>();
  const navigate = useNavigate();
  const { t } = useTranslate();
  const { t: tc } = useTranslation('common');

  const [isLive, setIsLive] = useState(true);
  const [service, setService] = useState<AgentServiceFlat | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  const fetchService = useCallback(async () => {
    if (!agentId || !key) return;
    try {
      const all = await api.getAllAgentServicesFlat();
      const found = all.find((s) => s.agentId === agentId && s.key === decodeURIComponent(key));
      setService(found ?? null);
    } catch {
      setService(null);
    } finally {
      setLoading(false);
    }
  }, [agentId, key]);

  useEffect(() => { fetchService(); }, [fetchService]);

  const handleRefresh = useCallback(() => {
    fetchService();
    setRefreshKey((prev) => prev + 1);
  }, [fetchService]);

  const { refresh } = useAutoRefresh(handleRefresh, 30_000, isLive);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 gap-3 text-slate-500 dark:text-text-muted-dark">
        <MaterialIcon name="sync" className="text-2xl animate-spin" />
        <span>{tc('common.loading')}</span>
      </div>
    );
  }

  if (!service) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <MaterialIcon name="error_outline" className="text-3xl text-red-500" />
        <p className="text-slate-600 dark:text-text-muted-dark">
          {t('서비스를 찾을 수 없습니다')}
        </p>
        <button
          onClick={() => navigate('/healthcheck')}
          className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium"
        >
          {t('목록으로')}
        </button>
      </div>
    );
  }

  return (
    <AgentHealthCheckDetailView
      service={service}
      agentId={agentId!}
      serviceKey={decodeURIComponent(key!)}
      refreshKey={refreshKey}
      isLive={isLive}
      onLiveToggle={setIsLive}
      onRefresh={refresh}
    />
  );
}
