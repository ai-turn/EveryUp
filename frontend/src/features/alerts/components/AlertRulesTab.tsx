import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { getErrorMessage } from '../../../utils/errors';
import { MaterialIcon, EmptyState, ConfirmDialog } from '../../../components/common';
import { ChannelIcon } from '../../../components/icons/ChannelIcons';
import { api, type AlertRule, type NotificationChannel, type Service, type Host } from '../../../services/api';
import { getChannelStyle } from '../utils/channelMeta';

const SEVERITY_BADGE: Record<string, string> = {
  critical: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400',
  warning: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400',
  info: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400',
};

const SEVERITY_ORDER: Record<string, number> = { critical: 0, warning: 1, info: 2 };

const METRIC_FALLBACKS: Record<string, string> = {
  cpu: 'CPU',
  memory: 'Memory',
  disk: 'Disk',
  status_change: 'Status change',
  http_status: 'HTTP status',
  response_time: 'Response time',
  log_level: 'Log level',
  api_status_code: 'API status',
};

const ENDPOINT_METRICS = new Set(['http_status', 'response_time']);

const OPERATOR_SYMBOLS: Record<string, string> = {
  gt: '>',
  gte: '>=',
  lt: '<',
  lte: '<=',
  eq: '=',
};

type CategoryKey = 'all' | 'endpoint' | 'log' | 'resource' | 'system';
type Translate = (key: string, options?: Record<string, unknown>) => string;

const CATEGORY_TONE: Record<Exclude<CategoryKey, 'all'>, string> = {
  endpoint: 'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-400',
  log: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400',
  resource: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-400',
  system: 'bg-slate-100 text-slate-600 dark:bg-ui-hover-dark dark:text-text-muted-dark',
};

function ruleCategory(rule: AlertRule): Exclude<CategoryKey, 'all'> {
  if (rule.isSystem) return 'system';
  if (rule.type === 'service') return 'endpoint';
  if (rule.type === 'log') return 'log';
  return 'resource';
}

function targetLabel(rule: AlertRule, services: Service[], hosts: Host[], t: (k: string) => string): string {
  if (rule.type === 'service' || rule.type === 'log') {
    if (rule.serviceId) {
      return services.find(s => s.id === rule.serviceId)?.name ?? rule.serviceId;
    }
    return rule.type === 'log' ? t('alerts.rules.allLogServices') : t('alerts.rules.allHealthchecks');
  }
  if (rule.hostId) return hosts.find(h => h.id === rule.hostId)?.name ?? rule.hostId;
  return t('alerts.rules.allHosts');
}

function categoryLabel(category: Exclude<CategoryKey, 'all'>, t: Translate): string {
  return t(`alerts.rules.categoryLabels.${category}`, {
    defaultValue: category === 'endpoint' ? 'Healthcheck' : category,
  });
}

function severityLabel(severity: string, t: Translate): string {
  return t(`alerts.rules.severityLabels.${severity}`, { defaultValue: severity });
}

function metricLabel(metric: string, t: Translate): string {
  return t(`alerts.rules.metricLabels.${metric}`, {
    defaultValue: METRIC_FALLBACKS[metric] ?? metric,
  });
}

function thresholdValue(rule: AlertRule): string {
  const unit = rule.metric === 'response_time' ? 'ms' : ENDPOINT_METRICS.has(rule.metric) || rule.metric === 'log_level' || rule.metric === 'api_status_code' ? '' : '%';
  return `${rule.threshold}${unit}`;
}

function conditionExpr(rule: AlertRule, t: Translate): string {
  const metric = metricLabel(rule.metric, t);
  const value = thresholdValue(rule);
  const symbol = OPERATOR_SYMBOLS[rule.operator] ?? rule.operator;
  return t(`alerts.rules.operatorTemplates.${rule.operator}`, {
    metric,
    value,
    defaultValue: `${metric} ${symbol} ${value}`,
  });
}

function formatMinutes(minutes: number, t: Translate): string {
  if (minutes >= 60 && minutes % 60 === 0) {
    return t('alerts.rules.time.hours', { count: minutes / 60, defaultValue: `${minutes / 60}h` });
  }
  return t('alerts.rules.time.minutes', { count: minutes, defaultValue: `${minutes}min` });
}

function formatSeconds(seconds: number, t: Translate): string {
  if (seconds >= 3600 && seconds % 3600 === 0) {
    return t('alerts.rules.time.hours', { count: seconds / 3600, defaultValue: `${seconds / 3600}h` });
  }
  if (seconds >= 60 && seconds % 60 === 0) {
    return t('alerts.rules.time.minutes', { count: seconds / 60, defaultValue: `${seconds / 60}min` });
  }
  return t('alerts.rules.time.seconds', { count: seconds, defaultValue: `${seconds}s` });
}

function evaluationSummary(rule: AlertRule, t: Translate): string {
  if (rule.type === 'service') {
    return t('alerts.rules.eval.endpoint', { defaultValue: 'Evaluated on every healthcheck result' });
  }
  if (rule.type === 'log') {
    return t('alerts.rules.eval.log', { defaultValue: 'Evaluated on every log/API event' });
  }
  if (rule.isSystem) {
    return t('alerts.rules.eval.system', { defaultValue: 'Managed by the system' });
  }
  return t('alerts.rules.eval.resource', {
    duration: formatMinutes(rule.duration, t),
    cooldown: formatSeconds(rule.cooldown, t),
    defaultValue: `${formatMinutes(rule.duration, t)} sustained · ${formatSeconds(rule.cooldown, t)} cooldown`,
  });
}

type SortKey = 'severity' | 'name' | 'target' | 'category';
type SortDir = 'asc' | 'desc';

interface AlertRulesTabProps {
  addTrigger?: number;
}

export function AlertRulesTab({ addTrigger }: AlertRulesTabProps) {
  const { t } = useTranslation(['alerts', 'common']);
  const navigate = useNavigate();
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [channels, setChannels] = useState<NotificationChannel[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [hosts, setHosts] = useState<Host[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [togglingIds, setTogglingIds] = useState<Set<string>>(new Set());
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Filters
  const [categoryFilter, setCategoryFilter] = useState<CategoryKey>('all');
  const [severityFilter, setSeverityFilter] = useState<'all' | 'critical' | 'warning' | 'info'>('all');
  const [enabledFilter, setEnabledFilter] = useState<'all' | 'on' | 'off'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Sort
  const [sortKey, setSortKey] = useState<SortKey>('severity');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const loadData = async () => {
    try {
      const [rulesData, channelsData, servicesData, hostsData] = await Promise.all([
        api.getAlertRules(),
        api.getNotificationChannels(),
        api.getServices(),
        api.getHosts(),
      ]);
      setRules(rulesData);
      setChannels(channelsData);
      setServices(servicesData);
      setHosts(hostsData);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (addTrigger) handleAddRule();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addTrigger]);

  const handleToggle = async (id: string) => {
    setTogglingIds(prev => new Set(prev).add(id));
    try {
      const result = await api.toggleAlertRule(id);
      setRules(prev => prev.map(r => r.id === id ? { ...r, isEnabled: result.isEnabled } : r));
      toast.success(result.isEnabled ? t('alerts.rules.ruleEnabled') : t('alerts.rules.ruleDisabled'));
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

  const handleDeleteConfirm = async () => {
    if (!deleteTargetId) return;
    setIsDeleting(true);
    try {
      await api.deleteAlertRule(deleteTargetId);
      toast.success(t('alerts.rules.deleted'));
      setDeleteTargetId(null);
      loadData();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setIsDeleting(false);
    }
  };

  const handleEdit = (rule: AlertRule) => navigate(`/alerts/rules/${rule.id}/edit`);
  const handleAddRule = () => navigate('/alerts/rules/new');

  const filteredRules = useMemo(() => {
    const filtered = rules.filter(r => {
      if (categoryFilter !== 'all' && ruleCategory(r) !== categoryFilter) return false;
      if (severityFilter !== 'all' && r.severity !== severityFilter) return false;
      if (enabledFilter !== 'all' && (enabledFilter === 'on' ? !r.isEnabled : r.isEnabled)) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const target = targetLabel(r, services, hosts, t).toLowerCase();
        if (!r.name.toLowerCase().includes(q) && !target.includes(q)) return false;
      }
      return true;
    });

    return filtered.sort((a, b) => {
      let v = 0;
      if (sortKey === 'severity') v = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
      else if (sortKey === 'name') v = a.name.localeCompare(b.name);
      else if (sortKey === 'target') v = targetLabel(a, services, hosts, t).localeCompare(targetLabel(b, services, hosts, t));
      else if (sortKey === 'category') v = ruleCategory(a).localeCompare(ruleCategory(b));
      return sortDir === 'asc' ? v : -v;
    });
  }, [rules, categoryFilter, severityFilter, enabledFilter, searchQuery, sortKey, sortDir, services, hosts, t]);

  const onSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };

  const clearFilters = () => {
    setCategoryFilter('all');
    setSeverityFilter('all');
    setEnabledFilter('all');
    setSearchQuery('');
  };

  if (isLoading) {
    return (
      <div className="p-8 text-center text-slate-500">
        <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin mx-auto mb-2" />
        {t('common.loading')}
      </div>
    );
  }

  if (rules.length === 0) {
    return (
      <div className="bg-white dark:bg-bg-surface-dark border border-slate-200 dark:border-ui-border-dark rounded-xl">
        <EmptyState
          icon="rule"
          title={t('alerts.rules.noRules')}
          action={{ label: t('alerts.rules.addRule'), onClick: handleAddRule }}
        />
      </div>
    );
  }

  return (
    <>
      {/* Filter bar — category pills + severity/enabled + search */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <div className="inline-flex bg-slate-100 dark:bg-bg-surface-dark border border-slate-200 dark:border-ui-border-dark rounded-lg p-0.5">
          {([
            { id: 'all', label: t('common.all') },
            { id: 'endpoint', label: t('alerts.rules.endpointHealth', { defaultValue: 'Healthcheck' }) },
            { id: 'log', label: t('alerts.rules.logRule', { defaultValue: 'Log' }) },
            { id: 'resource', label: t('alerts.rules.serverResource', { defaultValue: 'Infra' }) },
            { id: 'system', label: t('alerts.rules.systemRule', { defaultValue: 'System' }) },
          ] as const).map(c => (
            <button
              key={c.id}
              onClick={() => setCategoryFilter(c.id)}
              className={`px-2.5 py-1.5 text-sm font-bold rounded-md transition-colors ${
                categoryFilter === c.id
                  ? 'bg-white dark:bg-ui-hover-dark text-primary shadow-sm'
                  : 'text-slate-500 hover:text-slate-700 dark:text-text-muted-dark dark:hover:text-white'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>

        <select
          value={severityFilter}
          onChange={e => setSeverityFilter(e.target.value as typeof severityFilter)}
          className="px-2 py-1.5 bg-white dark:bg-bg-surface-dark border border-slate-200 dark:border-ui-border-dark rounded-md text-sm font-medium text-slate-700 dark:text-text-muted-dark cursor-pointer"
        >
          <option value="all">{t('alerts.rules.severityAll', { defaultValue: 'All severity' })}</option>
          <option value="critical">Critical</option>
          <option value="warning">Warning</option>
          <option value="info">Info</option>
        </select>

        <select
          value={enabledFilter}
          onChange={e => setEnabledFilter(e.target.value as typeof enabledFilter)}
          className="px-2 py-1.5 bg-white dark:bg-bg-surface-dark border border-slate-200 dark:border-ui-border-dark rounded-md text-sm font-medium text-slate-700 dark:text-text-muted-dark cursor-pointer"
        >
          <option value="all">{t('alerts.rules.enabledAll', { defaultValue: 'All states' })}</option>
          <option value="on">{t('alerts.rules.enabledOn', { defaultValue: 'Enabled' })}</option>
          <option value="off">{t('alerts.rules.enabledOff', { defaultValue: 'Disabled' })}</option>
        </select>

        <div className="ml-auto relative w-64">
          <MaterialIcon name="search" className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-base pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder={t('alerts.rules.searchPlaceholder', { defaultValue: 'Name or target…' })}
            className="w-full pl-7 pr-7 py-1.5 bg-white dark:bg-bg-surface-dark border border-slate-200 dark:border-ui-border-dark rounded-md text-sm outline-none focus:ring-1 focus:ring-primary dark:text-white"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-1 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-700"
              aria-label="Clear"
            >
              <MaterialIcon name="close" className="text-sm" />
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-bg-surface-dark border border-slate-200 dark:border-ui-border-dark rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1080px] table-fixed text-sm">
            <thead>
              <tr className="bg-slate-50 dark:bg-bg-surface-dark/50 border-b border-slate-200 dark:border-ui-border-dark">
                <SortableTH className="w-[260px]" label={t('alerts.rules.colName', { defaultValue: 'Rule' })} active={sortKey === 'name'} dir={sortDir} onClick={() => onSort('name')} />
                <SortableTH className="w-[220px]" label={t('alerts.rules.colTarget', { defaultValue: 'Target' })} active={sortKey === 'target'} dir={sortDir} onClick={() => onSort('target')} />
                <th className="w-[330px] px-4 py-3 text-left text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-text-muted-dark">
                  {t('alerts.rules.colTrigger', { defaultValue: 'Trigger' })}
                </th>
                <th className="w-[210px] px-4 py-3 text-left text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-text-muted-dark">
                  {t('alerts.rules.colChannels', { defaultValue: 'Channels' })}
                </th>
                <th className="w-[130px] px-4 py-3 text-right text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-text-muted-dark">
                  {t('alerts.rules.colActions', { defaultValue: 'Actions' })}
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredRules.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-10 text-center text-sm text-slate-500 dark:text-text-muted-dark">
                    {t('alerts.rules.noFilterResults', { defaultValue: 'No rules match your filters' })}{' · '}
                    <button onClick={clearFilters} className="text-primary hover:underline font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 rounded">
                      {t('common.clearFilters', { defaultValue: 'Clear filters' })}
                    </button>
                  </td>
                </tr>
              ) : (
                filteredRules.map(rule => {
                  const cat = ruleCategory(rule);
                  const sevBadge = SEVERITY_BADGE[rule.severity] ?? SEVERITY_BADGE.info;
                  return (
                    <tr
                      key={rule.id}
                      className={`border-t border-slate-100 transition-colors hover:bg-slate-50 dark:border-ui-border-dark/50 dark:hover:bg-ui-hover-dark/40 ${!rule.isEnabled ? 'bg-slate-50/70 dark:bg-ui-hover-dark/20' : ''}`}
                    >
                      <td className="px-4 py-3 align-top">
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-slate-900 dark:text-white">{rule.name}</p>
                          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                            <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-bold ${CATEGORY_TONE[cat]}`}>
                              {categoryLabel(cat, t)}
                            </span>
                            <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-bold ${sevBadge}`}>
                              {severityLabel(rule.severity, t)}
                            </span>
                            {rule.isSystem && (
                              <span className="inline-flex items-center gap-0.5 rounded bg-slate-100 px-1.5 py-0.5 text-xs font-bold text-slate-500 dark:bg-ui-hover-dark dark:text-text-muted-dark">
                                <MaterialIcon name="lock" className="text-xs" />
                                {t('alerts.rules.builtIn')}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 align-top text-sm text-slate-700 dark:text-text-muted-dark">
                        <span className="block truncate font-medium text-slate-800 dark:text-text-base-dark">
                          {targetLabel(rule, services, hosts, t)}
                        </span>
                        <span className="mt-1 block text-xs text-slate-400 dark:text-text-dim-dark">
                          {categoryLabel(cat, t)}
                        </span>
                      </td>
                      <td className="px-4 py-3 align-top text-sm">
                        <p className="font-semibold text-slate-900 dark:text-white">
                          {conditionExpr(rule, t)}
                        </p>
                        <p className="mt-1 text-xs leading-snug text-slate-500 dark:text-text-muted-dark">
                          {evaluationSummary(rule, t)}
                        </p>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <ChannelChips rule={rule} channels={channels} />
                      </td>
                      <td className="px-4 py-3 text-right align-top whitespace-nowrap">
                        <div className="inline-flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleToggle(rule.id)}
                            disabled={togglingIds.has(rule.id)}
                            className={`relative w-9 h-5 rounded-full transition-colors duration-200 ${rule.isEnabled ? 'bg-primary' : 'bg-slate-300 dark:bg-slate-600'} disabled:opacity-50`}
                            title={rule.isEnabled ? t('alerts.disable', { defaultValue: 'Disable' }) : t('alerts.enable', { defaultValue: 'Enable' })}
                          >
                            <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 ${rule.isEnabled ? 'translate-x-4' : 'translate-x-0'}`} />
                          </button>
                          <button
                            onClick={() => handleEdit(rule)}
                            className="p-1 text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-ui-hover-dark rounded transition-all"
                            title={t('common.edit', { defaultValue: 'Edit' })}
                          >
                            <MaterialIcon name="edit" className="text-base" />
                          </button>
                          {!rule.isSystem && (
                            <button
                              onClick={() => setDeleteTargetId(rule.id)}
                              disabled={isDeleting}
                              className="p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-all disabled:opacity-50"
                              title={t('common.delete', { defaultValue: 'Delete' })}
                            >
                              <MaterialIcon name="delete" className="text-base" />
                            </button>
                          )}
                        </div>
                        <div className={`mt-1 text-xs font-semibold ${rule.isEnabled ? 'text-primary' : 'text-slate-400 dark:text-text-dim-dark'}`}>
                          {rule.isEnabled ? t('common.enabled', { defaultValue: 'Enabled' }) : t('common.disabled')}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <div className="px-3 py-2 border-t border-slate-200 dark:border-ui-border-dark flex items-center justify-between text-sm text-slate-500 dark:text-text-muted-dark">
          <span>
            {t('alerts.rules.shownCount', { defaultValue: '{{shown}} of {{total}}', shown: filteredRules.length, total: rules.length })}
          </span>
          <span>
            {t('alerts.rules.sortedBy', { defaultValue: 'Sorted by' })} <span className="font-mono text-slate-700 dark:text-white">{sortKey}</span> {sortDir === 'asc' ? '↑' : '↓'}
          </span>
        </div>
      </div>

      <ConfirmDialog
        isOpen={!!deleteTargetId}
        onClose={() => setDeleteTargetId(null)}
        onConfirm={handleDeleteConfirm}
        title={t('alerts.rules.deleteConfirmTitle')}
        message={t('alerts.rules.deleteConfirmMessage', {
          name: rules.find(r => r.id === deleteTargetId)?.name ?? deleteTargetId,
        })}
        description={t('alerts.rules.deleteConfirmWarning')}
        variant="danger"
        isProcessing={isDeleting}
      />
    </>
  );
}

function SortableTH({ label, active, dir, onClick, className = '' }: { label: string; active: boolean; dir: SortDir; onClick: () => void; className?: string }) {
  return (
    <th className={`cursor-pointer select-none px-4 py-3 text-left text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-text-muted-dark ${className}`} onClick={onClick}>
      <span className={`inline-flex items-center gap-1 ${active ? 'text-slate-900 dark:text-white' : ''}`}>
        {label}
        <span className={active ? 'opacity-100' : 'opacity-30'}>{active && dir === 'desc' ? '↓' : '↑'}</span>
      </span>
    </th>
  );
}

function ChannelChips({ rule, channels }: { rule: AlertRule; channels: NotificationChannel[] }) {
  const { t } = useTranslation('alerts');
  if (!rule.channelIds || rule.channelIds.length === 0) {
    return (
      <span className="text-sm italic text-slate-400 dark:text-text-dim-dark">
        {t('alerts.rules.allChannelsDisplay', { defaultValue: 'all channels' })}
      </span>
    );
  }
  const visible = rule.channelIds.slice(0, 3);
  const remaining = rule.channelIds.length - visible.length;
  return (
    <div className="flex items-center gap-1 flex-wrap">
      {visible.map(cid => {
        const ch = channels.find(c => c.id === cid);
        if (!ch) return null;
        const style = getChannelStyle(ch.type);
        return (
          <span
            key={cid}
            className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-semibold ${style.bg} ${style.text} max-w-[110px]`}
          >
            <ChannelIcon type={ch.type} size={10} />
            <span className="truncate">{ch.name}</span>
          </span>
        );
      })}
      {remaining > 0 && (
        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-semibold bg-slate-100 dark:bg-ui-hover-dark text-slate-500 dark:text-text-muted-dark">
          +{remaining}
        </span>
      )}
    </div>
  );
}
