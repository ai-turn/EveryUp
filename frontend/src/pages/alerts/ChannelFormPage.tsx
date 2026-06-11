import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-hot-toast';
import { api, type NotificationChannel } from '../../services/api';
import { ChannelForm } from '../../features/alerts/components/ChannelForm';
import { MaterialIcon } from '../../components/common';
import { getErrorMessage } from '../../utils/errors';

export function ChannelFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation(['alerts', 'common']);
  const isEdit = !!id;
  const [channel, setChannel] = useState<NotificationChannel | undefined>();
  const [loading, setLoading] = useState(isEdit);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      try {
        const list = await api.getNotificationChannels();
        if (cancelled) return;
        const found = list.find(c => c.id === id);
        if (!found) {
          toast.error(t('common.notFound', { defaultValue: 'Not found' }));
          navigate('/alerts');
          return;
        }
        setChannel(found);
      } catch (error) {
        toast.error(getErrorMessage(error));
        navigate('/alerts');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id, navigate, t]);

  const goBack = () => navigate('/alerts');

  const title = isEdit
    ? t('alerts.modal.editTitle', { defaultValue: '채널 편집' })
    : t('alerts.addChannel', { defaultValue: '채널 추가' });

  return (
    <div className="-m-4 sm:-m-6 md:-m-8 flex flex-col bg-white dark:bg-bg-main-dark h-[calc(100dvh-3.5rem)] lg:h-[calc(100dvh-4rem)]">
      {/* Page header */}
      <header className="flex-none border-b border-slate-200 dark:border-ui-border-dark px-6 py-3 bg-white dark:bg-bg-main-dark">
        <nav className="flex items-center gap-1 text-sm text-slate-500 dark:text-text-muted-dark mb-2">
          <button
            type="button"
            onClick={goBack}
            className="hover:text-slate-800 dark:hover:text-white transition-colors"
          >
            알림
          </button>
          <MaterialIcon name="chevron_right" className="text-sm opacity-50" />
          <button
            type="button"
            onClick={goBack}
            className="hover:text-slate-800 dark:hover:text-white transition-colors"
          >
            채널
          </button>
          <MaterialIcon name="chevron_right" className="text-sm opacity-50" />
          <span className="text-slate-900 dark:text-white font-medium truncate max-w-50">
            {loading ? '...' : isEdit ? (channel?.name ?? '편집') : '새 채널'}
          </span>
        </nav>
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">{title}</h1>
            <p className="text-sm text-slate-500 dark:text-text-muted-dark mt-0.5">
              {isEdit
                ? `${channel?.name ?? ''} · 채널 설정을 수정합니다`
                : 'Telegram, Discord, Slack 중 채널을 선택하고 연결 정보를 입력하세요'}
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
              form="channel-form"
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

      {/* Form body */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-full text-slate-500">
            <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          </div>
        ) : (
          <ChannelForm
            channel={channel}
            onSuccess={goBack}
            onCancel={goBack}
            onSubmittingChange={setIsSubmitting}
          />
        )}
      </div>
    </div>
  );
}
