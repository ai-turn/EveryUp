import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { getErrorMessage } from '../../../utils/errors';
import { MaterialIcon } from '../../../components/common';
import { api, type AlertRule, type NotificationChannel, type Service, type Host } from '../../../services/api';
import { useSidePanel } from '../../../contexts/SidePanelContext';
import { AlertRuleForm } from './AlertRuleForm';

const SEVERITY_CONFIG = {
  critical: { icon: 'error', color: 'text-red-500', bg: 'bg-red-50 dark:bg-red-900/20', badge: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400' },
  warning: { icon: 'warning', color: 'text-amber-500', bg: 'bg-amber-50 dark:bg-amber-900/20', badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400' },
  info: { icon: 'info', color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-900/20', badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400' },
};

const METRIC_LABELS: Record<string, string> = {
  cpu: 'CPU',
  memory: 'Memory',
  disk: 'Disk',
  status_change: 'Status',
  http_status: 'HTTP Status',
  response_time: 'Response Time',
};

const ENDPOINT_METRICS = new Set(['http_status', 'response_time']);

const OPERATOR_LABELS: Record<string, string> = {
  gt: '>',
  gte: '>=',
  lt: '<',
  lte: '<=',
  eq: '=',
};

function httpStatusConditionLabel(operator: string, threshold: number): string {
  if (operator === 'lte' && threshold === 299) return 'HTTP 2xx (Normal)';
  if (operator === 'gte' && threshold === 400) return 'HTTP 4xx+ (Error)';
  if (operator === 'gte' && threshold === 500) return 'HTTP 5xx (Server Error)';
  const op = OPERATOR_LABELS[operator] ?? operator;
  return `HTTP Status ${op} ${threshold}`;
}

interface TargetBadgeProps {
  rule: AlertRule;
  services: Service[];
  hosts: Host[];
}

function TargetBadge({ rule, services, hosts }: TargetBadgeProps) {
  const { t } = useTranslation(['alerts', 'common']);

  if (rule.type === 'service') {
    if (rule.serviceId) {
      const svc = services.find(s => s.id === rule.serviceId);
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-bold rounded-full bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-400 max-w-30">
          <MaterialIcon name="http" className="text-xs" />
          <span className="truncate">{svc?.name ?? rule.serviceId}</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-bold rounded-full bg-slate-100 text-slate-500 dark:bg-ui-hover-dark dark:text-text-muted-dark">
        <MaterialIcon name="public" className="text-xs" />
        {t('alerts.rules.allServices')}
      </span>
    );
  }

  if (rule.hostId) {
    const host = hosts.find(h => h.id === rule.hostId);
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-bold rounded-full bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-400 max-w-30">
        <MaterialIcon name="dns" className="text-xs" />
        <span className="truncate">{host?.name ?? rule.hostId}</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-bold rounded-full bg-slate-100 text-slate-500 dark:bg-ui-hover-dark dark:text-text-muted-dark">
      <MaterialIcon name="public" className="text-xs" />
      {t('alerts.rules.allHosts')}
    </span>
  );
}

interface AlertRulesTabProps {
  addTrigger?: number;
}

export function AlertRulesTab({ addTrigger }: AlertRulesTabProps) {
  const { t } = useTranslation(['alerts', 'common']);
  const { openPanel } = useSidePanel();
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [channels, setChannels] = useState<NotificationChannel[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [hosts, setHosts] = useState<Host[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [togglingIds, setTogglingIds] = useState<Set<string>>(new Set());
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

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
      setRules(prev =>
        prev.map(r => r.id === id ? { ...r, isEnabled: result.isEnabled } : r)
      );
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

  const handleEdit = (rule: AlertRule) => {
    openPanel(
      t('alerts.rules.editTitle'),
      <AlertRuleForm rule={rule} channels={channels} onSuccess={loadData} />
    );
  };

  const handleAddRule = () => {
    openPanel(
      t('alerts.rules.newTitle'),
      <AlertRuleForm channels={channels} onSuccess={loadData} />
    );
  };

  if (isLoading) {
    return (
      <div className="p-8 text-center text-slate-500">
        <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin mx-auto mb-2" />
        {t('common.loading')}
      </div>
    );
  }

  return (
    <>
      <p className="text-sm text-slate-500 dark:text-text-muted-dark mb-4">
        {t('alerts.rules.rulesCount_other', { count: rules.length })}
      </p>

      <div className="space-y-3">
        {rules.length === 0 ? (
          <div className="bg-white dark:bg-bg-surface-dark border border-dashed border-slate-200 dark:border-ui-border-dark rounded-xl p-8 text-center">
            <p className="text-slate-400 dark:text-text-dim-dark text-sm mb-3">{t('alerts.rules.noRules')}</p>
            <button
              onClick={handleAddRule}
              className="px-5 py-1.5 bg-primary text-white font-bold rounded-lg hover:bg-primary/90 transition-all shadow-md text-sm"
            >
              {t('alerts.rules.addRule')}
            </button>
          </div>
        ) : (
          rules.map(rule => {
            const sev = SEVERITY_CONFIG[rule.severity] || SEVERITY_CONFIG.info;
            const channelNames = rule.channelIds
              ?.map(cid => channels.find(ch => ch.id === cid)?.name)
              .filter(Boolean);
            const isEndpoint = ENDPOINT_METRICS.has(rule.metric);
            const checkIntervalLabel = (() => {
              if (!isEndpoint) return null;
              const svc = services.find(s => s.id === rule.serviceId);
              if (!svc) return t('alerts.rules.perCheck');
              const sec = svc.interval;
              if (sec >= 3600) return `every ${Math.round(sec / 3600)}hr`;
              if (sec >= 60) return `every ${Math.round(sec / 60)}min`;
              return `every ${sec}s`;
            })();

            return (
              <div
                key={rule.id}
                className={`bg-white dark:bg-bg-surface-dark border border-slate-200 dark:border-ui-border-dark rounded-xl p-4 flex items-center gap-4 hover:border-slate-300 dark:hover:border-ui-active-dark transition-colors ${!rule.isEnabled ? 'opacity-50' : ''}`}
              >
                <div className={`w-10 h-10 ${sev.bg} rounded-lg flex items-center justify-center shrink-0`}>
                  <MaterialIcon name={sev.icon} className={`text-xl ${sev.color}`} />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    <h3 className="font-bold text-slate-900 dark:text-white truncate">{rule.name}</h3>
                    <span className={`px-2 py-0.5 text-xs font-bold uppercase tracking-wider rounded-full ${sev.badge}`}>
                      {rule.severity}
                    </span>
                    <TargetBadge rule={rule} services={services} hosts={hosts} />
                    {rule.id.startsWith('preset-') && (
                      <span className="px-2 py-0.5 text-xs font-bold uppercase tracking-wider bg-slate-100 text-slate-500 dark:bg-ui-hover-dark dark:text-text-muted-dark rounded-full">
                        {t('alerts.rules.preset')}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-slate-500 dark:text-text-muted-dark">
                    {rule.metric === 'http_status'
                      ? httpStatusConditionLabel(rule.operator, rule.threshold)
                      : `${METRIC_LABELS[rule.metric] || rule.metric} ${OPERATOR_LABELS[rule.operator] || rule.operator} ${rule.threshold}${rule.metric === 'response_time' ? 'ms' : ENDPOINT_METRICS.has(rule.metric) ? '' : '%'}`
                    }
                    {' · '}
                    {isEndpoint ? `${checkIntervalLabel} · ${rule.duration}× fail` : `${rule.duration}min · cooldown ${rule.cooldown}s`}
                    {channelNames && channelNames.length > 0 && (
                      <> · <span className="text-primary">{channelNames.join(', ')}</span></>
                    )}
                    {(!rule.channelIds || rule.channelIds.length === 0) && (
                      <> · <span className="italic">{t('alerts.rules.allChannels')}</span></>
                    )}
                  </p>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <button
                    onClick={() => handleToggle(rule.id)}
                    disabled={togglingIds.has(rule.id)}
                    className={`relative w-11 h-6 rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary/50 ${rule.isEnabled ? 'bg-primary' : 'bg-slate-400 dark:bg-slate-500'}`}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${rule.isEnabled ? 'translate-x-5' : 'translate-x-0'}`}
                    />
                  </button>

                  <div className="w-px h-6 bg-slate-200 dark:bg-ui-active-dark" />

                  <button
                    onClick={() => handleEdit(rule)}
                    className="p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-ui-hover-dark rounded-lg transition-all"
                    title="Edit"
                  >
                    <MaterialIcon name="edit" />
                  </button>
                  {!rule.isSystem && (
                    <button
                      onClick={() => setDeleteTargetId(rule.id)}
                      disabled={isDeleting}
                      className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all disabled:opacity-50"
                      title="Delete"
                    >
                      <MaterialIcon name="delete" />
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      {deleteTargetId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div
            role="dialog"
            aria-modal="true"
            className="bg-white dark:bg-bg-surface-dark border border-slate-200 dark:border-ui-border-dark rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
          >
            <div className="px-6 py-4 border-b border-slate-200 dark:border-ui-border-dark flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 bg-red-100 dark:bg-red-900/20 rounded-full">
                <MaterialIcon name="warning" className="text-red-600 dark:text-red-400 text-xl" />
              </div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">{t('alerts.rules.deleteConfirmTitle')}</h2>
            </div>
            <div className="p-6">
              <p className="text-slate-600 dark:text-text-muted-dark mb-2">
                {t('alerts.rules.deleteConfirmMessage', { name: rules.find(r => r.id === deleteTargetId)?.name ?? deleteTargetId })}
              </p>
              <p className="text-sm text-slate-500 dark:text-text-dim-dark">
                {t('alerts.rules.deleteConfirmWarning')}
              </p>
            </div>
            <div className="px-6 pb-6 flex gap-3">
              <button
                type="button"
                onClick={() => setDeleteTargetId(null)}
                disabled={isDeleting}
                className="flex-1 py-2 rounded-lg border border-slate-200 dark:border-ui-border-dark text-slate-600 dark:text-text-muted-dark font-bold hover:bg-slate-50 dark:hover:bg-ui-hover-dark transition-all disabled:opacity-50"
              >
                {t('common:cancel')}
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                disabled={isDeleting}
                className="flex-1 py-2 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 transition-all shadow-md active:scale-95 disabled:opacity-50 disabled:active:scale-100 flex items-center justify-center gap-2"
              >
                {isDeleting ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <MaterialIcon name="delete" className="text-lg" />
                    {t('common:delete')}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
