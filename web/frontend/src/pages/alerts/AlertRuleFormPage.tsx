import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-hot-toast';
import { api, type AlertRule, type NotificationChannel } from '../../services/api';
import { AlertRuleForm } from '../../features/alerts/components/AlertRuleForm';
import { MaterialIcon } from '../../components/common';
import { getErrorMessage } from '../../utils/errors';

export function AlertRuleFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation(['alerts', 'common']);
  const isEdit = !!id;
  const [rule, setRule] = useState<AlertRule | undefined>();
  const [channels, setChannels] = useState<NotificationChannel[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const channelsData = await api.getNotificationChannels();
        if (cancelled) return;
        setChannels(channelsData);
        if (id) {
          const r = await api.getAlertRuleById(id);
          if (cancelled) return;
          setRule(r);
        }
      } catch (error) {
        toast.error(getErrorMessage(error));
        navigate('/alerts?tab=rules');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id, navigate]);

  const goBack = () => navigate('/alerts?tab=rules');

  const title = isEdit
    ? t('alerts.rules.editTitle', { defaultValue: '규칙 편집' })
    : t('alerts.rules.newTitle', { defaultValue: '새 알림 규칙' });
  const subtitle = isEdit
    ? t('alerts.rules.editSubtitle', { defaultValue: '규칙 조건, 심각도, 알림 채널을 수정합니다.' })
    : t('alerts.rules.newSubtitle', { defaultValue: '대상과 조건을 정의하고 알림 채널을 연결합니다.' });

  return (
    <div className="-m-4 min-h-[calc(100dvh-3.5rem)] bg-white dark:bg-bg-main-dark sm:-m-6 md:-m-8 lg:min-h-[calc(100dvh-4rem)]">
      {/* Page header */}
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 px-6 py-3 backdrop-blur dark:border-ui-border-dark dark:bg-bg-main-dark/95">
        <nav className="flex items-center gap-1 text-sm text-slate-500 dark:text-text-muted-dark mb-2">
          <button
            type="button"
            onClick={goBack}
            className="hover:text-slate-800 dark:hover:text-white transition-colors"
          >
            {t('alerts.title')}
          </button>
          <MaterialIcon name="chevron_right" className="text-sm opacity-50" />
          <button
            type="button"
            onClick={goBack}
            className="hover:text-slate-800 dark:hover:text-white transition-colors"
          >
            {t('alerts.rulesTitle')}
          </button>
          <MaterialIcon name="chevron_right" className="text-sm opacity-50" />
          <span className="text-slate-900 dark:text-white font-medium truncate max-w-50">
            {loading ? '...' : isEdit ? (rule?.name ?? title) : title}
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
              form="alert-rule-form"
              disabled={loading || isSubmitting}
              className="px-5 py-2 bg-primary text-white text-sm font-bold rounded-lg hover:bg-primary/90 transition-all shadow-sm active:scale-95 disabled:opacity-50 flex items-center gap-1.5"
            >
              {isSubmitting ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <MaterialIcon name="check" className="text-sm" />
                  {isEdit ? t('common.save') : t('alerts.rules.create')}
                </>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Form body */}
      <div>
        {loading ? (
          <div className="flex min-h-80 items-center justify-center text-slate-500">
            <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          </div>
        ) : (
          <AlertRuleForm
            rule={rule}
            channels={channels}
            onSuccess={goBack}
            onCancel={goBack}
            onSubmittingChange={setIsSubmitting}
          />
        )}
      </div>
    </div>
  );
}
