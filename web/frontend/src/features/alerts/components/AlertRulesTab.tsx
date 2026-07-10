import { useState, useEffect, useMemo } from 'react';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { getErrorMessage } from '../../../utils/errors';
import { MaterialIcon, EmptyState, ConfirmDialog, Toggle } from '../../../components/common';
import { api, type AlertRule, type NotificationChannel, type AgentServiceFlat, type ConnectedAgent } from '../../../services/api';
import { AlertRuleForm } from './AlertRuleForm';

const SEVERITY_DOT: Record<string, string> = {
  critical: 'bg-red-500',
  warning: 'bg-amber-500',
  info: 'bg-sky-500',
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
  const { t } = useTranslation(['alerts', 'common']);
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [channels, setChannels] = useState<NotificationChannel[]>([]);
  const [agentServices, setAgentServices] = useState<AgentServiceFlat[]>([]);
  const [agents, setAgents] = useState<ConnectedAgent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [togglingIds, setTogglingIds] = useState<Set<string>>(new Set());
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Inline rule form (replaces the /alerts/rules/new|edit page navigation)
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
  const inlineForm = formOpen ? (
    <div className="mb-5 rounded-xl border border-primary/40 bg-white dark:bg-bg-surface-dark overflow-hidden">
      <div className="flex items-center justify-between gap-4 px-6 py-3 border-b border-slate-200 dark:border-ui-border-dark">
        <h3 className="text-base font-bold text-slate-900 dark:text-white">
          {formRule
            ? t('alerts.rules.editTitle', { defaultValue: '규칙 편집' })
            : t('alerts.rules.newTitle', { defaultValue: '새 알림 규칙' })}
        </h3>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={closeForm}
            className="px-4 py-2 text-sm font-bold border border-slate-200 dark:border-ui-border-dark rounded-lg text-slate-600 dark:text-text-muted-dark hover:bg-slate-50 dark:hover:bg-ui-hover-dark transition-colors"
          >
            {t('common.cancel')}
          </button>
          <button
            type="submit"
            form="alert-rule-form"
            disabled={formLoading || isSubmitting}
            className="px-5 py-2 bg-primary text-white text-sm font-bold rounded-lg hover:bg-primary/90 transition-all shadow-sm active:scale-95 disabled:opacity-50 flex items-center gap-1.5"
          >
            {isSubmitting ? (
              <MaterialIcon name="sync" className="text-base animate-spin" />
            ) : (
              <>
                <MaterialIcon name="check" className="text-sm" />
                {formRule ? t('common.save') : t('alerts.rules.create')}
              </>
            )}
          </button>
        </div>
      </div>
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
    </div>
  ) : null;

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
        {inlineForm}
        {!formOpen && (
          <div className="bg-white dark:bg-bg-surface-dark border border-slate-200 dark:border-ui-border-dark rounded-xl">
            <EmptyState
              icon="rule"
              title={t('alerts.rules.noRules')}
              action={{ label: t('alerts.rules.addRule'), onClick: handleAddRule }}
            />
          </div>
        )}
      </>
    );
  }

  return (
    <>
      {inlineForm}
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
          <table className="w-full min-w-[1040px] table-fixed text-sm">
            <thead>
              <tr className="bg-slate-50 dark:bg-bg-surface-dark/50 border-b border-slate-200 dark:border-ui-border-dark">
                <SortableTH className="w-[300px]" label={t('alerts.rules.colName', { defaultValue: 'Rule' })} active={sortKey === 'name'} dir={sortDir} onClick={() => onSort('name')} />
                <SortableTH className="w-[220px]" label={t('alerts.rules.colTarget', { defaultValue: 'Target' })} active={sortKey === 'target'} dir={sortDir} onClick={() => onSort('target')} />
                <th className="w-[300px] px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-text-muted-dark">
                  {t('alerts.rules.colTrigger', { defaultValue: 'Trigger' })}
                </th>
                <th className="w-[140px] px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-text-muted-dark">
                  {t('alerts.rules.colChannels', { defaultValue: 'Channels' })}
                </th>
                <th className="w-[110px] px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-text-muted-dark">
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
                  const severityDot = SEVERITY_DOT[rule.severity] ?? SEVERITY_DOT.info;
                  return (
                    <tr
                      key={rule.id}
                      className={`h-12 border-t border-slate-100 transition-colors hover:bg-slate-50 dark:border-ui-border-dark/50 dark:hover:bg-ui-hover-dark/40 ${!rule.isEnabled ? 'bg-slate-50/70 dark:bg-ui-hover-dark/20' : ''}`}
                    >
                      <td className="px-4 py-2 align-middle">
                        <div className="flex min-w-0 items-center gap-2">
                          <span className={`h-2 w-2 shrink-0 rounded-full ${severityDot}`} title={severityLabel(rule.severity, t)} />
                          <span className={`truncate font-semibold ${rule.isEnabled ? 'text-slate-900 dark:text-white' : 'text-slate-500 dark:text-text-muted-dark'}`}>
                            {rule.name}
                          </span>
                          {rule.isSystem && (
                            <MaterialIcon name="lock" className="shrink-0 text-sm text-slate-400" />
                          )}
                          <span className="shrink-0 text-xs font-semibold text-slate-400 dark:text-text-dim-dark">
                            {categoryLabel(cat, t)}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-2 align-middle text-sm text-slate-700 dark:text-text-muted-dark">
                        <span className="block truncate font-medium text-slate-800 dark:text-text-base-dark" title={targetLabel(rule, agentServices, agents, t)}>
                          {targetLabel(rule, agentServices, agents, t)}
                        </span>
                      </td>
                      <td className="px-4 py-2 align-middle text-sm">
                        <p className="truncate font-semibold text-slate-900 dark:text-white" title={evaluationSummary(rule, t)}>
                          {compactTrigger(rule, t)}
                        </p>
                      </td>
                      <td className="px-4 py-2 align-middle">
                        <ChannelSummary rule={rule} channels={channels} />
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
                            className="p-1 text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-ui-hover-dark rounded transition-all"
                            title={t('common.edit', { defaultValue: 'Edit' })}
                          >
                            <MaterialIcon name="edit" className="text-base" />
                          </button>
                          <button
                            onClick={() => {
                              if (!rule.isSystem) setDeleteTargetId(rule.id);
                            }}
                            disabled={rule.isSystem || isDeleting}
                            className={`p-1 rounded transition-all ${
                              rule.isSystem
                                ? 'cursor-not-allowed text-slate-300 dark:text-text-dim-dark'
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
    <th className={`cursor-pointer select-none px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-text-muted-dark ${className}`} onClick={onClick}>
      <span className={`inline-flex items-center gap-1 ${active ? 'text-slate-900 dark:text-white' : ''}`}>
        {label}
        <span className={active ? 'opacity-100' : 'opacity-30'}>{active && dir === 'desc' ? '↓' : '↑'}</span>
      </span>
    </th>
  );
}

function ChannelSummary({ rule, channels }: { rule: AlertRule; channels: NotificationChannel[] }) {
  const { t } = useTranslation('alerts');
  const selectedCount = rule.channelIds?.length ?? 0;
  const channelCount = selectedCount === 0 ? channels.length : selectedCount;

  if (channelCount === 0) {
    return (
      <span className="inline-flex max-w-full items-center gap-1.5 text-sm font-medium text-slate-400 dark:text-text-dim-dark">
        <MaterialIcon name="notifications_off" className="shrink-0 text-base" />
        <span className="truncate">{t('alerts.rules.noChannels')}</span>
      </span>
    );
  }

  if (!rule.channelIds || rule.channelIds.length === 0) {
    return (
      <span
        className="inline-flex max-w-full items-center gap-1.5 text-sm font-medium text-slate-500 dark:text-text-muted-dark"
        title={t('alerts.rules.allChannelsDisplay', { defaultValue: 'all channels' })}
      >
        <MaterialIcon name="notifications" className="shrink-0 text-base text-slate-400" />
        <span className="truncate">
          {t('alerts.rules.channelSummaryAll', {
            count: channelCount,
            defaultValue: `All ${channelCount}`,
          })}
        </span>
      </span>
    );
  }

  const names = rule.channelIds
    .map(cid => channels.find(c => c.id === cid)?.name)
    .filter(Boolean)
    .join(', ');

  return (
    <span
      className="inline-flex max-w-full items-center gap-1.5 text-sm font-medium text-slate-700 dark:text-text-base-dark"
      title={names || undefined}
    >
      <MaterialIcon name="notifications_active" className="shrink-0 text-base text-slate-400" />
      <span className="truncate">
        {t('alerts.rules.channelSummarySelected', {
          count: channelCount,
          defaultValue: `${channelCount} selected`,
        })}
      </span>
    </span>
  );
}
