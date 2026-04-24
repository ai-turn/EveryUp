import { useState, useCallback, useMemo, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useTranslate } from '@tolgee/react';
import { ko, enUS } from 'date-fns/locale';
import { toast } from 'react-hot-toast';
import { getErrorMessage } from '../utils/errors';
import { MaterialIcon } from '../components/common';
import { useAutoRefresh } from '../hooks/useAutoRefresh';
import { useCopyToClipboard } from '../hooks/useCopyToClipboard';
import { LogDetailView } from '../features/logs/components/LogDetailView';
import { api, Service } from '../services/api';

type TabKey = 'logs' | 'requests' | 'integration' | 'settings';

export function LogDetailPage() {
  const { serviceId } = useParams<{ serviceId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { t } = useTranslate();
  const { t: ti, i18n } = useTranslation(['logs', 'common']);
  const { copy } = useCopyToClipboard();

  const [isLive, setIsLive] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [service, setService] = useState<Service | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [activeTab, setActiveTab] = useState<TabKey>(
    searchParams.get('tab') === 'requests'
      ? 'requests'
      : searchParams.get('tab') === 'integration'
      ? 'integration'
      : searchParams.get('tab') === 'settings'
      ? 'settings'
      : 'logs'
  );
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [revealCountdown, setRevealCountdown] = useState(0);
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

  // Show revealed API key modal on first creation
  useEffect(() => {
    const state = location.state as { newApiKey?: string } | null;
    if (state?.newApiKey) {
      setRevealedKey(state.newApiKey);
      setRevealCountdown(30);
      window.history.replaceState({}, '', location.pathname + location.search);
    }
  }, [location.state, location.pathname, location.search]);

  // Countdown timer for revealed key
  useEffect(() => {
    if (!revealedKey) return;
    const timer = setInterval(() => {
      setRevealCountdown((prev) => {
        if (prev <= 1) {
          setRevealedKey(null);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [revealedKey]);

  const handleRefresh = useCallback(() => {
    fetchService();
    setRefreshKey((prev) => prev + 1);
  }, [fetchService]);

  const handleApiKeyRegenerated = useCallback((newKey: string, maskedKey: string) => {
    setService((prev) => prev ? { ...prev, apiKey: newKey, apiKeyMasked: maskedKey } : prev);
  }, []);

  const handleDelete = async () => {
    if (!service) return;
    setIsDeleting(true);
    try {
      await api.deleteService(service.id);
      toast.success(ti('logs.toast.deleted'));
      navigate('/logs');
    } catch (err) {
      toast.error(getErrorMessage(err));
      setIsDeleting(false);
    }
  };

  const handleTabChange = (tab: TabKey) => {
    setActiveTab(tab);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const { refresh } = useAutoRefresh(handleRefresh, 5000, isLive);

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center gap-3 text-slate-500 dark:text-text-muted-dark">
          <MaterialIcon name="sync" className="text-2xl animate-spin" />
          <span>{ti('common.loading')}</span>
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
          {error || t('로그 서비스를 찾을 수 없습니다')}
        </p>
        <button
          onClick={() => navigate('/logs')}
          className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium"
        >
          {ti('nav.logs')}
        </button>
      </div>
    );
  }

  const sharedProps = {
    service,
    serviceId: serviceId!,
    refreshKey,
    isLive,
    activeTab,
    isDeleteDialogOpen,
    isDeleting,
    revealedKey,
    revealCountdown,
    onTabChange: handleTabChange,
    onLiveToggle: setIsLive,
    onRefresh: refresh,
    onDelete: handleDelete,
    onDeleteDialogOpen: () => setIsDeleteDialogOpen(true),
    onDeleteDialogClose: () => setIsDeleteDialogOpen(false),
    onSettingsClick: () => {
      setActiveTab('settings');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    onServiceUpdate: setService,
    onApiKeyRegenerated: handleApiKeyRegenerated,
    onRevealedKeyClose: () => setRevealedKey(null),
    onCopyKey: copy,
  } as const;

  return (
    <LogDetailView
      {...sharedProps}
      lastUpdated={lastUpdated}
      dateLocale={dateLocale}
    />
  );
}
