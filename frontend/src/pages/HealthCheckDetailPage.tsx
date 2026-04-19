import { useState, useCallback, useMemo, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useTranslate } from '@tolgee/react';
import { ko, enUS } from 'date-fns/locale';
import { toast } from 'react-hot-toast';
import { getErrorMessage } from '../utils/errors';
import { MaterialIcon } from '../components/common';
import { useSidePanel } from '../contexts/SidePanelContext';
import { useAutoRefresh } from '../hooks/useAutoRefresh';
import { HealthCheckForm } from '../features/healthcheck/components/HealthCheckForm';
import { HealthCheckDetailView } from '../features/healthcheck/components/HealthCheckDetailView';
import { api, Service } from '../services/api';

export function HealthCheckDetailPage() {
  const { serviceId } = useParams<{ serviceId: string }>();
  const navigate = useNavigate();
  const { t } = useTranslate();
  const { t: tc, i18n } = useTranslation(['common', 'nav']);
  const { openPanel } = useSidePanel();

  const [isLive, setIsLive] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [service, setService] = useState<Service | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const dateLocale = useMemo(() => (i18n.language.startsWith('ko') ? ko : enUS), [i18n.language]);

  const fetchService = useCallback(async () => {
    if (!serviceId) return;
    try {
      const data = await api.getServiceById(serviceId);
      setService(data);
      setError(null);
      setLastUpdated(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch service');
    } finally {
      setLoading(false);
    }
  }, [serviceId]);

  useEffect(() => {
    fetchService();
  }, [fetchService]);

  const handleRefresh = useCallback(() => {
    fetchService();
    setRefreshKey((prev) => prev + 1);
  }, [fetchService]);

  const handleDelete = async () => {
    if (!service) return;
    setIsDeleting(true);
    try {
      await api.deleteService(service.id);
      toast.success(t('헬스체크가 삭제되었습니다'));
      navigate('/');
    } catch (err) {
      toast.error(getErrorMessage(err));
      setIsDeleting(false);
    }
  };

  const handleManage = () => {
    if (!service) return;
    openPanel(
      t('헬스체크 관리'),
      <HealthCheckForm onSuccess={fetchService} service={service} />
    );
  };

  const getIdentityStatus = (status: Service['status']): 'online' | 'offline' | 'degraded' => {
    switch (status) {
      case 'healthy': return 'online';
      case 'unhealthy': return 'offline';
      default: return 'degraded';
    }
  };

  const { refresh } = useAutoRefresh(handleRefresh, 5000, isLive);

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center gap-3 text-slate-500 dark:text-text-muted-dark">
          <MaterialIcon name="sync" className="text-2xl animate-spin" />
          <span>{tc('common.loading')}</span>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !service) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <MaterialIcon name="error_outline" className="text-3xl text-red-500" />
        <p className="text-slate-600 dark:text-text-muted-dark">
          {error || t('헬스체크를 찾을 수 없습니다')}
        </p>
        <button
          onClick={() => navigate('/')}
          className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium"
        >
          {tc('nav.dashboard')}
        </button>
      </div>
    );
  }

  const sharedProps = {
    service,
    serviceId: serviceId!,
    refreshKey,
    isLive,
    isDeleteDialogOpen,
    isDeleting,
    onLiveToggle: setIsLive,
    onRefresh: refresh,
    onManage: handleManage,
    onDelete: handleDelete,
    onDeleteDialogOpen: () => setIsDeleteDialogOpen(true),
    onDeleteDialogClose: () => setIsDeleteDialogOpen(false),
    getIdentityStatus,
  } as const;

  return (
    <HealthCheckDetailView
      {...sharedProps}
      lastUpdated={lastUpdated}
      dateLocale={dateLocale}
    />
  );
}
