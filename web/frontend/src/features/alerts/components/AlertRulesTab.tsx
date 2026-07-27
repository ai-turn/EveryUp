import { useState, useEffect, useMemo } from 'react';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { getErrorMessage } from '../../../utils/errors';
import { Button, MaterialIcon, EmptyState, ConfirmDialog, Toggle, SegmentedControl, SearchInput } from '../../../components/common';
import { ChannelIcon } from '../../../components/icons/ChannelIcons';
import { api, type AlertRule, type NotificationChannel, type AgentServiceFlat, type ConnectedAgent } from '../../../services/api';
import { getChannelStyle } from '../utils/channelMeta';
import { AlertRuleForm } from './AlertRuleForm';
import { FormSidePanel } from './FormSidePanel';
import { formatDistanceToNow } from 'date-fns';
import { ko, enUS } from 'date-fns/locale';

const SEVERITY_BADGE: Record<string, string> = {
  critical: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400',
  warning: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400',
  info: 'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-400',
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

function ruleCategory(rule: AlertRule): Exclude<CategoryKey, 'all'> {
  if (rule.isSystem) return 'system';
  if (rule.type === 'service') return 'endpoint';
  if (rule.type === 'log') return 'log';
  return 'resource';
}

function targetLabel(rule: AlertRule, agentServices: AgentServiceFlat[], agents: ConnectedAgent[], t: (k: string) => string): string {
  if (rule.type === 'service' || rule.type === 'log') {
    if (rule.agentId && rule.serviceKey) {
      const svc = agentServices.find(s => s.agentId === rule.agentId && s.key === rule.serviceKey);
      return svc ? `${svc.agentName} / ${svc.name}` : rule.serviceKey;
    }
    return rule.type === 'log' ? t('alerts.rules.allLogServices') : t('alerts.rules.allHealthchecks');
  }
  if (rule.agentId) return agents.find(a => a.id === rule.agentId)?.name ?? rule.agentId;
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

function compactTrigger(rule: AlertRule, t: Translate): string {
  if (rule.isSystem) {
    return t('alerts.rules.eval.system', { defaultValue: 'Managed by the system' });
  }
  if (rule.type === 'log') {
    return t('alerts.rules.compactTriggerImmediate', {
      condition: conditionExpr(rule, t),
      defaultValue: `${conditionExpr(rule, t)} · immediate`,
    });
  }
  if (rule.type === 'service') {
    return t('alerts.rules.compactTriggerChecks', {
      condition: conditionExpr(rule, t),
      count: rule.duration,
      defaultValue: `${conditionExpr(rule, t)} · ${rule.duration} checks`,
    });
  }
  return t('alerts.rules.compactTriggerSustained', {
    condition: conditionExpr(rule, t),
    duration: formatMinutes(rule.duration, t),
    defaultValue: `${conditionExpr(rule, t)} · ${formatMinutes(rule.duration, t)}`,
  });
}

type SortKey = 'severity' | 'name' | 'target' | 'category';
type SortDir = 'asc' | 'desc';

interface AlertRulesTabProps {
  addTrigger?: number;
}

export function AlertRulesTab({ addTrigger }: AlertRulesTabProps) {
  const { t, i18n } = useTranslation(['alerts', 'common']);
  const dateLocale = i18n.language === 'ko' ? ko : enUS;
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [channels, setChannels] = useState<NotificationChannel[]>([]);
  const [agentServices, setAgentServices] = useState<AgentServiceFlat[]>([]);
  const [agents, setAgents] = useState<ConnectedAgent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [togglingIds, setTogglingIds] = useState<Set<string>>(new Set());
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Rule form — right slide-over panel
  const [formOpen, setFormOpen] = useState(false);
  const [formRule, setFormRule] = useState<AlertRule | undefined>(undefined);
  const [formLoading, setFormLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
      const [rulesData, channelsData, agentSvcs, agts] = await Promise.all([
        api.getAlertRules(),
        api.getNotificationChannels(),
        api.getAllAgentServicesFlat(),
        api.getAgents(),
      ]);
      setRules(rulesData);
      setChannels(channelsData);
      setAgentServices(agentSvcs ?? []);
      setAgents(agts ?? []);
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

  const closeForm = () => { setFormOpen(false); setFormRule(undefined); };
  const onFormSuccess = () => { closeForm(); loadData(); };

  const handleAddRule = () => { setFormRule(undefined); setFormLoading(false); setFormOpen(true); };

  // Edit fetches the full rule (list rows may omit channelIds) — same as the old page.
  const handleEdit = async (rule: AlertRule) => {
    setFormRule(undefined);
    setFormOpen(true);
    setFormLoading(true);
    try {
      setFormRule(await api.getAlertRuleById(rule.id));
    } catch (error) {
      toast.error(getErrorMessage(error));
      closeForm();
    } finally {
      setFormLoading(false);
    }
  };

  const filteredRules = useMemo(() => {
    const filtered = rules.filter(r => {
      if (categoryFilter !== 'all' && ruleCategory(r) !== categoryFilter) return false;
      if (severityFilter !== 'all' && r.severity !== severityFilter) return false;
      if (enabledFilter !== 'all' && (enabledFilter === 'on' ? !r.isEnabled : r.isEnabled)) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const target = targetLabel(r, agentServices, agents, t).toLowerCase();
        if (!r.name.toLowerCase().includes(q) && !target.includes(q)) return false;
      }
      return true;
    });

    return filtered.sort((a, b) => {
      let v = 0;
      if (sortKey === 'severity') v = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
      else if (sortKey === 'name') v = a.name.localeCompare(b.name);
      else if (sortKey === 'target') v = targetLabel(a, agentServices, agents, t).localeCompare(targetLabel(b, agentServices, agents, t));
      else if (sortKey === 'category') v = ruleCategory(a).localeCompare(ruleCategory(b));
      return sortDir === 'asc' ? v : -v;
    });
  }, [rules, categoryFilter, severityFilter, enabledFilter, searchQuery, sortKey, sortDir, agentServices, agents, t]);

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

  // Inline expanding form — reuses AlertRuleForm; submit button lives here and
  // targets the form via form="alert-rule-form" (same wiring as the old page).
  const formActions = (
    <div className="flex items-center gap-2 shrink-0">
      <Button type="button" variant="secondary" onClick={closeForm}>
        {t('common.cancel')}
      </Button>
      <Button
        type="submit"
        form="alert-rule-form"
        disabled={formLoading || isSubmitting}
      >
        {isSubmitting ? (
          <MaterialIcon name="sync" className="text-base animate-spin" />
        ) : (
          <>
            <MaterialIcon name="check" className="text-sm" />
            {formRule ? t('common.save') : t('alerts.rules.create')}
          </>
        )}
      </Button>
    </div>
  );

  const formPanel = (
    <FormSidePanel
      open={formOpen}
      icon="rule"
      title={formRule
        ? t('alerts.rules.editTitle', { defaultValue: '규칙 편집' })
        : t('alerts.rules.newTitle', { defaultValue: '새 알림 규칙' })}
      onClose={closeForm}
      footer={formActions}
    >
      {formLoading ? (
        <div className="flex min-h-40 items-center justify-center">
          <MaterialIcon name="sync" className="text-3xl text-primary animate-spin" />
        </div>
      ) : (
        <AlertRuleForm
          rule={formRule}
          channels={channels}
          onSuccess={onFormSuccess}
          onCancel={closeForm}
          onSubmittingChange={setIsSubmitting}
        />
      )}
    </FormSidePanel>
  );

  if (isLoading) {
    return (
      <div className="p-8 text-center text-slate-500">
        <MaterialIcon name="sync" className="text-3xl text-primary animate-spin mx-auto mb-2 block" />
        {t('common.loading')}
      </div>
    );
  }

  if (rules.length === 0) {
    return (
      <>
        {formPanel}
        <div className="bg-bg-surface border border-ui-border rounded-xl">
          <EmptyState
            icon="rule"
            title={t('alerts.rules.noRules')}
            action={{ label: t('alerts.rules.addRule'), onClick: handleAddRule }}
          />
        </div>
      </>
    );
  }

  return (
    <>
      {formPanel}
      {/* Filter bar — category pills + severity/enabled + search */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <SegmentedControl
          size="md"
          ariaLabel={t('alerts.rules.category', { defaultValue: 'Category' })}
          value={categoryFilter}
          onChange={setCategoryFilter}
          options={[
            { value: 'all', label: t('common.all') },
            { value: 'endpoint', label: t('alerts.rules.endpointHealth', { defaultValue: 'Healthcheck' }) },
            { value: 'log', label: t('alerts.rules.logRule', { defaultValue: 'Log' }) },
            { value: 'resource', label: t('alerts.rules.serverResource', { defaultValue: 'Infra' }) },
            { value: 'system', label: t('alerts.rules.systemRule', { defaultValue: 'System' }) },
          ]}
        />

        <select
          value={severityFilter}
          onChange={e => setSeverityFilter(e.target.value as typeof severityFilter)}
          className="px-2 py-1.5 bg-bg-surface border border-ui-border rounded-md text-sm font-medium text-text-secondary cursor-pointer"
        >
          <option value="all">{t('alerts.rules.severityAll', { defaultValue: 'All severity' })}</option>
          <option value="critical">Critical</option>
          <option value="warning">Warning</option>
          <option value="info">Info</option>
        </select>

        <select
          value={enabledFilter}
          onChange={e => setEnabledFilter(e.target.value as typeof enabledFilter)}
          className="px-2 py-1.5 bg-bg-surface border border-ui-border rounded-md text-sm font-medium text-text-secondary cursor-pointer"
        >
          <option value="all">{t('alerts.rules.enabledAll', { defaultValue: 'All states' })}</option>
          <option value="on">{t('alerts.rules.enabledOn', { defaultValue: 'Enabled' })}</option>
          <option value="off">{t('alerts.rules.enabledOff', { defaultValue: 'Disabled' })}</option>
        </select>

        <div className="ml-auto relative w-64">
          <SearchInput
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder={t('alerts.rules.searchPlaceholder', { defaultValue: 'Name or target…' })}
            className="pr-7"
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
      <div className="bg-bg-surface border border-ui-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1180px] table-fixed text-sm">
            <thead>
              <tr className="bg-slate-50 dark:bg-bg-surface-dark/50 border-b border-ui-border">
                <SortableTH className="w-[260px]" label={t('alerts.rules.colName', { defaultValue: 'Rule' })} active={sortKey === 'name'} dir={sortDir} onClick={() => onSort('name')} />
                <SortableTH className="w-[110px]" label={t('alerts.rules.colSeverity', { defaultValue: 'Severity' })} active={sortKey === 'severity'} dir={sortDir} onClick={() => onSort('severity')} />
                <SortableTH className="w-[200px]" label={t('alerts.rules.colTarget', { defaultValue: 'Target' })} active={sortKey === 'target'} dir={sortDir} onClick={() => onSort('target')} />
                <th className="w-[250px] px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-text-muted">
                  {t('alerts.rules.colTrigger', { defaultValue: 'Trigger' })}
                </th>
                <th className="w-[120px] px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-text-muted">
                  {t('alerts.rules.colChannels', { defaultValue: 'Channels' })}
                </th>
                <th className="w-[120px] px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-text-muted">
                  {t('alerts.rules.colLastFired', { defaultValue: 'Last fired' })}
                </th>
                <th className="w-[120px] px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-text-muted">
                  {t('alerts.rules.colActions', { defaultValue: 'Actions' })}
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredRules.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-10 text-center text-sm text-text-muted">
                    {t('alerts.rules.noFilterResults', { defaultValue: 'No rules match your filters' })}{' · '}
                    <button onClick={clearFilters} className="text-primary hover:underline font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 rounded">
                      {t('common.clearFilters', { defaultValue: 'Clear filters' })}
                    </button>
                  </td>
                </tr>
              ) : (
                filteredRules.map(rule => {
                  const cat = ruleCategory(rule);
                  return (
                    <tr
                      key={rule.id}
                      className={`border-t border-slate-100 transition-colors hover:bg-slate-50 dark:border-ui-border-dark/50 dark:hover:bg-ui-hover-dark/40 ${!rule.isEnabled ? 'bg-slate-50/70 dark:bg-ui-hover-dark/20' : ''}`}
                    >
                      <td className="px-4 py-2.5 align-middle">
                        <div className="flex min-w-0 items-center gap-2">
                          <span className={`truncate font-semibold ${rule.isEnabled ? 'text-text-base' : 'text-text-muted'}`}>
                            {rule.name}
                          </span>
                          {rule.isSystem && (
                            <MaterialIcon name="lock" className="shrink-0 text-sm text-slate-400" />
                          )}
                        </div>
                        <p className="truncate text-2xs text-text-dim">
                          {rule.isSystem
                            ? t('alerts.rules.systemRuleNote', { defaultValue: '시스템 기본 규칙 · 삭제 불가, 채널만 변경 가능' })
                            : categoryLabel(cat, t)}
                        </p>
                      </td>
                      <td className="px-4 py-2.5 align-middle">
                        <span className={`inline-flex rounded-md px-2 py-0.5 text-2xs font-bold uppercase tracking-wide ${SEVERITY_BADGE[rule.severity] ?? SEVERITY_BADGE.info}`}>
                          {severityLabel(rule.severity, t)}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 align-middle">
                        <span
                          className="inline-block max-w-full truncate rounded-md bg-slate-100 px-2 py-0.5 font-mono text-xs text-slate-700 dark:bg-ui-hover-dark dark:text-text-base-dark"
                          title={targetLabel(rule, agentServices, agents, t)}
                        >
                          {targetLabel(rule, agentServices, agents, t)}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 align-middle text-sm">
                        <p className="truncate text-text-secondary" title={evaluationSummary(rule, t)}>
                          {compactTrigger(rule, t)}
                        </p>
                      </td>
                      <td className="px-4 py-2.5 align-middle">
                        <ChannelAvatars rule={rule} channels={channels} />
                      </td>
                      <td className="px-4 py-2.5 align-middle text-sm text-text-muted whitespace-nowrap">
                        {rule.lastTriggeredAt
                          ? formatDistanceToNow(new Date(rule.lastTriggeredAt), { addSuffix: true, locale: dateLocale })
                          : <span className="text-text-dim">—</span>}
                      </td>
                      <td className="px-4 py-2 text-right align-middle whitespace-nowrap">
                        <div className="inline-flex items-center justify-end gap-1">
                          <Toggle
                            checked={rule.isEnabled}
                            onChange={() => handleToggle(rule.id)}
                            disabled={togglingIds.has(rule.id)}
                            title={rule.isEnabled ? t('alerts.disable', { defaultValue: 'Disable' }) : t('alerts.enable', { defaultValue: 'Enable' })}
                          />
                          <button
                            onClick={() => handleEdit(rule)}
                            className="p-1 text-slate-500 hover:text-text-base hover:bg-ui-hover rounded transition-all"
                            aria-label={t('common.edit', { defaultValue: 'Edit' })}
                          title={t('common.edit', { defaultValue: 'Edit' })}
                          >
                            <MaterialIcon name="edit" className="text-base" />
                          </button>
                          <button
                            onClick={() => {
                              if (!rule.isSystem) setDeleteTargetId(rule.id);
                            }}
                            aria-label={t('common.delete', { defaultValue: 'Delete' })}
                            disabled={rule.isSystem || isDeleting}
                            className={`p-1 rounded transition-all ${
                              rule.isSystem
                                ? 'cursor-not-allowed text-text-dim'
                                : 'text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50'
                            }`}
                            title={rule.isSystem
                              ? t('alerts.rules.systemRuleDeleteDisabled')
                              : t('common.delete', { defaultValue: 'Delete' })}
                          >
                            <MaterialIcon name="delete_outline" className="text-base" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
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
    <th className={`cursor-pointer select-none px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-text-muted ${className}`} onClick={onClick}>
      <span className={`inline-flex items-center gap-1 ${active ? 'text-text-base' : ''}`}>
        {label}
        <span className={active ? 'opacity-100' : 'opacity-30'}>{active && dir === 'desc' ? '↓' : '↑'}</span>
      </span>
    </th>
  );
}

const MAX_CHANNEL_AVATARS = 4;

function ChannelAvatars({ rule, channels }: { rule: AlertRule; channels: NotificationChannel[] }) {
  const { t } = useTranslation('alerts');

  // Empty channelIds = the rule notifies all channels
  const ruleChannels = !rule.channelIds || rule.channelIds.length === 0
    ? channels
    : rule.channelIds
        .map(cid => channels.find(c => c.id === cid))
        .filter((c): c is NotificationChannel => !!c);

  if (ruleChannels.length === 0) {
    return (
      <span className="inline-flex max-w-full items-center gap-1.5 text-sm font-medium text-text-dim">
        <MaterialIcon name="notifications_off" className="shrink-0 text-base" />
        <span className="truncate">{t('alerts.rules.noChannels')}</span>
      </span>
    );
  }

  const visible = ruleChannels.slice(0, MAX_CHANNEL_AVATARS);
  const overflow = ruleChannels.length - visible.length;
  const names = ruleChannels.map(c => c.name).join(', ');

  return (
    <div className="flex items-center" title={names}>
      {visible.map((ch, i) => {
        const style = getChannelStyle(ch.type);
        return (
          <div
            key={ch.id}
            className={`flex h-6 w-6 items-center justify-center rounded-md ring-2 ring-white dark:ring-bg-surface-dark ${style.bg} ${i > 0 ? '-ml-1.5' : ''}`}
          >
            <ChannelIcon type={ch.type} size={13} className={style.text} />
          </div>
        );
      })}
      {overflow > 0 && (
        <span className="-ml-1.5 flex h-6 w-6 items-center justify-center rounded-md bg-slate-100 text-2xs font-bold text-slate-500 ring-2 ring-white dark:bg-ui-hover-dark dark:text-text-muted-dark dark:ring-bg-surface-dark">
          +{overflow}
        </span>
      )}
    </div>
  );
}
