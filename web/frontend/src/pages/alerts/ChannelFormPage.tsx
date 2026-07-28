import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-hot-toast';
import { api, type NotificationChannel } from '../../services/api';
import { ChannelForm } from '../../features/alerts/components/ChannelForm';
import { Button, MaterialIcon } from '../../components/common';
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
    <div className="-m-4 sm:-m-6 md:-m-8 flex flex-col bg-bg-main h-[calc(100dvh-3.5rem)] lg:h-[calc(100dvh-4rem)]">
      {/* Page header */}
      <header className="flex-none border-b border-ui-border px-6 py-3 bg-bg-surface">
        <nav className="flex items-center gap-1 text-sm text-text-muted mb-2">
          <button
            type="button"
            onClick={goBack}
            className="hover:text-text-base transition-colors"
          >
            {t('alerts.title')}
          </button>
          <MaterialIcon name="chevron_right" className="text-sm opacity-50" />
          <button
            type="button"
            onClick={goBack}
            className="hover:text-text-base transition-colors"
          >
            {t('alerts.table.channel')}
          </button>
          <MaterialIcon name="chevron_right" className="text-sm opacity-50" />
          <span className="text-text-base font-medium truncate max-w-50">
            {loading ? '...' : isEdit ? (channel?.name ?? t('common.edit')) : t('alerts.modal.newChannel', { defaultValue: '새 채널' })}
          </span>
        </nav>
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-text-base tracking-tight">{title}</h1>
            <p className="text-sm text-text-muted mt-0.5">
              {isEdit
                ? t('alerts.modal.editSubtitle', { name: channel?.name ?? '', defaultValue: '{{name}} · 채널 설정을 수정합니다' })
                : t('alerts.modal.newSubtitle', { defaultValue: 'Telegram, Discord, Slack 중 채널을 선택하고 연결 정보를 입력하세요' })}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button type="button" variant="secondary" onClick={goBack}>
              {t('common.cancel')}
            </Button>
            <Button
              type="submit"
              form="channel-form"
              disabled={loading || isSubmitting}
            >
              {isSubmitting ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <MaterialIcon name="save" className="text-sm" />
                  {t('common.save')}
                </>
              )}
            </Button>
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
