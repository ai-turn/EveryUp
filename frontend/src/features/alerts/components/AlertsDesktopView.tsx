import { MaterialIcon, PageHeader, EmptyState, KPIChip } from '../../../components/common';
import { ChannelIcon } from '../../../components/icons/ChannelIcons';
import { AlertRulesTab } from './AlertRulesTab';
import { NotificationHistoryTab } from './NotificationHistoryTab';
import { formatDistanceToNow } from 'date-fns';
import { ko, enUS } from 'date-fns/locale';
import type {
  NotificationChannel,
  NotificationChannelHealth,
  AlertRule,
  NotificationHistory,
  NotificationStats,
} from '../../../services/api';
import { useTranslation } from 'react-i18next';
import { getChannelStyle, getChannelTypeLabel } from '../utils/channelMeta';

type TabType = 'channels' | 'rules' | 'history';

interface AlertsDesktopViewProps {
  channels: NotificationChannel[];
  channelHealth: Record<string, NotificationChannelHealth>;
  rules: AlertRule[];
  history: NotificationHistory[];
  stats: NotificationStats | null;
  isLoading: boolean;
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  togglingIds: Set<string>;
  rulesAddTrigger: number;
  onAddChannel: () => void;
  onEditChannel: (channel: NotificationChannel) => void;
  onDeleteChannel: (id: string) => void;
  onToggleChannel: (id: string) => void;
  onTestChannel: (id: string) => void;
  onAddRule: () => void;
}

export function AlertsDesktopView({
  channels,
  channelHealth,
  rules,
  stats,
  isLoading,
  activeTab,
  setActiveTab,
  togglingIds,
  rulesAddTrigger,
  onAddChannel,
  onEditChannel,
  onDeleteChannel,
  onToggleChannel,
  onTestChannel,
  onAddRule,
}: AlertsDesktopViewProps) {
  const { t } = useTranslation(['alerts', 'common']);

  const enabledRules = rules.filter(r => r.isEnabled).length;
  const totalSent = stats?.totalSent ?? 0;
  const totalFailed = stats?.totalFailed ?? 0;
  const successRate = stats ? Math.round(stats.successRate) : null;
  const totalNotifications = totalSent + totalFailed;

  const tabs: { key: TabType; label: string; count?: number }[] = [
    { key: 'channels', label: t('alerts.channelsTitle'), count: channels.length },
    { key: 'rules',    label: t('alerts.rulesTitle'),    count: rules.length },
    { key: 'history',  label: t('alerts.history.title'), count: totalNotifications || undefined },
  ];

  return (
    <>
      <PageHeader
        title={t('alerts.title')}
        subtitle={t('alerts.subtitle')}
      >
        {activeTab !== 'history' && (
          <button
            onClick={activeTab === 'rules' ? onAddRule : onAddChannel}
            className="flex items-center gap-2 px-4 py-2 bg-primary/10 hover:bg-primary/20 rounded-lg text-sm font-bold transition-all text-primary cursor-pointer active:scale-95"
          >
            <MaterialIcon name="add" className="text-lg" />
            {activeTab === 'rules' ? t('alerts.rules.addRule') : t('alerts.addChannel')}
          </button>
        )}
      </PageHeader>

      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-5">
        <KPIChip
          label={t('alerts.kpi.sent7d')}
          value={totalSent}
          tone="emerald"
          icon="send"
        />
        <KPIChip
          label={t('alerts.kpi.failed7d')}
          value={totalFailed}
          tone={totalFailed > 0 ? 'red' : 'slate'}
          icon="error_outline"
        />
        <KPIChip
          label={t('alerts.kpi.successRate')}
          value={successRate != null ? `${successRate}%` : '—'}
          tone={successRate == null ? 'slate' : successRate >= 95 ? 'emerald' : successRate >= 80 ? 'amber' : 'red'}
          icon="check_circle"
        />
        <KPIChip
          label={t('alerts.kpi.activeRules')}
          value={`${enabledRules}/${rules.length}`}
          tone="primary"
          icon="rule"
        />
        <KPIChip
          label={t('alerts.kpi.activeChannels')}
          value={`${channels.filter(c => c.isEnabled).length}/${channels.length}`}
          tone="primary"
          icon="notifications_active"
        />
      </div>

      {/* Tabs */}
      <div className="flex items-end border-b border-slate-200 dark:border-ui-border-dark mb-5">
        <div role="tablist" aria-label={t('alerts.title')} className="flex gap-0">
          {tabs.map(tab => (
            <button
              key={tab.key}
              role="tab"
              aria-selected={activeTab === tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`relative px-4 py-2.5 text-sm font-semibold transition-colors -mb-px border-b-2 ${
                activeTab === tab.key
                  ? 'text-slate-900 dark:text-white border-primary'
                  : 'text-slate-500 dark:text-text-muted-dark border-transparent hover:text-slate-700 dark:hover:text-text-base-dark'
              }`}
            >
              <span className="inline-flex items-center gap-2">
                {tab.label}
                {tab.count != null && (
                  <span className={`text-xs font-bold px-1.5 py-0.5 rounded-md ${
                    activeTab === tab.key
                      ? 'bg-primary/10 text-primary'
                      : 'bg-slate-100 dark:bg-ui-hover-dark text-slate-500 dark:text-text-muted-dark'
                  }`}>{tab.count}</span>
                )}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'history' ? (
        <NotificationHistoryTab />
      ) : activeTab === 'channels' ? (
        <ChannelsGrid
          channels={channels}
          channelHealth={channelHealth}
          isLoading={isLoading}
          togglingIds={togglingIds}
          onAdd={onAddChannel}
          onEdit={onEditChannel}
          onDelete={onDeleteChannel}
          onToggle={onToggleChannel}
          onTest={onTestChannel}
        />
      ) : (
        <AlertRulesTab addTrigger={rulesAddTrigger} />
      )}
    </>
  );
}

// ─── Channels grid ─────────────────────────────────────────────────

interface ChannelsGridProps {
  channels: NotificationChannel[];
  channelHealth: Record<string, NotificationChannelHealth>;
  isLoading: boolean;
  togglingIds: Set<string>;
  onAdd: () => void;
  onEdit: (channel: NotificationChannel) => void;
  onDelete: (id: string) => void;
  onToggle: (id: string) => void;
  onTest: (id: string) => void;
}

function ChannelsGrid({ channels, channelHealth, isLoading, togglingIds, onAdd, onEdit, onDelete, onToggle, onTest }: ChannelsGridProps) {
  const { t, i18n } = useTranslation(['alerts', 'common']);
  const locale = i18n.language === 'ko' ? ko : enUS;

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {[1, 2].map(i => (
          <div key={i} className="h-44 bg-slate-100 dark:bg-ui-hover-dark animate-pulse rounded-xl" />
        ))}
      </div>
    );
  }

  if (channels.length === 0) {
    return (
      <div className="bg-white dark:bg-bg-surface-dark border border-slate-200 dark:border-ui-border-dark rounded-xl">
        <EmptyState
          icon="notifications_off"
          title={t('alerts.noChannels')}
          description={t('alerts.noChannelsDesc')}
          action={{ label: t('alerts.addChannel'), onClick: onAdd }}
        />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {channels.map(channel => {
        const style = getChannelStyle(channel.type);
        const health = channelHealth[channel.id];
        const sent = health?.successCount ?? 0;
        const failed = health?.failedCount ?? 0;
        const total = sent + failed;
        const rate = total > 0 ? Math.round((sent / total) * 100) : null;
        const rateColor = rate == null ? 'text-slate-400 dark:text-text-dim-dark'
          : rate >= 95 ? 'text-emerald-500'
          : rate >= 80 ? 'text-amber-500'
          : 'text-red-500';
        const lastSent = health?.lastSentAt ? new Date(health.lastSentAt) : null;

        return (
          <div
            key={channel.id}
            className={`bg-white dark:bg-bg-surface-dark border border-slate-200 dark:border-ui-border-dark rounded-xl p-4 ${!channel.isEnabled ? 'opacity-70' : ''}`}
          >
            {/* Header */}
            <div className="flex items-start gap-3 mb-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${style.bg}`}>
                <ChannelIcon type={channel.type} size={22} className={style.text} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <h3 className="font-bold text-slate-900 dark:text-white truncate">{channel.name}</h3>
                  <span className={`px-1.5 py-0.5 text-xs font-bold uppercase tracking-wider rounded ${style.bg} ${style.text}`}>
                    {getChannelTypeLabel(channel.type, t)}
                  </span>
                  {!channel.isEnabled && (
                    <span className="px-1.5 py-0.5 text-xs font-bold uppercase tracking-wider bg-slate-100 dark:bg-ui-hover-dark text-slate-500 dark:text-text-muted-dark rounded">
                      {t('common.disabled')}
                    </span>
                  )}
                </div>
                <div className="text-sm text-slate-500 dark:text-text-muted-dark mt-0.5">
                  {lastSent
                    ? t('alerts.health.lastSentAgo', { ago: formatDistanceToNow(lastSent, { addSuffix: true, locale }) })
                    : t('alerts.health.never')}
                  {' · '}
                  {t('alerts.health.rulesCount', { count: health?.ruleCount ?? 0 })}
                </div>
              </div>
              <button
                onClick={() => onToggle(channel.id)}
                disabled={togglingIds.has(channel.id)}
                className={`relative w-10 h-5.5 rounded-full transition-colors duration-200 shrink-0 disabled:opacity-50 disabled:cursor-not-allowed ${channel.isEnabled ? 'bg-primary' : 'bg-slate-300 dark:bg-slate-600'}`}
                title={channel.isEnabled ? t('alerts.disable') : t('alerts.enable')}
              >
                <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 ${channel.isEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
              </button>
            </div>

            {/* KPI tile */}
            <div className="grid grid-cols-3 gap-3 px-3 py-2 bg-slate-50 dark:bg-ui-hover-dark/40 border border-slate-100 dark:border-ui-border-dark/50 rounded-lg">
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-text-muted-dark">
                  {t('alerts.health.successRate7d')}
                </div>
                <div className={`text-base font-bold tabular-nums ${rateColor}`}>
                  {rate != null ? `${rate}%` : '—'}
                </div>
              </div>
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-text-muted-dark">
                  {t('alerts.kpi.sent7d')}
                </div>
                <div className="text-base font-bold text-slate-900 dark:text-white tabular-nums">
                  {sent}
                  {failed > 0 && <span className="text-red-500 text-xs font-semibold ml-1">/ {failed}</span>}
                </div>
              </div>
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-text-muted-dark">
                  {t('alerts.health.linkedRules')}
                </div>
                <div className="text-base font-bold text-slate-900 dark:text-white tabular-nums">
                  {health?.ruleCount ?? 0}
                </div>
              </div>
            </div>

            {/* Action row */}
            <div className="flex items-center gap-1.5 mt-3">
              <button
                onClick={() => onTest(channel.id)}
                disabled={!channel.isEnabled}
                className="flex items-center gap-1.5 px-3 py-1.5 text-primary text-xs font-bold rounded-md hover:bg-primary/10 dark:hover:bg-primary/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <MaterialIcon name="send" className="text-sm" />
                {t('alerts.test')}
              </button>
              <div className="flex-1" />
              <button
                onClick={() => onEdit(channel)}
                className="p-1.5 text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-ui-hover-dark rounded-md transition-colors"
                title={t('common.edit')}
              >
                <MaterialIcon name="edit" className="text-base" />
              </button>
              <button
                onClick={() => onDelete(channel.id)}
                className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors"
                title={t('common.delete')}
              >
                <MaterialIcon name="delete" className="text-base" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
