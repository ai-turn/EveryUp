import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { getErrorMessage } from '../../../utils/errors';
import { MaterialIcon } from '../../../components/common';
import { IconTelegram, IconDiscord, IconSlack } from '../../../components/icons/ChannelIcons';
import { api, type CreateNotificationChannelData, type NotificationChannel, type TelegramConfig, type DiscordConfig, type SlackConfig } from '../../../services/api';
import { useSidePanel } from '../../../contexts/SidePanelContext';
import { SetupGuide } from './SetupGuide';

const channelSchema = z.object({
    name: z.string().min(2, 'Name is too short'),
    type: z.enum(['telegram', 'discord', 'slack']),
    botToken: z.string().optional(),
    chatId: z.string().optional(),
    webhookUrl: z.string().optional(),
}).refine(data => {
    if (data.type === 'telegram' && (!data.botToken || !data.chatId)) return false;
    if ((data.type === 'discord' || data.type === 'slack') && !data.webhookUrl) return false;
    if ((data.type === 'discord' || data.type === 'slack') && data.webhookUrl && !/^https?:\/\/.+/.test(data.webhookUrl)) return false;
    return true;
}, {
    message: 'Please fill in all required fields',
    path: ['botToken'],
});

type ChannelFormValues = z.infer<typeof channelSchema>;

interface ChannelFormProps {
    onSuccess: () => void;
    channel?: NotificationChannel;
}

export function ChannelForm({ onSuccess, channel }: ChannelFormProps) {
    const { t } = useTranslation(['alerts', 'common']);
    const { closePanel } = useSidePanel();
    const [isTesting, setIsTesting] = useState(false);
    const isEditMode = !!channel;

    const {
        register,
        handleSubmit,
        watch,
        reset,
        formState: { errors, isSubmitting },
    } = useForm<ChannelFormValues>({
        resolver: zodResolver(channelSchema),
        defaultValues: {
            type: 'telegram',
        },
    });

    useEffect(() => {
        if (channel) {
            let config: TelegramConfig | DiscordConfig | SlackConfig | null = null;
            try {
                config = typeof channel.config === 'string'
                    ? JSON.parse(channel.config)
                    : channel.config;
            } catch {
                config = null;
            }

            reset({
                name: channel.name,
                type: channel.type,
                botToken: channel.type === 'telegram' && config ? (config as TelegramConfig).botToken : '',
                chatId: channel.type === 'telegram' && config ? (config as TelegramConfig).chatId : '',
                webhookUrl: (channel.type === 'discord' || channel.type === 'slack') && config ? (config as DiscordConfig).webhookUrl : '',
            });
        } else {
            reset({ type: 'telegram', name: '', botToken: '', chatId: '', webhookUrl: '' });
        }
    }, [channel, reset]);

    const selectedType = watch('type');

    const onSubmit = async (data: ChannelFormValues) => {
        try {
            const payload: CreateNotificationChannelData = {
                name: data.name,
                type: data.type,
                config: data.type === 'telegram'
                    ? { botToken: data.botToken!, chatId: data.chatId! }
                    : { webhookUrl: data.webhookUrl! }, // discord & slack both use webhookUrl
            };

            if (isEditMode) {
                await api.updateNotificationChannel(channel.id, payload);
                toast.success(t('alerts.channelUpdated', { defaultValue: 'Channel updated' }));
            } else {
                const created = await api.createNotificationChannel(payload);
                toast.success(t('alerts.channelAdded'));

                if (created.id) {
                    setIsTesting(true);
                    try {
                        await api.testNotificationChannel(created.id);
                        toast.success(t('alerts.testSent'));
                    } catch (error) {
                        toast.error(getErrorMessage(error));
                    } finally {
                        setIsTesting(false);
                    }
                }
            }

            onSuccess();
            closePanel();
        } catch (error) {
            toast.error(getErrorMessage(error));
        }
    };

    return (
        <>
        <div className="flex-1 overflow-y-auto overflow-x-hidden px-6 pt-6 pb-4 custom-scrollbar">
        <form id="channel-form" onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="space-y-4">
                <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                        {t('common.name')}
                    </label>
                    <input
                        {...register('name')}
                        placeholder={t('alerts.modal.namePlaceholder')}
                        className={`w-full px-4 py-2 bg-slate-50 dark:bg-ui-hover-dark border ${errors.name ? 'border-red-500' : 'border-slate-200 dark:border-ui-border-dark'} rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all text-sm dark:text-white`}
                    />
                    {errors.name && <p className="text-xs text-red-500 font-medium">{errors.name.message}</p>}
                </div>

                <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                        {t('common.type')}
                    </label>
                    <div className="flex gap-2">
                        <label className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg border cursor-pointer transition-all ${selectedType === 'telegram' ? 'bg-[#26A5E4]/10 border-[#26A5E4] text-[#26A5E4] font-bold' : 'bg-slate-50 dark:bg-ui-hover-dark border-slate-200 dark:border-ui-border-dark text-slate-500'}`}>
                            <input {...register('type')} type="radio" value="telegram" className="hidden" />
                            <IconTelegram size={18} />
                            {t('alerts.modal.telegram')}
                        </label>
                        <label className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg border cursor-pointer transition-all ${selectedType === 'discord' ? 'bg-[#5865F2]/10 border-[#5865F2] text-[#5865F2] font-bold' : 'bg-slate-50 dark:bg-ui-hover-dark border-slate-200 dark:border-ui-border-dark text-slate-500'}`}>
                            <input {...register('type')} type="radio" value="discord" className="hidden" />
                            <IconDiscord size={18} />
                            {t('alerts.modal.discord')}
                        </label>
                        <label className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg border cursor-pointer transition-all ${selectedType === 'slack' ? 'bg-[#4A154B]/10 border-[#4A154B] text-[#4A154B] font-bold dark:bg-[#E01E5A]/10 dark:border-[#E01E5A] dark:text-[#E01E5A]' : 'bg-slate-50 dark:bg-ui-hover-dark border-slate-200 dark:border-ui-border-dark text-slate-500'}`}>
                            <input {...register('type')} type="radio" value="slack" className="hidden" />
                            <IconSlack size={18} />
                            {t('alerts.modal.slack')}
                        </label>
                    </div>
                </div>

                {selectedType === 'telegram' ? (
                    <>
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">{t('alerts.modal.botToken')}</label>
                            <input
                                {...register('botToken')}
                                placeholder={t('alerts.modal.botTokenPlaceholder')}
                                className={`w-full px-4 py-2 bg-slate-50 dark:bg-ui-hover-dark border ${errors.botToken ? 'border-red-500' : 'border-slate-200 dark:border-ui-border-dark'} rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all text-sm font-mono dark:text-white`}
                            />
                            {errors.botToken && <p className="text-xs text-red-500 font-medium">{errors.botToken.message}</p>}
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">{t('alerts.modal.chatId')}</label>
                            <input
                                {...register('chatId')}
                                placeholder={t('alerts.modal.chatIdPlaceholder')}
                                className={`w-full px-4 py-2 bg-slate-50 dark:bg-ui-hover-dark border ${errors.chatId ? 'border-red-500' : 'border-slate-200 dark:border-ui-border-dark'} rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all text-sm font-mono dark:text-white`}
                            />
                        </div>
                        <SetupGuide type="telegram" />
                    </>
                ) : (
                    <>
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">{t('alerts.modal.webhookUrl')}</label>
                            <input
                                {...register('webhookUrl')}
                                placeholder={selectedType === 'slack' ? t('alerts.modal.slackWebhookUrlPlaceholder') : t('alerts.modal.webhookUrlPlaceholder')}
                                className={`w-full px-4 py-2 bg-slate-50 dark:bg-ui-hover-dark border ${errors.webhookUrl ? 'border-red-500' : 'border-slate-200 dark:border-ui-border-dark'} rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all text-sm font-mono dark:text-white`}
                            />
                            {errors.webhookUrl && <p className="text-xs text-red-500 font-medium">{errors.webhookUrl.message}</p>}
                        </div>
                        <SetupGuide type={selectedType as 'discord' | 'slack'} />
                    </>
                )}
            </div>

        </form>
        </div>
        <div className="flex-none border-t border-slate-200 dark:border-ui-border-dark bg-white dark:bg-bg-surface-dark px-6 py-4 flex gap-3">
            <button
                type="button"
                onClick={closePanel}
                className="flex-1 py-3 rounded-lg border border-slate-200 dark:border-ui-border-dark text-slate-600 dark:text-text-muted-dark font-bold hover:bg-slate-50 dark:hover:bg-ui-hover-dark transition-all"
            >
                {t('common.cancel')}
            </button>
            <button
                type="submit"
                form="channel-form"
                disabled={isSubmitting || isTesting}
                className="flex-1 py-3 bg-primary text-white font-bold rounded-lg hover:bg-primary/90 transition-all shadow-md active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
            >
                {isSubmitting || isTesting ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                    <>
                        <MaterialIcon name="save" className="text-lg" />
                        {t('common.save')}
                    </>
                )}
            </button>
        </div>
        </>
    );
}
