import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LogServiceForm } from '../../features/logs/components/LogServiceForm';
import { MaterialIcon } from '../../components/common';

export function LogServiceFormPage() {
  const navigate = useNavigate();
  const { t } = useTranslation(['logs', 'common']);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const goBack = () => navigate('/logs');
  const title = t('logServices.add.title', { defaultValue: 'Add Log Service' });
  const subtitle = t('logServices.add.infoDesc', { defaultValue: 'Create a log service, then connect logs from the Integration tab.' });

  return (
    <div className="-m-4 sm:-m-6 md:-m-8 bg-white dark:bg-bg-main-dark">
      <header className="sticky top-0 z-20 border-b border-slate-200 dark:border-ui-border-dark px-6 py-3 bg-white/95 dark:bg-bg-main-dark/95 backdrop-blur">
        <nav className="flex items-center gap-1 text-xs text-slate-500 dark:text-text-muted-dark mb-2">
          <button
            type="button"
            onClick={goBack}
            className="hover:text-slate-800 dark:hover:text-white transition-colors"
          >
            {t('logs.title')}
          </button>
          <MaterialIcon name="chevron_right" className="text-sm opacity-50" />
          <span className="text-slate-900 dark:text-white font-medium truncate max-w-50">
            {title}
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
              form="log-service-form"
              disabled={isSubmitting}
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

      <LogServiceForm onSuccess={goBack} onCancel={goBack} onSubmittingChange={setIsSubmitting} />
    </div>
  );
}
