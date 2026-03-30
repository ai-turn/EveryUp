import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-hot-toast';
import { getErrorMessage } from '../utils/errors';
import { api, type NotificationChannel, type AlertRule, type NotificationHistory, type NotificationStats } from '../services/api';
import { useSidePanel } from '../contexts/SidePanelContext';
import { ChannelForm } from '../features/alerts/components/ChannelForm';
import { AlertsDesktopView } from '../features/alerts/components/AlertsDesktopView';
import { AlertsMobileView } from '../features/alerts/components/AlertsMobileView';
import { useIsMobile } from '../hooks/useMediaQuery';

type TabType = 'channels' | 'rules' | 'history';

export function AlertsPage() {
  const { t } = useTranslation(['alerts', 'common']);
  const { openPanel } = useSidePanel();
  const isMobile = useIsMobile();

  const [activeTab, setActiveTab] = useState<TabType>('channels');
  const [channels, setChannels] = useState<NotificationChannel[]>([]);
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [history, setHistory] = useState<NotificationHistory[]>([]);
  const [stats, setStats] = useState<NotificationStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [rulesLoading, setRulesLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [togglingIds, setTogglingIds] = useState<Set<string>>(new Set());
  const [rulesAddTrigger, setRulesAddTrigger] = useState(0);

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

  const handleDeleteChannel = async (id: string) => {
    if (!confirm(t('alerts.confirmDelete'))) return;
    try {
      await api.deleteNotificationChannel(id);
      toast.success(t('alerts.channelDeleted'));
      loadChannels();
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const handleTestChannel = async (id: string) => {
    try {
      await api.testNotificationChannel(id);
      toast.success(t('alerts.testSent'));
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const handleAddChannel = () => {
    openPanel(
      t('alerts.addChannel'),
      <ChannelForm onSuccess={loadChannels} />
    );
  };

  const handleEditChannel = (channel: NotificationChannel) => {
    openPanel(
      t('alerts.modal.editTitle', { defaultValue: 'Edit Channel' }),
      <ChannelForm channel={channel} onSuccess={loadChannels} />
    );
  };

  const handleAddRule = () => {
    setRulesAddTrigger(n => n + 1);
  };

  // --- Render ---
  if (isMobile) {
    return (
      <AlertsMobileView
        channels={channels}
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
    );
  }

  return (
    <AlertsDesktopView
      channels={channels}
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
  );
}
