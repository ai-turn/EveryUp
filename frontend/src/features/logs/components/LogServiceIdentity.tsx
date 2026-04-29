import { useMemo, useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { formatDistanceToNow } from 'date-fns';
import { ko, enUS } from 'date-fns/locale';
import { toast } from 'react-hot-toast';
import { MaterialIcon } from '../../../components/common';
import { api, LogLevel, LOG_LEVELS, Service } from '../../../services/api';
import { getErrorMessage } from '../../../utils/errors';

interface Props {
  service: Service;
  /** Called with the updated service after a successful save */
  onServiceUpdate?: (updated: Service) => void;
}

const LEVEL_STYLE: Record<LogLevel, { text: string; activeBg: string; dot: string; label: string }> = {
  error: { text: 'text-red-500 dark:text-red-400',     activeBg: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800',         dot: 'bg-red-500',    label: 'Error' },
  warn:  { text: 'text-amber-500 dark:text-amber-400', activeBg: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800', dot: 'bg-amber-500',  label: 'Warn'  },
  info:  { text: 'text-sky-500 dark:text-sky-400',     activeBg: 'bg-sky-50 dark:bg-sky-900/20 border-sky-200 dark:border-sky-800',         dot: 'bg-sky-500',    label: 'Info'  },
  debug: { text: 'text-slate-500 dark:text-slate-300', activeBg: 'bg-slate-50 dark:bg-slate-800/30 border-slate-200 dark:border-slate-700', dot: 'bg-slate-500',  label: 'Debug' },
  trace: { text: 'text-slate-400 dark:text-slate-400', activeBg: 'bg-slate-50 dark:bg-slate-800/20 border-slate-200 dark:border-slate-700', dot: 'bg-slate-400',  label: 'Trace' },
};

const ALL_LEVELS: readonly LogLevel[] = LOG_LEVELS;

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

function LevelFilterChip({ service, onServiceUpdate }: { service: Service; onServiceUpdate?: (s: Service) => void }) {
  const { t } = useTranslation(['logs', 'common']);
  const [isOpen, setIsOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const initialFilter = (service.logLevelFilter ?? []) as LogLevel[];
  // Empty filter (legacy NULL or pre-migration data) → display as all 5 selected.
  // Post-migration servers store an explicit array, so this is mostly defensive.
  const effectiveSelected = initialFilter.length === 0 ? new Set<LogLevel>(ALL_LEVELS) : new Set(initialFilter);
  const acceptAll = effectiveSelected.size === ALL_LEVELS.length;

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [isOpen]);

  const save = async (next: Set<LogLevel>) => {
    // Always send the explicit list. Backend persists exactly what the user picked
    // so the UI never has to reverse-engineer "all = empty".
    const filter: LogLevel[] = ALL_LEVELS.filter((l) => next.has(l));
    setSaving(true);
    try {
      const updated = await api.updateService(service.id, { logLevelFilter: filter });
      onServiceUpdate?.(updated);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const toggle = (level: LogLevel) => {
    const next = new Set(effectiveSelected);
    if (next.has(level)) {
      if (next.size === 1) {
        toast.error(t('logServices.settings.selectAtLeastOne'));
        return;
      }
      next.delete(level);
    } else {
      next.add(level);
    }
    void save(next);
  };

  return (
    <div className="relative" ref={wrapperRef}>
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        title={t('logServices.identity.levelFilterHint')}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border bg-slate-100 dark:bg-ui-hover-dark transition-all group ${
          isOpen
            ? 'border-primary/60 bg-primary/5'
            : 'border-slate-200 dark:border-ui-border-dark hover:border-primary/40 hover:bg-primary/5'
        }`}
      >
        <MaterialIcon name="filter_alt" className="text-sm text-slate-400 dark:text-text-dim-dark group-hover:text-primary transition-colors" />
        <span className="text-xs text-slate-400 dark:text-text-dim-dark font-medium">{t('logServices.identity.levelFilter')}</span>

        {acceptAll ? (
          <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
            {t('logServices.identity.acceptAll')}
          </span>
        ) : (
          <span className="flex items-center gap-1">
            {[...effectiveSelected].map((lvl) => {
              const s = LEVEL_STYLE[lvl];
              return (
                <span
                  key={lvl}
                  className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-bold uppercase ${s.text}`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
                  {lvl}
                </span>
              );
            })}
          </span>
        )}

        <MaterialIcon
          name={isOpen ? 'expand_less' : 'expand_more'}
          className="text-sm text-slate-300 dark:text-text-dim-dark group-hover:text-primary transition-colors ml-0.5"
        />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-2 z-30 w-72 rounded-xl border border-slate-200 dark:border-ui-border-dark bg-white dark:bg-bg-surface-dark shadow-xl p-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-slate-700 dark:text-text-secondary-dark">
              {t('logServices.settings.levelFilterTitle')}
            </p>
            {saving && (
              <MaterialIcon name="sync" className="text-sm text-slate-400 animate-spin" />
            )}
          </div>
          <p className="text-[11px] text-slate-500 dark:text-text-muted-dark leading-relaxed mb-3">
            {t('logServices.identity.levelFilterPopoverHint', {
              defaultValue: 'Select which levels the server will store. Defaults to error / warn / info — debug & trace are opt-in.',
            })}
          </p>
          <div className="flex flex-col gap-1.5">
            {ALL_LEVELS.map((lvl) => {
              const s = LEVEL_STYLE[lvl];
              const active = effectiveSelected.has(lvl);
              return (
                <button
                  key={lvl}
                  type="button"
                  onClick={() => toggle(lvl)}
                  disabled={saving}
                  className={`flex items-center justify-between gap-2 px-3 py-2 rounded-lg border text-xs font-semibold transition-all disabled:opacity-60 ${
                    active
                      ? `${s.text} ${s.activeBg}`
                      : 'text-slate-400 dark:text-text-muted-dark border-transparent hover:bg-slate-50 dark:hover:bg-ui-hover-dark'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${s.dot} ${active ? '' : 'opacity-25'}`} />
                    {s.label}
                  </span>
                  {active && <MaterialIcon name="check" className="text-sm" />}
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-1.5 mt-3 px-2 py-1.5 rounded-md bg-slate-50 dark:bg-ui-hover-dark text-[11px] text-slate-500 dark:text-text-muted-dark">
            <MaterialIcon name="info" className="text-xs" />
            <span>
              {acceptAll
                ? t('logServices.settings.summaryAll')
                : `${t('logServices.settings.summaryCollecting')}: ${[...effectiveSelected].join(' · ')}`}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

export function LogServiceIdentity({ service, onServiceUpdate }: Props) {
  const { t, i18n } = useTranslation(['logs', 'common']);

  const dateLocale = useMemo(
    () => (i18n.language.startsWith('ko') ? ko : enUS),
    [i18n.language]
  );

  const createdText = service.createdAt
    ? formatDistanceToNow(new Date(service.createdAt), { addSuffix: true, locale: dateLocale })
    : '-';

  return (
    <div className="mb-8">
      <div className="min-w-0">
        {/* Name + type badge */}
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
            icon="event"
            label={t('logServices.identity.createdAt')}
            value={createdText}
          />

          {/* Log level filter — inline popover */}
          <LevelFilterChip service={service} onServiceUpdate={onServiceUpdate} />
        </div>
      </div>
    </div>
  );
}
