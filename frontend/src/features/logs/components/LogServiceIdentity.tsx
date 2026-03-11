import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { formatDistanceToNow } from 'date-fns';
import { ko, enUS } from 'date-fns/locale';
import { MaterialIcon } from '../../../components/common';
import { IconLogs } from '../../../components/icons/SidebarIcons';
import { Service } from '../../../services/api';

interface Props {
  service: Service;
  /** Call when the user clicks the level-filter area to jump to settings tab */
  onSettingsClick?: () => void;
}

const LEVEL_STYLE: Record<string, { text: string; bg: string; icon: string }> = {
  error: { text: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800', icon: 'error' },
  warn:  { text: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800', icon: 'warning' },
  info:  { text: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800', icon: 'info' },
};

function InfoChip({ icon, label, value, accent }: { icon: string; label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-ui-hover-dark border border-slate-200 dark:border-ui-border-dark">
      <MaterialIcon name={icon} className={`text-sm ${accent ? 'text-primary' : 'text-slate-400 dark:text-text-dim-dark'}`} />
      <span className="text-xs text-slate-400 dark:text-text-dim-dark font-medium">{label}</span>
      <span className="text-xs font-bold text-slate-700 dark:text-text-base-dark">{value}</span>
    </div>
  );
}

export function LogServiceIdentity({ service, onSettingsClick }: Props) {
  const { t, i18n } = useTranslation();

  const dateLocale = useMemo(
    () => (i18n.language.startsWith('ko') ? ko : enUS),
    [i18n.language]
  );

  const filter = service.logLevelFilter ?? [];
  const acceptAll = filter.length === 0;

  const createdText = service.createdAt
    ? formatDistanceToNow(new Date(service.createdAt), { addSuffix: true, locale: dateLocale })
    : '-';

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6 mb-8 bg-slate-100/50 dark:bg-bg-surface-dark/30 p-6 rounded-xl border border-slate-200 dark:border-chart-surface">
      {/* Icon */}
      <div className="bg-primary/20 rounded-xl p-4 sm:p-6 flex items-center justify-center border border-primary/30 shrink-0">
        <IconLogs size={48} className="text-primary" />
      </div>

      <div className="flex-1 min-w-0">
        {/* Name + type badge */}
        <div className="flex items-center gap-3 mb-1.5">
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white truncate">{service.name}</h1>
          <span className="shrink-0 px-2 py-0.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-bold uppercase tracking-wider">
            LOG
          </span>
        </div>

        {/* Service ID */}
        <p className="text-sm text-slate-500 dark:text-text-muted-dark mb-4">
          <span className="text-slate-400 dark:text-text-dim-dark mr-1">{t('logServices.identity.id')}:</span>
          <code className="bg-slate-200 dark:bg-chart-surface px-2 py-0.5 rounded text-primary text-xs">{service.id}</code>
        </p>

        {/* Info chips */}
        <div className="flex flex-wrap gap-2 items-center">
          {/* API Key */}
          {service.apiKeyMasked && (
            <InfoChip
              icon="key"
              label={t('logServices.identity.apiKey')}
              value={service.apiKeyMasked}
            />
          )}

          {/* Created at */}
          <InfoChip
            icon="schedule"
            label={t('logServices.identity.createdAt')}
            value={createdText}
          />

          {/* Log level filter — highlighted section */}
          <button
            type="button"
            onClick={onSettingsClick}
            title={t('logServices.identity.levelFilterHint')}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-ui-border-dark bg-slate-100 dark:bg-ui-hover-dark hover:border-primary/40 hover:bg-primary/5 transition-all group"
          >
            <MaterialIcon name="filter_alt" className="text-sm text-slate-400 dark:text-text-dim-dark group-hover:text-primary transition-colors" />
            <span className="text-xs text-slate-400 dark:text-text-dim-dark font-medium">{t('logServices.identity.levelFilter')}</span>

            {acceptAll ? (
              <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                {t('logServices.identity.acceptAll')}
              </span>
            ) : (
              <span className="flex items-center gap-1">
                {filter.map((lvl) => {
                  const s = LEVEL_STYLE[lvl] ?? LEVEL_STYLE.info;
                  return (
                    <span
                      key={lvl}
                      className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded border text-xs font-bold uppercase ${s.text} ${s.bg}`}
                    >
                      <MaterialIcon name={s.icon} className="text-xs" />
                      {lvl}
                    </span>
                  );
                })}
              </span>
            )}

            <MaterialIcon name="chevron_right" className="text-sm text-slate-300 dark:text-text-dim-dark group-hover:text-primary transition-colors ml-0.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
