import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-hot-toast';
import { getErrorMessage } from '../utils/errors';
import { MaterialIcon } from '../components/common';
import { ApiCaptureSettings } from '../features/api-requests/components/ApiCaptureSettings';
import { api } from '../services/api';
import type { Service } from '../services/api';

export function LogServiceEditPage() {
  const { serviceId } = useParams<{ serviceId: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation(['logs', 'common']);

  const [service, setService] = useState<Service | null>(null);
  const [loading, setLoading] = useState(true);
  const [nameDraft, setNameDraft] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const goBack = useCallback(() => navigate(`/logs/${serviceId}`), [navigate, serviceId]);

  useEffect(() => {
    if (!serviceId) return;
    api.getServiceById(serviceId)
      .then((data) => {
        setService(data);
        setNameDraft(data.name);
      })
      .catch(() => navigate('/logs'))
      .finally(() => setLoading(false));
  }, [serviceId, navigate]);

  const handleSave = async () => {
    if (!service) return;
    const trimmed = nameDraft.trim();
    if (!trimmed || trimmed === service.name) {
      goBack();
      return;
    }
    setIsSaving(true);
    try {
      await api.updateService(service.id, { name: trimmed });
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

  return (
    <div className="-m-4 sm:-m-6 md:-m-8 bg-white dark:bg-bg-main-dark min-h-full">
      {/* Sticky header */}
      <header className="sticky top-0 z-20 border-b border-slate-200 dark:border-ui-border-dark px-6 py-3 bg-white/95 dark:bg-bg-main-dark/95 backdrop-blur">
        <nav className="flex items-center gap-1 text-xs text-slate-500 dark:text-text-muted-dark mb-2">
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
            <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
              {t('logServices.edit.title')}
            </h1>
            <p className="text-xs text-slate-500 dark:text-text-muted-dark mt-0.5 truncate">
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
              disabled={isSaving || nameError || !nameDirty}
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
        {/* Basic info — matches ApiCaptureSettings SectionCard style */}
        <section className="rounded-xl border border-slate-200 dark:border-ui-border-dark bg-white dark:bg-bg-surface-dark p-5 sm:p-6">
          <div className="flex items-center gap-3 pb-4 mb-0 border-b border-slate-100 dark:border-ui-border-dark/60">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <MaterialIcon name="edit_note" className="text-primary text-lg" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {t('logServices.edit.basicInfo')}
              </h3>
              <p className="text-xs text-slate-500 dark:text-text-muted-dark mt-0.5">
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

        {/* API Capture Settings */}
        <ApiCaptureSettings serviceId={service.id} />
      </div>
    </div>
  );
}
