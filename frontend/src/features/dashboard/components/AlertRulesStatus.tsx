import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useState, useEffect } from 'react';
import { MaterialIcon } from '../../../components/common';
import { IconAlerts } from '../../../components/icons/SidebarIcons';
import { api, type AlertRule } from '../../../services/api';

const SEVERITY_COLOR: Record<string, { text: string; bg: string; dot: string }> = {
  critical: { text: 'text-red-600 dark:text-red-400', bg: 'bg-red-500/10', dot: 'bg-red-500' },
  warning: { text: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-500/10', dot: 'bg-amber-500' },
  info: { text: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-500/10', dot: 'bg-blue-500' },
};

const METRIC_ICON: Record<string, string> = {
  cpu: 'memory',
  memory: 'storage',
  disk: 'hard_drive',
  http_status: 'http',
  response_time: 'speed',
  status_change: 'compare_arrows',
  api_status_code: 'code',
};

export function AlertRulesStatus() {
  const { t } = useTranslation(['dashboard', 'common']);
  const navigate = useNavigate();
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getAlertRules()
      .then(setRules)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const enabledCount = rules.filter(r => r.isEnabled).length;
  const totalCount = rules.length;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">
            {t('dashboard.alertRules.title')}
          </h2>
          {!loading && (
            <span className="text-sm font-semibold text-slate-500 dark:text-text-muted-dark bg-slate-100 dark:bg-ui-hover-dark px-2 py-0.5 rounded-full">
              {enabledCount}/{totalCount}
            </span>
          )}
        </div>
        <button
          onClick={() => navigate('/alerts?tab=rules')}
          className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:text-primary/80 transition-colors cursor-pointer"
        >
          {t('dashboard.alertRules.manage')}
          <MaterialIcon name="arrow_forward" className="text-sm" />
        </button>
      </div>

      <div className="bg-white dark:bg-bg-surface-dark border border-slate-300 dark:border-ui-border-dark rounded-xl p-5">
        {/* Loading skeleton */}
        {loading && (
          <div className="space-y-2">
            {[1, 2].map((i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 dark:bg-ui-hover-dark animate-pulse">
                <div className="w-8 h-8 rounded-lg bg-slate-200 dark:bg-ui-active-dark" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 w-32 bg-slate-200 dark:bg-ui-active-dark rounded" />
                  <div className="h-2.5 w-20 bg-slate-200 dark:bg-ui-active-dark rounded" />
                </div>
                <div className="h-5 w-16 bg-slate-200 dark:bg-ui-active-dark rounded-full" />
              </div>
            ))}
          </div>
        )}

        {!loading && (
          <div className="space-y-2">
            {rules.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-6 text-center">
                <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-ui-hover-dark flex items-center justify-center mb-3">
                  <IconAlerts size={24} className="text-slate-400" />
                </div>
                <p className="text-sm font-medium text-slate-500 dark:text-text-muted-dark">
                  {t('dashboard.alertRules.empty')}
                </p>
                <button
                  onClick={() => navigate('/alerts?tab=rules')}
                  className="mt-3 text-sm font-semibold text-primary hover:text-primary/80 transition-colors cursor-pointer"
                >
                  {t('dashboard.alertRules.add')} →
                </button>
              </div>
            ) : (
              rules.slice(0, 5).map((rule) => {
                const sev = SEVERITY_COLOR[rule.severity] ?? SEVERITY_COLOR.info;
                const metricIcon = METRIC_ICON[rule.metric] ?? 'notifications';
                return (
                  <div
                    key={rule.id}
                    className={`flex items-center gap-3 p-3 rounded-lg bg-slate-50 dark:bg-ui-hover-dark/60 transition-colors ${!rule.isEnabled ? 'opacity-50' : ''}`}
                  >
                    <div className={`w-8 h-8 rounded-lg ${sev.bg} flex items-center justify-center shrink-0`}>
                      <MaterialIcon name={metricIcon} className={`text-base ${sev.text}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-800 dark:text-text-base-dark truncate">
                        {rule.name}
                      </p>
                      <p className="text-sm text-slate-400 dark:text-text-dim-dark capitalize">
                        {rule.severity} · {rule.metric}
                      </p>
                    </div>
                    {rule.isEnabled ? (
                      <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-lime-500/10 text-lime-600 dark:text-lime-400 text-xs font-bold shrink-0">
                        <span className="w-1.5 h-1.5 rounded-full bg-lime-500 animate-pulse" />
                        {t('dashboard.alertRules.active')}
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-200 dark:bg-ui-active-dark text-slate-500 dark:text-text-muted-dark text-xs font-bold shrink-0">
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                        {t('dashboard.alertRules.inactive')}
                      </span>
                    )}
                  </div>
                );
              })
            )}
            {rules.length > 5 && (
              <button
                onClick={() => navigate('/alerts?tab=rules')}
                className="w-full py-2 text-sm font-semibold text-slate-400 dark:text-text-dim-dark hover:text-primary dark:hover:text-primary transition-colors text-center"
              >
                {t('common.showMore', { count: rules.length - 5 })}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
