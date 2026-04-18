import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-hot-toast';
import { getErrorMessage } from '../../../utils/errors';
import { MaterialIcon } from '../../../components/common';
import { api, Service } from '../../../services/api';
import { ApiCaptureSettings } from '../../api-requests/components/ApiCaptureSettings';

type LogLevel = 'error' | 'warn' | 'info';

const LEVELS: { value: LogLevel; label: string; color: string; icon: string }[] = [
  { value: 'error', label: 'Error', color: 'text-red-600 dark:text-red-400 border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/20', icon: 'error' },
  { value: 'warn',  label: 'Warn',  color: 'text-amber-600 dark:text-amber-400 border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20', icon: 'warning' },
  { value: 'info',  label: 'Info',  color: 'text-blue-600 dark:text-blue-400 border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/20', icon: 'info' },
];

interface Props {
  service: Service;
  onSuccess: (updated: Service) => void;
}

export function LogServiceSettings({ service, onSuccess }: Props) {
  const { t } = useTranslation(['logs', 'common']);

  const initialFilter = service.logLevelFilter ?? [];
  const [filterAll, setFilterAll] = useState(initialFilter.length === 0);
  const [selected, setSelected] = useState<Set<LogLevel>>(
    new Set(initialFilter as LogLevel[])
  );
  const [saving, setSaving] = useState(false);

  const toggleLevel = (level: LogLevel) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(level)) {
        next.delete(level);
      } else {
        next.add(level);
      }
      return next;
    });
  };

  const handleSave = async () => {
    const filter: LogLevel[] = filterAll ? [] : [...selected];

    if (!filterAll && filter.length === 0) {
      toast.error(t('logServices.settings.selectAtLeastOne'));
      return;
    }

    setSaving(true);
    try {
      const updated = await api.updateService(service.id, { logLevelFilter: filter });
      onSuccess(updated);
      toast.success(t('logServices.settings.saved'));
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-10">
      {/* Section header */}
      <div>
        <h3 className="text-sm font-bold text-slate-800 dark:text-white">
          {t('logServices.settings.levelFilterTitle')}
        </h3>
        <p className="mt-1 text-xs text-slate-500 dark:text-text-muted-dark leading-relaxed">
          {t('logServices.settings.levelFilterDesc')}
        </p>
      </div>

      {/* Mode toggle */}
      <div className="space-y-2">
        {/* Accept all */}
        <label className="flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all
          border-slate-200 dark:border-ui-border-dark hover:bg-slate-50 dark:hover:bg-ui-hover-dark
          has-checked:border-primary has-checked:bg-primary/5">
          <input
            type="radio"
            name="filterMode"
            checked={filterAll}
            onChange={() => setFilterAll(true)}
            className="accent-primary"
          />
          <div>
            <p className="text-sm font-semibold text-slate-800 dark:text-white">
              {t('logServices.settings.acceptAll')}
            </p>
            <p className="text-xs text-slate-500 dark:text-text-muted-dark">
              {t('logServices.settings.acceptAllDesc')}
            </p>
          </div>
        </label>

        {/* Custom selection */}
        <label className="flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all
          border-slate-200 dark:border-ui-border-dark hover:bg-slate-50 dark:hover:bg-ui-hover-dark
          has-checked:border-primary has-checked:bg-primary/5">
          <input
            type="radio"
            name="filterMode"
            checked={!filterAll}
            onChange={() => setFilterAll(false)}
            className="accent-primary"
          />
          <div>
            <p className="text-sm font-semibold text-slate-800 dark:text-white">
              {t('logServices.settings.custom')}
            </p>
            <p className="text-xs text-slate-500 dark:text-text-muted-dark">
              {t('logServices.settings.customDesc')}
            </p>
          </div>
        </label>
      </div>

      {/* Level chips — visible only in custom mode */}
      {!filterAll && (
        <div className="flex gap-2 flex-wrap pl-1">
          {LEVELS.map(({ value, label, color, icon }) => {
            const active = selected.has(value);
            return (
              <button
                key={value}
                type="button"
                onClick={() => toggleLevel(value)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold transition-all ${
                  active
                    ? color
                    : 'text-slate-400 dark:text-text-muted-dark border-slate-200 dark:border-ui-border-dark bg-transparent hover:bg-slate-50 dark:hover:bg-ui-hover-dark'
                }`}
              >
                <MaterialIcon name={icon} className="text-sm" />
                {label}
                {active && <MaterialIcon name="check" className="text-sm" />}
              </button>
            );
          })}
        </div>
      )}

      {/* Current filter summary */}
      <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 dark:bg-ui-hover-dark rounded-lg text-xs text-slate-500 dark:text-text-muted-dark">
        <MaterialIcon name="filter_alt" className="text-sm" />
        <span>
          {filterAll
            ? t('logServices.settings.summaryAll')
            : selected.size === 0
            ? t('logServices.settings.summaryNone')
            : `${t('logServices.settings.summaryCollecting')}: ${[...selected].join(' · ')}`}
        </span>
      </div>

      {/* Save button */}
      <button
        onClick={handleSave}
        disabled={saving}
        className="flex items-center justify-center gap-2 w-full py-2.5 bg-primary text-white font-bold rounded-lg hover:bg-primary/90 transition-all shadow-sm active:scale-95 disabled:opacity-50 text-sm"
      >
        {saving ? (
          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
        ) : (
          <MaterialIcon name="save" className="text-base" />
        )}
        {t('common.save')}
      </button>

      {/* Divider */}
      <div className="border-t border-slate-200 dark:border-ui-border-dark" />

      {/* API Capture Settings section */}
      <ApiCaptureSettings serviceId={service.id} />
    </div>
  );
}
