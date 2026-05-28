import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-hot-toast';
import { getErrorMessage } from '../../utils/errors';
import { api, type NotificationChannel, type AlertRule, type NotificationHistory, type NotificationStats, type NotificationChannelHealth } from '../../services/api';
import { AlertsDesktopView } from '../../features/alerts/components/AlertsDesktopView';
import { AlertsMobileView } from '../../features/alerts/components/AlertsMobileView';
import { useIsMobile } from '../../hooks/useMediaQuery';
import { ConfirmDialog } from '../../components/common';

type TabType = 'channels' | 'rules' | 'history';

export function AlertsPage() {
  const { t } = useTranslation(['alerts', 'common']);
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  const [activeTab, setActiveTab] = useState<TabType>('channels');
  const [channels, setChannels] = useState<NotificationChannel[]>([]);
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [history, setHistory] = useState<NotificationHistory[]>([]);
  const [stats, setStats] = useState<NotificationStats | null>(null);
  const [channelHealth, setChannelHealth] = useState<Record<string, NotificationChannelHealth>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [rulesLoading, setRulesLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [togglingIds, setTogglingIds] = useState<Set<string>>(new Set());
  const [rulesAddTrigger, setRulesAddTrigger] = useState(0);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // --- Data fetching ---
  const loadChannels = async () => {
    try {
      const data = await api.getNotificationChannels();
      setChannels(data);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  };

  const loadChannelHealth = async () => {
    try {
      const data = await api.getNotificationChannelHealth(7);
      const map: Record<string, NotificationChannelHealth> = {};
      for (const h of data) map[h.channelId] = h;
      setChannelHealth(map);
    } catch {
      // health is non-critical
    }
  };

  const loadRules = async () => {
    try {
      const data = await api.getAlertRules();
      setRules(data);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setRulesLoading(false);
    }
  };

  const loadHistory = async () => {
    try {
      const response = await api.getNotificationHistory({ limit: 30, offset: 0 });
      setHistory(response.items || []);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setHistoryLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const data = await api.getNotificationHistoryStats(7);
      setStats(data);
    } catch {
      // stats are non-critical
    }
  };

  useEffect(() => {
    loadChannels();
    loadChannelHealth();
    loadRules();
    loadHistory();
    loadStats();
  }, []);

  // --- Handlers ---
  const handleToggleChannel = async (id: string) => {
    setTogglingIds(prev => new Set(prev).add(id));
    try {
      const result = await api.toggleNotificationChannel(id);
      setChannels(prev =>
        prev.map(ch => ch.id === id ? { ...ch, isEnabled: result.isEnabled } : ch)
      );
      toast.success(result.isEnabled ? t('alerts.channelEnabled') : t('alerts.channelDisabled'));
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setTogglingIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const handleDeleteChannel = (id: string) => {
    setPendingDeleteId(id);
  };

  const confirmDeleteChannel = async () => {
    if (!pendingDeleteId) return;
    setIsDeleting(true);
    try {
      await api.deleteNotificationChannel(pendingDeleteId);
      toast.success(t('alerts.channelDeleted'));
      setPendingDeleteId(null);
      refreshChannels();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setIsDeleting(false);
    }
  };

  const pendingDeleteChannel = pendingDeleteId
    ? channels.find(c => c.id === pendingDeleteId) ?? null
    : null;

  const handleTestChannel = async (id: string) => {
    try {
      await api.testNotificationChannel(id);
      toast.success(t('alerts.testSent'));
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const refreshChannels = () => {
    loadChannels();
    loadChannelHealth();
  };

  const handleAddChannel = () => {
    navigate('/alerts/channels/new');
  };

  const handleEditChannel = (channel: NotificationChannel) => {
    navigate(`/alerts/channels/${channel.id}/edit`);
  };

  const handleAddRule = () => {
    setRulesAddTrigger(n => n + 1);
  };

  // --- Render ---
  const deleteDialog = (
    <ConfirmDialog
      isOpen={pendingDeleteChannel !== null}
      onClose={() => setPendingDeleteId(null)}
      onConfirm={confirmDeleteChannel}
      title={t('alerts.deleteDialog.title')}
      message={
        <span>
          {t('alerts.deleteDialog.messagePrefix')}
          <span className="font-bold text-slate-900 dark:text-white">{pendingDeleteChannel?.name}</span>
          {t('alerts.deleteDialog.messageSuffix')}
        </span>
      }
      description={t('alerts.deleteDialog.warning')}
      confirmLabel={t('common.delete')}
      variant="danger"
      isProcessing={isDeleting}
    />
  );

  if (isMobile) {
    return (
      <>
        <AlertsMobileView
          channels={channels}
          channelHealth={channelHealth}
          rules={rules}
          history={history}
          stats={stats}
          isLoading={isLoading}
          rulesLoading={rulesLoading}
          historyLoading={historyLoading}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          onAddChannel={handleAddChannel}
          onEditChannel={handleEditChannel}
          onDeleteChannel={handleDeleteChannel}
          onToggleChannel={handleToggleChannel}
          onTestChannel={handleTestChannel}
        />
        {deleteDialog}
      </>
    );
  }

  return (
    <>
      <AlertsDesktopView
        channels={channels}
        channelHealth={channelHealth}
        rules={rules}
        history={history}
        stats={stats}
        isLoading={isLoading}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        togglingIds={togglingIds}
        rulesAddTrigger={rulesAddTrigger}
        onAddChannel={handleAddChannel}
        onEditChannel={handleEditChannel}
        onDeleteChannel={handleDeleteChannel}
        onToggleChannel={handleToggleChannel}
        onTestChannel={handleTestChannel}
        onAddRule={handleAddRule}
      />
      {deleteDialog}
    </>
  );
}
