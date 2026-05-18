import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-hot-toast';
import { api, type Host } from '../services/api';
import { InfraForm } from '../features/infra/components/InfraForm';
import { MaterialIcon } from '../components/common';
import { getErrorMessage } from '../utils/errors';

export function InfraFormPage() {
  const { resourceId } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation(['infra', 'common']);
  const isEdit = !!resourceId;
  const [host, setHost] = useState<Host | undefined>();
  const [loading, setLoading] = useState(isEdit);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!resourceId) return;
    let cancelled = false;
    (async () => {
      try {
        const h = await api.getHostById(resourceId);
        if (cancelled) return;
        setHost(h);
      } catch (error) {
        toast.error(getErrorMessage(error));
        navigate('/infra');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [resourceId, navigate]);

  const goBack = () => navigate(isEdit && resourceId ? `/infra/${resourceId}` : '/infra');

  const title = isEdit ? t('infra.editHost') : t('infra.addResource');
  const subtitle = isEdit
    ? t('infra.form.editSubtitle', { defaultValue: 'Update host metadata, connection details, and SSH credentials.' })
    : t('infra.form.createSubtitle', { defaultValue: 'Register a host for resource monitoring and process tracking.' });

  return (
    <div className="-m-4 sm:-m-6 md:-m-8 bg-white dark:bg-bg-main-dark">
      <header className="sticky top-0 z-20 border-b border-slate-200 dark:border-ui-border-dark px-6 py-3 bg-white/95 dark:bg-bg-main-dark/95 backdrop-blur">
        <nav className="flex items-center gap-1 text-xs text-slate-500 dark:text-text-muted-dark mb-2">
          <button
            type="button"
            onClick={() => navigate('/infra')}
            className="hover:text-slate-800 dark:hover:text-white transition-colors"
          >
            {t('infra.title')}
          </button>
          <MaterialIcon name="chevron_right" className="text-sm opacity-50" />
          <span className="text-slate-900 dark:text-white font-medium truncate max-w-50">
            {loading ? '...' : isEdit ? (host?.name ?? t('infra.editHost')) : t('infra.addResource')}
          </span>
        </nav>

        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">{title}</h1>
            <p className="text-sm text-slate-500 dark:text-text-muted-dark mt-0.5 truncate">
              {subtitle}
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
              type="submit"
              form="infra-form"
              disabled={loading || isSubmitting}
              className="px-5 py-2 bg-primary text-white text-sm font-bold rounded-lg hover:bg-primary/90 transition-all shadow-sm active:scale-95 disabled:opacity-50 flex items-center gap-1.5"
            >
              {isSubmitting ? (
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

      <div>
        {loading ? (
          <div className="flex items-center justify-center min-h-80 text-slate-500">
            <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          </div>
        ) : (
          <InfraForm
            host={host}
            onSuccess={goBack}
            onCancel={goBack}
            onSubmittingChange={setIsSubmitting}
          />
        )}
      </div>
    </div>
  );
}
