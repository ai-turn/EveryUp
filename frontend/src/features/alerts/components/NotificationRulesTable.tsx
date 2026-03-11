import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { MaterialIcon } from '../../../components/common';
import { useNotificationRules } from '../../../hooks/useData';
import { TableSkeleton } from '../../../components/skeleton';

const ruleLabelMap: Record<string, string> = {
  'Critical Alert': 'alerts.events.critical.label',
  'Warning': 'alerts.events.warning.label',
  'Recovery': 'alerts.events.recovery.label',
  'Daily Digest': 'alerts.events.digest.label',
};

const ruleDescMap: Record<string, string> = {
  'Service downtime or major failure': 'alerts.events.critical.desc',
  'Threshold exceeded or latency high': 'alerts.events.warning.desc',
  'Service back to normal state': 'alerts.events.recovery.desc',
  'Summary of service performance': 'alerts.events.digest.desc',
};

export function NotificationRulesTable() {
  const { t } = useTranslation();
  const { data: notificationRules, loading } = useNotificationRules();
  const [rules, setRules] = useState(notificationRules || []);

  useEffect(() => {
    if (notificationRules) {
      setRules(notificationRules);
    }
  }, [notificationRules]);

  const toggleChannel = (ruleId: string, channel: 'slack' | 'email' | 'pagerduty') => {
    setRules((prev) =>
      prev.map((rule) =>
        rule.id === ruleId ? { ...rule, [channel]: !rule[channel] } : rule
      )
    );
  };

  if (loading) {
    return (
      <div className="mt-12">
        <TableSkeleton rows={4} columns={4} />
      </div>
    );
  }

  return (
    <div className="mt-12">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-slate-900 dark:text-white text-xl font-bold leading-tight tracking-[-0.015em]">
          {t('alerts.rulesTitle')}
        </h2>
        <p className="text-slate-500 text-sm">{t('alerts.rulesDesc')}</p>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-ui-border-dark bg-white dark:bg-bg-surface-dark/30">
        <table className="w-full min-w-100 text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 dark:bg-ui-hover-dark/50 border-b border-slate-200 dark:border-ui-border-dark">
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
                {t('alerts.table.eventType')}
              </th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">
                {t('alerts.table.slack')}
              </th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">
                {t('alerts.table.email')}
              </th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">
                {t('alerts.table.pagerduty')}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-ui-border-dark">
            {rules.map((rule) => (
              <tr key={rule.id}>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <MaterialIcon name={rule.icon} className={`${rule.iconColor} text-xl`} />
                    <div>
                      <p className="text-sm font-bold dark:text-white">
                        {ruleLabelMap[rule.eventType] ? t(ruleLabelMap[rule.eventType]) : rule.eventType}
                      </p>
                      <p className="text-xs text-slate-500">
                        {ruleDescMap[rule.description] ? t(ruleDescMap[rule.description]) : rule.description}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 text-center">
                  <input
                    type="checkbox"
                    checked={rule.slack}
                    onChange={() => toggleChannel(rule.id, 'slack')}
                    className="w-4 h-4 rounded text-primary focus:ring-primary dark:bg-ui-hover-dark dark:border-ui-border-dark"
                  />
                </td>
                <td className="px-6 py-4 text-center">
                  <input
                    type="checkbox"
                    checked={rule.email}
                    onChange={() => toggleChannel(rule.id, 'email')}
                    className="w-4 h-4 rounded text-primary focus:ring-primary dark:bg-ui-hover-dark dark:border-ui-border-dark"
                  />
                </td>
                <td className="px-6 py-4 text-center">
                  <input
                    type="checkbox"
                    checked={rule.pagerduty}
                    onChange={() => toggleChannel(rule.id, 'pagerduty')}
                    className="w-4 h-4 rounded text-primary focus:ring-primary dark:bg-ui-hover-dark dark:border-ui-border-dark"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
