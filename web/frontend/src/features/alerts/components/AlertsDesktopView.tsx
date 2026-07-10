import { MaterialIcon, PageHeader, EmptyState, KPIChip, Toggle } from '../../../components/common';
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
            className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 rounded-lg text-sm font-semibold transition-all text-white cursor-pointer active:scale-95"
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
        <ChannelsTable
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

function ChannelsTable({ channels, channelHealth, isLoading, togglingIds, onAdd, onEdit, onDelete, onToggle, onTest }: ChannelsGridProps) {
  const { t, i18n } = useTranslation(['alerts', 'common']);
  const locale = i18n.language === 'ko' ? ko : enUS;

  if (isLoading) {
    return (
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-ui-border-dark dark:bg-bg-surface-dark">
        <div className="divide-y divide-slate-100 dark:divide-ui-border-dark">
          {[1, 2, 3].map(i => (
            <div key={i} className="grid grid-cols-[minmax(220px,1.4fr)_120px_96px_135px_120px_120px_155px_184px] gap-4 px-4 py-3 animate-pulse">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg bg-slate-100 dark:bg-ui-hover-dark" />
                <div className="space-y-2">
                  <div className="h-3 w-32 rounded bg-slate-100 dark:bg-ui-hover-dark" />
                  <div className="h-2.5 w-20 rounded bg-slate-100 dark:bg-ui-hover-dark" />
                </div>
              </div>
              <div className="h-5 rounded bg-slate-100 dark:bg-ui-hover-dark" />
              <div className="h-5 rounded bg-slate-100 dark:bg-ui-hover-dark" />
              <div className="h-5 rounded bg-slate-100 dark:bg-ui-hover-dark" />
              <div className="h-5 rounded bg-slate-100 dark:bg-ui-hover-dark" />
              <div className="h-5 rounded bg-slate-100 dark:bg-ui-hover-dark" />
              <div className="h-5 rounded bg-slate-100 dark:bg-ui-hover-dark" />
              <div className="h-7 rounded bg-slate-100 dark:bg-ui-hover-dark" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (channels.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white dark:border-ui-border-dark dark:bg-bg-surface-dark">
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
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-ui-border-dark dark:bg-bg-surface-dark">
      <table className="w-full min-w-[1200px] table-fixed">
        <thead className="bg-slate-50 dark:bg-ui-hover-dark/40">
          <tr className="border-b border-slate-200 dark:border-ui-border-dark">
            <th className="w-[270px] px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-text-muted-dark">{t('alerts.table.channel')}</th>
            <th className="w-[120px] px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-text-muted-dark">{t('alerts.table.type')}</th>
            <th className="w-[96px] px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-text-muted-dark">{t('alerts.table.status')}</th>
            <th className="w-[135px] px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-text-muted-dark">{t('alerts.table.successRate7d')}</th>
            <th className="w-[120px] px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-text-muted-dark">{t('alerts.table.sentFailed')}</th>
            <th className="w-[120px] px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-text-muted-dark">{t('alerts.table.linkedRules')}</th>
            <th className="w-[155px] px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-text-muted-dark">{t('alerts.table.lastSent')}</th>
            <th className="w-[184px] px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-text-muted-dark">{t('alerts.table.actions')}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-ui-border-dark">
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
              <tr
                key={channel.id}
                className={`transition-colors hover:bg-slate-50 dark:hover:bg-ui-hover-dark/40 ${!channel.isEnabled ? 'opacity-70' : ''}`}
              >
                <td className="px-4 py-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${style.bg}`}>
                      <ChannelIcon type={channel.type} size={18} className={style.text} />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-slate-900 dark:text-white">{channel.name}</p>
                      <p className="truncate text-sm text-slate-500 dark:text-text-muted-dark">
                        {channel.isEnabled ? t('common.enabled', { defaultValue: 'Enabled' }) : t('common.disabled')}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex rounded px-2 py-0.5 text-xs font-bold uppercase ${style.bg} ${style.text}`}>
                    {getChannelTypeLabel(channel.type, t)}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <Toggle
                    checked={channel.isEnabled}
                    onChange={() => onToggle(channel.id)}
                    disabled={togglingIds.has(channel.id)}
                    title={channel.isEnabled ? t('alerts.disable') : t('alerts.enable')}
                  />
                </td>
                <td className={`px-4 py-3 text-right text-sm font-bold tabular-nums ${rateColor}`}>
                  {rate != null ? `${rate}%` : '-'}
                </td>
                <td className="px-4 py-3 text-right text-sm font-bold tabular-nums text-slate-900 dark:text-white">
                  {sent}
                  {failed > 0 && <span className="ml-1 text-sm font-semibold text-red-500">/ {failed}</span>}
                </td>
                <td className="px-4 py-3 text-right text-sm font-bold tabular-nums text-slate-900 dark:text-white">
                  {health?.ruleCount ?? 0}
                </td>
                <td className="px-4 py-3 text-sm text-slate-500 dark:text-text-muted-dark">
                  {lastSent
                    ? formatDistanceToNow(lastSent, { addSuffix: true, locale })
                    : t('alerts.health.never')}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      onClick={() => onTest(channel.id)}
                      disabled={!channel.isEnabled}
                      className="inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-md px-3 text-sm font-bold text-primary transition-all hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-40 dark:hover:bg-primary/20"
                    >
                      <MaterialIcon name="send" className="text-sm" />
                      {t('alerts.test')}
                    </button>
                    <button
                      onClick={() => onEdit(channel)}
                      className="flex h-8 w-8 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-ui-hover-dark dark:hover:text-white"
                      title={t('common.edit')}
                    >
                      <MaterialIcon name="edit" className="text-base" />
                    </button>
                    <button
                      onClick={() => onDelete(channel.id)}
                      className="flex h-8 w-8 items-center justify-center rounded-md text-red-500 transition-colors hover:bg-red-50 dark:hover:bg-red-900/20"
                      title={t('common.delete')}
                    >
                      <MaterialIcon name="delete_outline" className="text-base" />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
