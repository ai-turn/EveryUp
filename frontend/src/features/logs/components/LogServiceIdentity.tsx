import { useMemo, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { formatDistanceToNow } from 'date-fns';
import { ko, enUS } from 'date-fns/locale';
import { MaterialIcon } from '../../../components/common';
import { LogLevel, LOG_LEVELS, Service, api } from '../../../services/api';
import type { ApiCaptureConfig } from '../../../services/api';
import { env } from '../../../config/env';

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
    <div className="relative group flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-ui-hover-dark border border-slate-200 dark:border-ui-border-dark cursor-default">
      <MaterialIcon name={icon} className={`text-sm ${accent ? 'text-primary' : 'text-slate-400 dark:text-text-dim-dark'}`} />
      <span className="text-xs font-semibold text-slate-700 dark:text-text-base-dark">{value}</span>
      <div className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-slate-800 dark:bg-slate-700 px-2 py-1 text-xs text-white opacity-0 group-hover:opacity-100 transition-opacity duration-150">
        {label}
      </div>
    </div>
  );
}

const DEMO_CAPTURE_CONFIG: ApiCaptureConfig = {
  mode: 'sampled',
  sampleRate: 10,
  bodyMaxBytes: 8192,
  maskedHeaders: ['authorization', 'x-api-key', 'cookie'],
  maskedBodyFields: ['password', 'token', 'secret'],
};

const CAPTURE_MODE_LABEL: Record<string, string> = {
  disabled: '캡처 안함',
  errors_only: '에러만',
  sampled: '샘플링',
  all: '모든 요청',
};

export function LogServiceIdentity({ service }: Props) {
  const { t, i18n } = useTranslation(['logs', 'common']);
  const [captureConfig, setCaptureConfig] = useState<ApiCaptureConfig | null>(null);

  useEffect(() => {
    if (env.useMock || env.isDemoMode) {
      setCaptureConfig(DEMO_CAPTURE_CONFIG);
      return;
    }
    api.getApiCaptureConfig(service.id).then(setCaptureConfig).catch(() => {});
  }, [service.id]);

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

  return (
    <div className="mb-8">
      <div className="min-w-0">
        {/* Name */}
        <div className="flex items-center gap-3 mb-1.5">
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white truncate">{service.name}</h1>
        </div>

        {/* Service ID */}
        <p className="text-sm text-slate-500 dark:text-text-muted-dark mb-4">
          <span className="text-slate-400 dark:text-text-dim-dark mr-1">{t('logServices.identity.id')}:</span>
          <code className="text-xs">{service.id}</code>
        </p>

        {/* Info chips */}
        <div className="flex flex-wrap gap-2 items-center">
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

          {/* Log level filter — read-only dots */}
          <div className="relative group flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-ui-hover-dark border border-slate-200 dark:border-ui-border-dark cursor-default">
            <MaterialIcon name="filter_alt" className="text-sm text-slate-400 dark:text-text-dim-dark" />
            <span className="flex items-center gap-1">
              {LOG_LEVELS.map((lvl) => (
                <span
                  key={lvl}
                  className={`w-2 h-2 rounded-full ${LEVEL_STYLE[lvl].dot} ${activeFilter.has(lvl) ? '' : 'opacity-20'}`}
                />
              ))}
            </span>
            <div className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-slate-800 dark:bg-slate-700 px-2 py-1 text-xs text-white opacity-0 group-hover:opacity-100 transition-opacity duration-150">
              {t('logServices.identity.levelFilter')}
            </div>
          </div>
        </div>

        {/* API Capture config badges */}
        {captureConfig && (
          <div className="flex gap-2 mt-3 overflow-x-auto">
            <div className="shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-primary/5 dark:bg-primary/10 border border-primary/10 dark:border-primary/20">
              <MaterialIcon name="filter_alt" className="text-sm text-primary" />
              <span className="text-xs font-semibold text-primary whitespace-nowrap">
                {CAPTURE_MODE_LABEL[captureConfig.mode] ?? captureConfig.mode}
                {captureConfig.mode === 'sampled' && ` ${captureConfig.sampleRate}%`}
              </span>
            </div>
            <div className="shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-ui-hover-dark border border-slate-200 dark:border-ui-border-dark">
              <MaterialIcon name="shield" className="text-sm text-slate-400 dark:text-text-dim-dark" />
              <span className="text-xs font-semibold text-slate-600 dark:text-text-base-dark whitespace-nowrap">
                {captureConfig.maskedHeaders.length > 0
                  ? captureConfig.maskedHeaders.slice(0, 2).join(', ') + (captureConfig.maskedHeaders.length > 2 ? ` 외 ${captureConfig.maskedHeaders.length - 2}개` : '')
                  : '헤더 마스킹 없음'}
              </span>
            </div>
            {captureConfig.maskedBodyFields.length > 0 && (
              <div className="shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-ui-hover-dark border border-slate-200 dark:border-ui-border-dark">
                <MaterialIcon name="lock" className="text-sm text-slate-400 dark:text-text-dim-dark" />
                <span className="text-xs font-semibold text-slate-600 dark:text-text-base-dark whitespace-nowrap">
                  {captureConfig.maskedBodyFields.slice(0, 2).join(', ')}
                  {captureConfig.maskedBodyFields.length > 2 && ` 외 ${captureConfig.maskedBodyFields.length - 2}개`}
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
