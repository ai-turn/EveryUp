import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-hot-toast';
import { MaterialIcon, PageHeader } from '../components/common';
import { AlertRulesTab } from '../features/alerts/components/AlertRulesTab';
import { NotificationHistoryTab } from '../features/alerts/components/NotificationHistoryTab';
import { api, type NotificationChannel } from '../services/api';
import { useSidePanel } from '../contexts/SidePanelContext';
import { ChannelForm } from '../features/alerts/components/ChannelForm';

type TabType = 'channels' | 'rules' | 'history';

export function AlertsDesktop() {
  const { t } = useTranslation();
  const { openPanel } = useSidePanel();
  const [activeTab, setActiveTab] = useState<TabType>('channels');
  const [channels, setChannels] = useState<NotificationChannel[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [togglingIds, setTogglingIds] = useState<Set<string>>(new Set());
  const [rulesAddTrigger, setRulesAddTrigger] = useState(0);

  const loadChannels = async () => {
    try {
      const data = await api.getNotificationChannels();
      setChannels(data);
    } catch {
      toast.error(t('alerts.loadFailed'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadChannels();
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm(t('alerts.confirmDelete'))) return;

    try {
      await api.deleteNotificationChannel(id);
      toast.success(t('alerts.channelDeleted'));
      loadChannels();
    } catch {
      toast.error(t('alerts.deleteFailed'));
    }
  };

  const handleTest = async (id: string) => {
    try {
      await api.testNotificationChannel(id);
      toast.success(t('alerts.testSent'));
    } catch {
      toast.error(t('alerts.testFailed'));
    }
  };

  const handleToggle = async (id: string) => {
    setTogglingIds(prev => new Set(prev).add(id));
    try {
      const result = await api.toggleNotificationChannel(id);
      setChannels(prev =>
        prev.map(ch => ch.id === id ? { ...ch, isEnabled: result.isEnabled } : ch)
      );
      toast.success(result.isEnabled
        ? t('alerts.channelEnabled')
        : t('alerts.channelDisabled')
      );
    } catch {
      toast.error(t('alerts.toggleFailed'));
    } finally {
      setTogglingIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const handleAddChannel = () => {
    openPanel(
      t('alerts.addChannel'),
      <ChannelForm onSuccess={loadChannels} />
    );
  };

  const handleEdit = (channel: NotificationChannel) => {
    openPanel(
      t('alerts.modal.editTitle', { defaultValue: 'Edit Channel' }),
      <ChannelForm channel={channel} onSuccess={loadChannels} />
    );
  };

  const getChannelIcon = (type: string) => {
    return type === 'telegram' ? 'send' : 'sports_esports';
  };

  const channelStyles: Record<string, { bg: string; text: string }> = {
    telegram: { bg: 'bg-sky-500/10', text: 'text-sky-500' },
    discord: { bg: 'bg-indigo-500/10', text: 'text-indigo-400' },
  };

  const tabs: { key: TabType; label: string; icon: string }[] = [
    { key: 'channels', label: t('alerts.channelsTitle'), icon: 'notifications' },
    { key: 'rules', label: t('alerts.rulesTitle'), icon: 'rule' },
    { key: 'history', label: t('alerts.history.title'), icon: 'history' },
  ];

  return (
    <>
      <PageHeader
        title={t('alerts.title')}
        subtitle={t('alerts.subtitle')}
        features={[
          { icon: 'notifications_active', label: t('alerts.features.channels') },
          { icon: 'rule', label: t('alerts.features.rules') },
          { icon: 'send', label: t('alerts.features.multiChannel') },
          { icon: 'history', label: t('alerts.features.history') },
        ]}
      >
        {activeTab === 'channels' && (
          <button
            onClick={handleAddChannel}
            className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 rounded-lg text-sm font-bold transition-all text-white shadow-sm hover:shadow-md cursor-pointer active:scale-95"
          >
            <MaterialIcon name="add" className="text-lg" />
            {t('alerts.addChannel')}
          </button>
        )}
        {activeTab === 'rules' && (
          <button
            onClick={() => setRulesAddTrigger(n => n + 1)}
            className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 rounded-lg text-sm font-bold transition-all text-white shadow-sm hover:shadow-md cursor-pointer active:scale-95"
          >
            <MaterialIcon name="add" className="text-lg" />
            {t('alerts.rules.addRule')}
          </button>
        )}
      </PageHeader>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-slate-100 dark:bg-bg-surface-dark/50 p-1 rounded-xl w-fit">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === tab.key
              ? 'bg-white dark:bg-bg-surface-dark text-slate-900 dark:text-white shadow-sm'
              : 'text-slate-500 dark:text-text-muted-dark hover:text-slate-700 dark:hover:text-text-base-dark'
              }`}
          >
            <MaterialIcon name={tab.icon} className="text-lg" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'history' ? (
        <NotificationHistoryTab />
      ) : activeTab === 'channels' ? (
        <>
          <p className="text-sm text-slate-500 dark:text-text-muted-dark mb-4">
            {t('alerts.configured', { count: channels.length })}
          </p>

          <div className="bg-white dark:bg-bg-surface-dark border border-slate-200 dark:border-ui-border-dark rounded-xl overflow-hidden">
            {isLoading ? (
              <div className="p-8 text-center text-slate-500">
                <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin mx-auto mb-2" />
                {t('alerts.loadingChannels')}
              </div>
            ) : channels.length === 0 ? (
              <div className="p-12 text-center">
                <MaterialIcon name="notifications_off" className="text-6xl text-slate-300 dark:text-text-dim-dark mb-4" />
                <p className="text-slate-500 dark:text-text-muted-dark mb-4">
                  {t('alerts.noChannels')}
                </p>
                <button
                  onClick={handleAddChannel}
                  className="px-6 py-2 bg-primary text-white font-bold rounded-lg hover:bg-primary/90 transition-all shadow-md"
                >
                  {t('alerts.addChannel')}
                </button>
              </div>
            ) : (
              <div className="divide-y divide-slate-200 dark:divide-ui-border-dark">
                {channels.map((channel) => (
                  <div
                    key={channel.id}
                    className={`p-4 flex items-center gap-4 hover:bg-slate-50 dark:hover:bg-ui-hover-dark/50 transition-colors ${!channel.isEnabled ? 'opacity-50' : ''}`}
                  >
                    <div
                      className={`w-12 h-12 rounded-lg flex items-center justify-center ${(channelStyles[channel.type] ?? channelStyles.discord).bg}`}
                    >
                      <MaterialIcon
                        name={getChannelIcon(channel.type)}
                        className={`text-2xl ${(channelStyles[channel.type] ?? channelStyles.discord).text}`}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-slate-900 dark:text-white truncate">{channel.name}</h3>
                        {!channel.isEnabled && (
                          <span className="px-2 py-0.5 text-xs font-bold uppercase tracking-wider bg-slate-200 dark:bg-ui-active-dark text-slate-500 dark:text-text-muted-dark rounded-full">
                            {t('common.disabled', { defaultValue: 'Disabled' })}
                          </span>
                        )}
                      </div>
                      <p className={`text-sm font-bold capitalize ${(channelStyles[channel.type] ?? channelStyles.discord).text}`}>
                        {channel.type}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => handleToggle(channel.id)}
                        disabled={togglingIds.has(channel.id)}
                        className={`relative w-11 h-6 rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary/50 ${channel.isEnabled ? 'bg-primary' : 'bg-slate-400 dark:bg-slate-500'}`}
                        title={channel.isEnabled
                          ? t('alerts.disable', { defaultValue: 'Disable' })
                          : t('alerts.enable', { defaultValue: 'Enable' })
                        }
                      >
                        <span
                          className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${channel.isEnabled ? 'translate-x-5' : 'translate-x-0'}`}
                        />
                      </button>

                      <div className="w-px h-6 bg-slate-200 dark:bg-ui-active-dark" />

                      <button
                        onClick={() => handleTest(channel.id)}
                        className="px-3 sm:px-4 py-2 bg-primary/10 dark:bg-primary/20 text-primary font-bold rounded-lg hover:bg-primary/20 dark:hover:bg-primary/30 transition-all flex items-center gap-2"
                      >
                        <MaterialIcon name="send" className="text-sm" />
                        <span className="hidden sm:inline">{t('alerts.test')}</span>
                      </button>

                      <div className="w-px h-6 bg-slate-200 dark:bg-ui-active-dark" />

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleEdit(channel)}
                          className="p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-ui-hover-dark rounded-lg transition-all"
                          title={t('common.edit', { defaultValue: 'Edit' })}
                        >
                          <MaterialIcon name="edit" />
                        </button>
                        <button
                          onClick={() => handleDelete(channel.id)}
                          className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all"
                        >
                          <MaterialIcon name="delete" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      ) : (
        <AlertRulesTab addTrigger={rulesAddTrigger} />
      )}
    </>
  );
}
