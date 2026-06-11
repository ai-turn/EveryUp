import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-hot-toast';
import { getErrorMessage } from '../../utils/errors';
import { MaterialIcon } from '../../components/common';
import { api, LogLevel, LOG_LEVELS } from '../../services/api';
import type { Service } from '../../services/api';

const LEVEL_STYLE: Record<LogLevel, { dot: string; label: string; active: string }> = {
  error: { dot: 'bg-red-500',    label: 'Error', active: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-300 dark:border-red-800'         },
  warn:  { dot: 'bg-amber-400',  label: 'Warn',  active: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-700' },
  info:  { dot: 'bg-sky-500',    label: 'Info',  active: 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-300 dark:border-sky-700'           },
  debug: { dot: 'bg-violet-500', label: 'Debug', active: 'bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-300 dark:border-violet-700' },
  trace: { dot: 'bg-slate-400',  label: 'Trace', active: 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-600' },
};

function setsEqual(a: Set<LogLevel>, b: Set<LogLevel>) {
  if (a.size !== b.size) return false;
  for (const v of a) if (!b.has(v)) return false;
  return true;
}

export function LogServiceEditPage() {
  const { serviceId } = useParams<{ serviceId: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation(['logs', 'common']);

  const [service, setService] = useState<Service | null>(null);
  const [loading, setLoading] = useState(true);
  const [nameDraft, setNameDraft] = useState('');
  const [filterDraft, setFilterDraft] = useState<Set<LogLevel>>(new Set());
  const [excludeDraft, setExcludeDraft] = useState<string[]>([]);
  const [pathInput, setPathInput] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const goBack = useCallback(() => navigate(`/logs/${serviceId}`), [navigate, serviceId]);

  useEffect(() => {
    if (!serviceId) return;
    api.getServiceById(serviceId)
      .then((data) => {
        setService(data);
        setNameDraft(data.name);
        const initial = (data.logLevelFilter ?? []) as LogLevel[];
        setFilterDraft(initial.length === 0 ? new Set(LOG_LEVELS) : new Set(initial));
        setExcludeDraft(data.apiExcludePaths ?? []);
      })
      .catch(() => navigate('/logs'))
      .finally(() => setLoading(false));
  }, [serviceId, navigate]);

  const toggleLevel = (level: LogLevel) => {
    setFilterDraft((prev) => {
      if (prev.has(level)) {
        if (prev.size === 1) return prev;
        const next = new Set(prev);
        next.delete(level);
        return next;
      }
      return new Set([...prev, level]);
    });
  };

  const addPath = () => {
    const trimmed = pathInput.trim();
    if (!trimmed) return;
    if (excludeDraft.includes(trimmed)) {
      setPathInput('');
      return;
    }
    setExcludeDraft((prev) => [...prev, trimmed]);
    setPathInput('');
  };

  const removePath = (path: string) => {
    setExcludeDraft((prev) => prev.filter((p) => p !== path));
  };

  const handleSave = async () => {
    if (!service) return;
    const trimmed = nameDraft.trim();
    const initialFilter = (service.logLevelFilter ?? []) as LogLevel[];
    const effectiveInitial = new Set<LogLevel>(initialFilter.length === 0 ? LOG_LEVELS : initialFilter);
    const initialExcludes = service.apiExcludePaths ?? [];
    const nameDirtyNow = trimmed !== service.name;
    const filterDirtyNow = !setsEqual(filterDraft, effectiveInitial);
    const excludeDirtyNow =
      excludeDraft.length !== initialExcludes.length ||
      excludeDraft.some((p, i) => p !== initialExcludes[i]);

    if (!nameDirtyNow && !filterDirtyNow && !excludeDirtyNow) { goBack(); return; }

    const updates: Parameters<typeof api.updateService>[1] = {};
    if (nameDirtyNow) updates.name = trimmed;
    if (filterDirtyNow) updates.logLevelFilter = LOG_LEVELS.filter((l) => filterDraft.has(l));
    if (excludeDirtyNow) updates.apiExcludePaths = excludeDraft;

    setIsSaving(true);
    try {
      await api.updateService(service.id, updates);
      toast.success(t('common.saved', { defaultValue: 'Saved' }));
      goBack();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <MaterialIcon name="sync" className="text-2xl text-slate-400 animate-spin" />
      </div>
    );
  }

  if (!service) return null;

  const nameError = nameDraft.trim().length > 0 && nameDraft.trim().length < 2;
  const nameDirty = nameDraft.trim() !== service.name;
  const initialFilter = (service.logLevelFilter ?? []) as LogLevel[];
  const effectiveInitial = new Set<LogLevel>(initialFilter.length === 0 ? LOG_LEVELS : initialFilter);
  const filterDirty = !setsEqual(filterDraft, effectiveInitial);
  const initialExcludes = service.apiExcludePaths ?? [];
  const excludeDirty =
    excludeDraft.length !== initialExcludes.length ||
    excludeDraft.some((p, i) => p !== initialExcludes[i]);
  const isDirty = nameDirty || filterDirty || excludeDirty;

  return (
    <div className="-m-4 sm:-m-6 md:-m-8 bg-white dark:bg-bg-main-dark min-h-full">
      {/* Sticky header */}
      <header className="sticky top-0 z-20 border-b border-slate-200 dark:border-ui-border-dark px-6 py-3 bg-white/95 dark:bg-bg-main-dark/95 backdrop-blur">
        <nav className="flex items-center gap-1 text-sm text-slate-500 dark:text-text-muted-dark mb-2">
          <button
            type="button"
            onClick={goBack}
            className="hover:text-slate-800 dark:hover:text-white transition-colors"
          >
            {service.name}
          </button>
          <MaterialIcon name="chevron_right" className="text-sm opacity-50" />
          <span className="text-slate-900 dark:text-white font-medium">
            {t('common.edit', { defaultValue: 'Edit' })}
          </span>
        </nav>

        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
              {t('logServices.edit.title')}
            </h1>
            <p className="text-sm text-slate-500 dark:text-text-muted-dark mt-0.5 truncate">
              {t('logServices.edit.subtitle')}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={goBack}
              className="px-4 py-2 text-sm font-bold border border-slate-200 dark:border-ui-border-dark rounded-lg text-slate-600 dark:text-text-muted-dark hover:bg-slate-50 dark:hover:bg-ui-hover-dark transition-colors"
            >
              {t('common.cancel')}
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving || nameError || !isDirty}
              className="px-5 py-2 bg-primary text-white text-sm font-bold rounded-lg hover:bg-primary/90 transition-all shadow-sm active:scale-95 disabled:opacity-40 flex items-center gap-1.5"
            >
              {isSaving ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <MaterialIcon name="save" className="text-sm" />
                  {t('common.save')}
                </>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Body */}
      <div className="px-6 py-8 space-y-6">
        {/* Basic info */}
        <section className="rounded-xl border border-slate-200 dark:border-ui-border-dark bg-white dark:bg-bg-surface-dark p-5 sm:p-6">
          <div className="flex items-center gap-3 pb-4 mb-0 border-b border-slate-100 dark:border-ui-border-dark/60">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <MaterialIcon name="edit_note" className="text-primary text-lg" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                {t('logServices.edit.basicInfo')}
              </h3>
              <p className="text-sm text-slate-500 dark:text-text-muted-dark mt-0.5">
                {t('logServices.edit.basicInfoDesc')}
              </p>
            </div>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-ui-border-dark/60">
            {/* ID row */}
            <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,14rem)_1fr] gap-3 lg:gap-8 py-5">
              <div>
                <p className="text-sm font-semibold text-slate-800 dark:text-white">
                  {t('common.id', { defaultValue: 'ID' })}
                </p>
                <p className="text-xs text-slate-400 dark:text-text-dim-dark mt-1 flex items-center gap-1">
                  <MaterialIcon name="lock" className="text-xs" />
                  {t('logServices.validation.idFormat', { defaultValue: 'Cannot be changed' })}
                </p>
              </div>
              <input
                type="text"
                value={service.id}
                readOnly
                className="w-full px-3 py-2.5 rounded-lg border border-slate-200 dark:border-ui-border-dark bg-slate-50 dark:bg-ui-hover-dark text-sm text-slate-400 dark:text-text-dim-dark cursor-not-allowed font-mono"
              />
            </div>

            {/* Name row */}
            <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,14rem)_1fr] gap-3 lg:gap-8 py-5">
              <div>
                <p className="text-sm font-semibold text-slate-800 dark:text-white">
                  {t('common.name', { defaultValue: 'Name' })}
                </p>
              </div>
              <div>
                <input
                  type="text"
                  value={nameDraft}
                  onChange={(e) => setNameDraft(e.target.value)}
                  maxLength={100}
                  placeholder="My API Server"
                  className={`w-full px-3 py-2.5 rounded-lg border text-sm outline-none transition-colors bg-white dark:bg-ui-hover-dark text-slate-900 dark:text-white ${
                    nameError
                      ? 'border-red-400 dark:border-red-500 focus:border-red-500'
                      : 'border-slate-200 dark:border-ui-border-dark focus:border-primary dark:focus:border-primary'
                  }`}
                />
                {nameError && (
                  <p className="text-xs text-red-500 mt-1.5 flex items-center gap-1">
                    <MaterialIcon name="error" className="text-sm" />
                    {t('logServices.validation.nameRequired')}
                  </p>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Log Level Filter */}
        <section className="rounded-xl border border-slate-200 dark:border-ui-border-dark bg-white dark:bg-bg-surface-dark p-5 sm:p-6">
          <div className="flex items-center gap-3 pb-4 border-b border-slate-100 dark:border-ui-border-dark/60">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <MaterialIcon name="filter_alt" className="text-primary text-lg" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                {t('logServices.settings.levelFilterTitle')}
              </h3>
              <p className="text-sm text-slate-500 dark:text-text-muted-dark mt-0.5">
                {t('logServices.edit.levelFilterDesc')}
              </p>
            </div>
          </div>

          <div className="pt-4 flex flex-wrap gap-2">
            {LOG_LEVELS.map((lvl) => {
              const s = LEVEL_STYLE[lvl];
              const active = filterDraft.has(lvl);
              return (
                <button
                  key={lvl}
                  type="button"
                  onClick={() => toggleLevel(lvl)}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-bold transition-all ${
                    active
                      ? s.active
                      : 'border-slate-200 dark:border-ui-border-dark text-slate-400 dark:text-text-dim-dark hover:bg-slate-50 dark:hover:bg-ui-hover-dark'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full shrink-0 ${s.dot} ${active ? '' : 'opacity-25'}`} />
                  {s.label}
                  {active && <MaterialIcon name="check" className="text-xs ml-0.5" />}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-1.5 mt-4 px-3 py-2 rounded-lg bg-slate-50 dark:bg-ui-hover-dark text-sm text-slate-500 dark:text-text-muted-dark">
            <MaterialIcon name="info" className="text-xs shrink-0" />
            <span>{t('logServices.edit.levelFilterHint')}</span>
          </div>
        </section>

        {/* API request exclude paths */}
        <section className="rounded-xl border border-slate-200 dark:border-ui-border-dark bg-white dark:bg-bg-surface-dark p-5 sm:p-6">
          <div className="flex items-center gap-3 pb-4 border-b border-slate-100 dark:border-ui-border-dark/60">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <MaterialIcon name="block" className="text-primary text-lg" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                {t('logServices.edit.excludePathsTitle', { defaultValue: 'Excluded paths' })}
              </h3>
              <p className="text-sm text-slate-500 dark:text-text-muted-dark mt-0.5">
                {t('logServices.edit.excludePathsDesc', { defaultValue: 'API requests matching these paths are dropped before storage. Use /actuator/* for prefix matches.' })}
              </p>
            </div>
          </div>

          <div className="pt-4 space-y-3">
            <div className="flex gap-2">
              <input
                type="text"
                value={pathInput}
                onChange={(e) => setPathInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addPath();
                  }
                }}
                placeholder="/actuator/* or /health"
                className="flex-1 px-3 py-2 rounded-lg border border-slate-200 dark:border-ui-border-dark bg-white dark:bg-ui-hover-dark text-sm text-slate-900 dark:text-white outline-none focus:border-primary"
              />
              <button
                type="button"
                onClick={addPath}
                disabled={!pathInput.trim()}
                className="px-4 py-2 bg-primary text-white text-sm font-bold rounded-lg hover:bg-primary/90 disabled:opacity-40 active:scale-95 transition-all flex items-center gap-1.5"
              >
                <MaterialIcon name="add" className="text-sm" />
                {t('common.add', { defaultValue: 'Add' })}
              </button>
            </div>

            {excludeDraft.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {excludeDraft.map((path) => (
                  <span
                    key={path}
                    className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 dark:border-ui-border-dark bg-slate-50 dark:bg-ui-hover-dark px-3 py-1 text-xs font-mono text-slate-700 dark:text-text-base-dark"
                  >
                    {path}
                    <button
                      type="button"
                      onClick={() => removePath(path)}
                      className="text-slate-400 hover:text-red-500 transition-colors"
                      aria-label={t('common.remove', { defaultValue: 'Remove' })}
                    >
                      <MaterialIcon name="close" className="text-sm" />
                    </button>
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400 dark:text-text-dim-dark italic">
                {t('logServices.edit.excludePathsEmpty', { defaultValue: 'No exclusions — all paths are captured.' })}
              </p>
            )}
          </div>

          <div className="flex items-center gap-1.5 mt-4 px-3 py-2 rounded-lg bg-slate-50 dark:bg-ui-hover-dark text-sm text-slate-500 dark:text-text-muted-dark">
            <MaterialIcon name="info" className="text-xs shrink-0" />
            <span>{t('logServices.edit.excludePathsHint', { defaultValue: 'Common: /, /health, /actuator/*. Matches url.path on incoming OTLP spans.' })}</span>
          </div>
        </section>
      </div>
    </div>
  );
}
