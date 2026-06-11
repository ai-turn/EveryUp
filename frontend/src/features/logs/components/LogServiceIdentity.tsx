import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { formatDistanceToNow } from 'date-fns';
import { ko, enUS } from 'date-fns/locale';
import { MaterialIcon } from '../../../components/common';
import { LogLevel, LOG_LEVELS, Service } from '../../../services/api';
import { statusColorClasses } from '../../../design-tokens/colors';

interface Props {
  service: Service;
}

const LEVEL_STYLE: Record<LogLevel, { dot: string }> = {
  error: { dot: 'bg-red-500'    },
  warn:  { dot: 'bg-amber-500'  },
  info:  { dot: 'bg-sky-500'    },
  debug: { dot: 'bg-slate-500'  },
  trace: { dot: 'bg-slate-400'  },
};

function InfoChip({ icon, label, value, accent }: { icon: string; label: string; value: string; accent?: boolean }) {
  return (
    <div className="shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white dark:bg-bg-surface-dark border border-slate-200 dark:border-ui-border-dark">
      <MaterialIcon name={icon} className={`text-sm ${accent ? 'text-primary' : 'text-slate-500 dark:text-text-muted-dark'}`} />
      <span className="text-sm text-slate-500 dark:text-text-muted-dark">{label}</span>
      <span className="text-xs font-semibold text-slate-900 dark:text-white">{value}</span>
    </div>
  );
}

export function LogServiceIdentity({ service }: Props) {
  const { t, i18n } = useTranslation(['logs', 'common']);

  const dateLocale = useMemo(
    () => (i18n.language.startsWith('ko') ? ko : enUS),
    [i18n.language]
  );

  const createdText = service.createdAt
    ? formatDistanceToNow(new Date(service.createdAt), { addSuffix: true, locale: dateLocale })
    : '-';

  const activeFilter = useMemo(() => {
    const filter = (service.logLevelFilter ?? []) as LogLevel[];
    return filter.length === 0 ? new Set(LOG_LEVELS) : new Set(filter);
  }, [service.logLevelFilter]);

  const sc = statusColorClasses[service.status as keyof typeof statusColorClasses] ?? statusColorClasses.offline;

  return (
    <div className="mb-8">
      <div className="min-w-0">
        {/* Name + status */}
        <div className="flex items-center gap-3 mb-1.5">
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white truncate">{service.name}</h1>
          <div className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-full ${sc.bg} border ${sc.border}`}>
            <span className="relative flex h-2 w-2">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${sc.pulse} opacity-75`} />
              <span className={`relative inline-flex rounded-full h-2 w-2 ${sc.pulse}`} />
            </span>
            <span className={`${sc.text} text-xs font-bold uppercase tracking-wider`}>
              {t(`common.${service.status}`)}
            </span>
          </div>
        </div>

        {/* Service ID */}
        <p className="text-sm text-slate-500 dark:text-text-muted-dark mb-4">
          <span className="text-slate-400 dark:text-text-dim-dark mr-1">{t('logServices.identity.id')}:</span>
          <code>{service.id}</code>
        </p>

        {/* All chips in one scrollable row */}
        <div className="flex gap-2 overflow-x-auto">
          {service.apiKeyMasked && (
            <InfoChip
              icon="key"
              label={t('logServices.identity.apiKey')}
              value={service.apiKeyMasked}
            />
          )}

          <InfoChip
            icon="event"
            label={t('logServices.identity.createdAt')}
            value={createdText}
          />

          {(service.apiExcludePaths?.length ?? 0) > 0 && (
            <InfoChip
              icon="block"
              label={t('logServices.identity.excludePaths')}
              value={String(service.apiExcludePaths!.length)}
            />
          )}

          {/* Log level filter — read-only dots with visible label */}
          <div className="shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white dark:bg-bg-surface-dark border border-slate-200 dark:border-ui-border-dark">
            <MaterialIcon name="filter_alt" className="text-sm text-slate-500 dark:text-text-muted-dark" />
            <span className="text-sm text-slate-500 dark:text-text-muted-dark">{t('logServices.identity.levelFilter')}</span>
            <span className="flex items-center gap-1">
              {LOG_LEVELS.map((lvl) => (
                <span
                  key={lvl}
                  className={`w-2 h-2 rounded-full ${LEVEL_STYLE[lvl].dot} ${activeFilter.has(lvl) ? '' : 'opacity-20'}`}
                />
              ))}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
