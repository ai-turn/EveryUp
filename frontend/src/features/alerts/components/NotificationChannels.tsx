import { useTranslation } from 'react-i18next';
import { IntegrationCard } from './IntegrationCard';
import { MaterialIcon } from '../../../components/common';

export function NotificationChannels() {
  const { t } = useTranslation();

  return (
    <>
      {/* Section Header */}
      <div className="flex items-center justify-between mb-4 mt-8">
        <h2 className="text-slate-900 dark:text-white text-xl font-bold leading-tight tracking-[-0.015em]">
          {t('alerts.channelsTitle')}
        </h2>
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
          {t('alerts.configured', { count: 3 })}
        </span>
      </div>

      {/* Integration Cards */}
      <div className="grid grid-cols-1 gap-6 mb-12">
        {/* Slack Card */}
        <IntegrationCard
          name={t('alerts.slack.title')}
          description={t('alerts.slack.description')}
          icon="chat"
          iconBg="bg-indigo-50 dark:bg-indigo-500/10"
          iconColor="text-indigo-600 dark:text-indigo-400"
          status="Connected"
          statusColor="bg-emerald-500/10 text-emerald-500"
          enabled={true}
          backgroundIcon="forum"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-slate-400 uppercase">{t('alerts.slack.targetChannel')}</label>
              <select className="form-select w-full rounded-lg border-slate-200 dark:border-ui-border-dark bg-slate-50 dark:bg-ui-hover-dark text-slate-900 dark:text-white focus:ring-primary focus:border-primary text-sm">
                <option>#alerts-critical</option>
                <option>#dev-ops</option>
                <option>#general</option>
              </select>
            </div>
            <div className="flex items-end">
              <button className="flex items-center justify-center rounded-lg h-10 px-4 bg-slate-100 dark:bg-ui-hover-dark text-slate-700 dark:text-text-secondary-dark text-sm font-medium border border-slate-200 dark:border-ui-border-dark hover:bg-slate-200 dark:hover:bg-ui-active-dark transition-colors w-full md:w-fit">
                <MaterialIcon name="sync" className="text-lg mr-2" />
                <span>{t('alerts.slack.reconnect')}</span>
              </button>
            </div>
          </div>
        </IntegrationCard>

        {/* Email Card */}
        <IntegrationCard
          name={t('alerts.email.title')}
          description={t('alerts.email.description')}
          icon="mail"
          iconBg="bg-blue-50 dark:bg-blue-500/10"
          iconColor="text-blue-600 dark:text-blue-400"
          status="Enabled"
          statusColor="bg-blue-500/10 text-blue-500"
          enabled={true}
          backgroundIcon="alternate_email"
        >
          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold text-slate-400 uppercase">{t('alerts.email.recipients')}</label>
            <div className="flex flex-wrap gap-2 p-2 rounded-lg border border-slate-200 dark:border-ui-border-dark bg-slate-50 dark:bg-ui-hover-dark">
              <div className="flex items-center gap-1.5 px-2 py-1 bg-primary text-white text-xs font-medium rounded-md">
                <span>dev-ops@company.com</span>
                <MaterialIcon name="close" className="text-sm cursor-pointer" />
              </div>
              <div className="flex items-center gap-1.5 px-2 py-1 bg-primary text-white text-xs font-medium rounded-md">
                <span>alerts@company.com</span>
                <MaterialIcon name="close" className="text-sm cursor-pointer" />
              </div>
              <input
                type="text"
                placeholder={t('alerts.email.addEmail')}
                className="flex-1 bg-transparent border-none focus:ring-0 text-sm p-0 min-w-[120px] dark:text-white"
              />
            </div>
          </div>
        </IntegrationCard>

        {/* PagerDuty Card */}
        <IntegrationCard
          name={t('alerts.pagerduty.title')}
          description={t('alerts.pagerduty.description')}
          icon="notifications_active"
          iconBg="bg-green-50 dark:bg-green-500/10"
          iconColor="text-green-600 dark:text-green-400"
          status="Not Connected"
          statusColor="bg-slate-500/10 text-slate-500 dark:text-text-muted-dark"
          enabled={false}
          backgroundIcon="alarm"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-slate-400 uppercase">{t('alerts.pagerduty.key')}</label>
              <input
                type="password"
                placeholder="••••••••••••••••"
                className="form-input w-full rounded-lg border-slate-200 dark:border-ui-border-dark bg-slate-50 dark:bg-ui-hover-dark text-slate-900 dark:text-white focus:ring-primary focus:border-primary text-sm font-mono"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-slate-400 uppercase">{t('alerts.pagerduty.serviceId')}</label>
              <input
                type="text"
                placeholder="PXXXXXX"
                className="form-input w-full rounded-lg border-slate-200 dark:border-ui-border-dark bg-slate-50 dark:bg-ui-hover-dark text-slate-900 dark:text-white focus:ring-primary focus:border-primary text-sm font-mono"
              />
            </div>
          </div>
        </IntegrationCard>
      </div>
    </>
  );
}
