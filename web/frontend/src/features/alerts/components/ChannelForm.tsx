import { ReactNode, useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { getErrorMessage } from '../../../utils/errors';
import { MaterialIcon } from '../../../components/common';
import { IconTelegram, IconDiscord, IconSlack } from '../../../components/icons/ChannelIcons';
import {
    api,
    type CreateNotificationChannelData,
    type NotificationChannel,
    type TelegramConfig,
    type DiscordConfig,
    type SlackConfig,
} from '../../../services/api';
import { SetupGuide } from './SetupGuide';

// ─── Schema ───────────────────────────────────────────────────────────────────

const channelSchema = z.object({
    name: z.string().trim().min(2, 'Name is too short'),
    type: z.enum(['telegram', 'discord', 'slack']),
    botToken: z.string().optional(),
    chatId: z.string().optional(),
    webhookUrl: z.string().optional(),
}).superRefine((data, ctx) => {
    if (data.type === 'telegram') {
        if (!data.botToken?.trim()) {
            ctx.addIssue({ code: 'custom', path: ['botToken'], message: 'Bot Token is required' });
        }
        if (!data.chatId?.trim()) {
            ctx.addIssue({ code: 'custom', path: ['chatId'], message: 'Chat ID is required' });
        }
    }

    if (data.type === 'discord' || data.type === 'slack') {
        if (!data.webhookUrl?.trim()) {
            ctx.addIssue({ code: 'custom', path: ['webhookUrl'], message: 'Webhook URL is required' });
        } else if (!/^https?:\/\/.+/.test(data.webhookUrl)) {
            ctx.addIssue({ code: 'custom', path: ['webhookUrl'], message: 'Webhook URL must start with http:// or https://' });
        }
    }
});

type ChannelFormValues = z.infer<typeof channelSchema>;
type ChannelType = 'telegram' | 'discord' | 'slack';

// ─── Channel type metadata ────────────────────────────────────────────────────

const CHANNEL_META: Record<ChannelType, {
    label: string;
    sub: string;
    color: string;
    colorBg: string;
    Icon: React.FC<{ size?: number; className?: string }>;
}> = {
    telegram: {
        label: 'Telegram',
        sub: 'BOT API · 메시지',
        color: 'text-[#26A5E4]',
        colorBg: 'bg-[#26A5E4]/10 border-[#26A5E4]',
        Icon: IconTelegram,
    },
    discord: {
        label: 'Discord',
        sub: 'WEBHOOK · 임베드',
        color: 'text-[#5865F2]',
        colorBg: 'bg-[#5865F2]/10 border-[#5865F2]',
        Icon: IconDiscord,
    },
    slack: {
        label: 'Slack',
        sub: 'WEBHOOK · 메시지',
        color: 'text-[#E01E5A]',
        colorBg: 'bg-[#E01E5A]/10 border-[#E01E5A]',
        Icon: IconSlack,
    },
};

// ─── Layout primitives ────────────────────────────────────────────────────────

function FormStep({ n, title, subtitle, children }: { n: number; title: string; subtitle?: string; children: ReactNode }) {
    return (
        <div className="bg-white dark:bg-bg-surface-dark border border-slate-200 dark:border-ui-border-dark rounded-xl overflow-hidden">
            <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-200 dark:border-ui-border-dark bg-slate-50/50 dark:bg-ui-hover-dark/30">
                <span className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold text-xs font-mono shrink-0">
                    {n}
                </span>
                <div>
                    <p className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">{title}</p>
                    {subtitle && <p className="text-sm text-slate-500 dark:text-text-muted-dark mt-0.5">{subtitle}</p>}
                </div>
            </div>
            <div className="p-5 space-y-5">{children}</div>
        </div>
    );
}

function Field({ label, hint, required, children, error }: {
    label: string; hint?: string | null; required?: boolean; error?: string; children: ReactNode;
}) {
    return (
        <div>
            <div className="flex items-center gap-1 mb-2">
                <label className="text-sm font-bold text-slate-500 dark:text-text-muted-dark uppercase tracking-wide">{label}</label>
                {required && <span className="text-red-500 text-xs">*</span>}
            </div>
            {children}
            {error && <p className="text-sm text-red-500 font-medium mt-1">{error}</p>}
            {hint && !error && <p className="text-sm text-slate-400 dark:text-text-dim-dark mt-1.5 italic">{hint}</p>}
        </div>
    );
}

const inputCls = "w-full px-3.5 py-2.5 bg-slate-50 dark:bg-ui-hover-dark border border-slate-200 dark:border-ui-border-dark rounded-lg text-sm font-semibold outline-none focus:border-primary dark:text-white transition-colors";
const inputMonoCls = inputCls + " font-mono";

// ─── Accurate preview components (matching real backend output) ───────────────

// Telegram: plain-text Markdown message rendered in a chat bubble
function TelegramPreview({ name }: { name: string }) {
    const now = new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
    return (
        <div className="rounded-xl overflow-hidden border border-slate-700 font-sans text-xs">
            {/* Header bar */}
            <div className="flex items-center gap-2 px-3 py-2 bg-[#17212B]">
                <div className="w-7 h-7 rounded-full bg-[#26A5E4] flex items-center justify-center shrink-0">
                    <IconTelegram size={14} className="text-white" />
                </div>
                <div className="min-w-0">
                    <p className="text-white font-semibold text-xs leading-tight truncate">{name || 'EveryUp Bot'}</p>
                    <p className="text-[#7C91A7] text-xs">bot</p>
                </div>
            </div>
            {/* Chat body */}
            <div className="bg-[#0E1621] px-3 py-3">
                <div className="bg-[#182533] rounded-lg rounded-tl-none px-3 py-2.5 max-w-[90%] space-y-1 leading-[1.6]">
                    <p>
                        <span className="text-[#5FBDE3] font-bold">✅ Service Recovered</span>
                    </p>
                    <p className="text-slate-300">
                        <span className="text-[#7C91A7]">Service: </span>Notification Test
                    </p>
                    <p className="text-slate-300">
                        <span className="text-[#7C91A7]">Time: </span>
                        {new Date().toISOString().slice(0, 19).replace('T', ' ')}
                    </p>
                    <p className="text-slate-300">
                        <span className="text-[#7C91A7]">Message: </span>
                        <span className="text-slate-400">This is a test notification. Your EVERYUP notification channel is connected correctly.</span>
                    </p>
                    <p className="text-[#7C91A7] text-xs text-right">{now}</p>
                </div>
            </div>
        </div>
    );
}

// Discord: embed card matching backend output
function DiscordPreview({ name }: { name: string }) {
    return (
        <div className="rounded-xl overflow-hidden border border-[#1e1f22] font-sans text-xs">
            {/* Header bar */}
            <div className="flex items-center gap-2 px-3 py-2 bg-[#313338]">
                <div className="w-7 h-7 rounded-full bg-[#5865F2] flex items-center justify-center shrink-0">
                    <IconDiscord size={14} className="text-white" />
                </div>
                <div className="flex items-center gap-1.5">
                    <span className="text-white font-semibold">{name || 'EVERYUP'}</span>
                    <span className="px-1 py-px bg-[#5865F2] text-white text-xs font-bold rounded uppercase">APP</span>
                </div>
            </div>
            {/* Message area */}
            <div className="bg-[#313338] px-3 pb-3 pt-1">
                {/* Embed */}
                <div className="border-l-4 border-[#3baa7c] bg-[#2b2d31] rounded-r-lg overflow-hidden">
                    <div className="px-3 py-2.5 space-y-2">
                        {/* Embed title */}
                        <p className="text-[#3baa7c] font-bold">✅ Service healthy: Notification Test</p>
                        {/* Embed description */}
                        <p className="text-[#dbdee1] leading-relaxed">
                            This is a test notification. Your EVERYUP notification channel is connected correctly.
                        </p>
                        {/* Fields row */}
                        <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 pt-1">
                            <div>
                                <p className="text-[#b5bac1] text-xs font-bold uppercase mb-0.5">Service ID</p>
                                <p className="text-[#dbdee1]">test</p>
                            </div>
                            <div>
                                <p className="text-[#b5bac1] text-xs font-bold uppercase mb-0.5">Status</p>
                                <p className="text-[#dbdee1]">healthy</p>
                            </div>
                        </div>
                        {/* Footer */}
                        <p className="text-[#87898c] text-xs pt-1 border-t border-[#3f4147]">
                            EVERYUP • {new Date().toISOString().slice(0, 10)}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}

// Slack: Block Kit attachment matching backend output
function SlackPreview({ name }: { name: string }) {
    return (
        <div className="rounded-xl overflow-hidden border border-slate-200 dark:border-[#424242] font-sans text-xs">
            {/* Header bar */}
            <div className="flex items-center gap-2 px-3 py-2 bg-[#4A154B]">
                <div className="w-7 h-7 rounded bg-white flex items-center justify-center shrink-0">
                    <IconSlack size={14} className="text-[#E01E5A]" />
                </div>
                <div className="flex items-center gap-1.5">
                    <span className="text-white font-semibold">{name || 'EVERYUP'}</span>
                    <span className="px-1 py-px bg-white/25 text-white text-xs font-bold rounded uppercase">APP</span>
                </div>
            </div>
            {/* Message body */}
            <div className="bg-white dark:bg-[#1a1d21] px-3 py-2.5">
                {/* Attachment with left colored border */}
                <div className="border-l-4 border-success pl-2.5 space-y-1.5">
                    {/* Header section */}
                    <p className="font-bold text-slate-800 dark:text-slate-100">
                        ✅ <span className="italic">Service healthy: Notification Test</span>
                    </p>
                    {/* Message section */}
                    <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                        This is a test notification. Your EVERYUP notification channel is connected correctly.
                    </p>
                    {/* Fields row */}
                    <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 pt-0.5">
                        <div>
                            <p className="font-bold text-slate-700 dark:text-slate-300 text-xs">Service ID</p>
                            <p className="text-slate-500 dark:text-slate-400">test</p>
                        </div>
                        <div>
                            <p className="font-bold text-slate-700 dark:text-slate-300 text-xs">Status</p>
                            <p className="text-slate-500 dark:text-slate-400">healthy</p>
                        </div>
                    </div>
                    {/* Context footer */}
                    <p className="text-slate-400 dark:text-slate-500 text-xs pt-1">
                        EVERYUP • {new Date().toISOString().slice(0, 10).replace(/-/g, '-')} {new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </p>
                </div>
            </div>
        </div>
    );
}

const PREVIEW_BY_TYPE: Record<ChannelType, React.FC<{ name: string }>> = {
    telegram: TelegramPreview,
    discord: DiscordPreview,
    slack: SlackPreview,
};

// ─── Props ────────────────────────────────────────────────────────────────────

interface ChannelFormProps {
    onSuccess: () => void;
    onCancel: () => void;
    channel?: NotificationChannel;
    onSubmittingChange?: (v: boolean) => void;
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ChannelForm({ onSuccess, onCancel, channel, onSubmittingChange }: ChannelFormProps) {
    const { t } = useTranslation(['alerts', 'common']);
    const isEdit = !!channel;

    const [testState, setTestState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
    const [testError, setTestError] = useState('');
    const [testTime, setTestTime] = useState('');

    const { register, handleSubmit, watch, reset, getValues, trigger, formState: { errors } } = useForm<ChannelFormValues>({
        resolver: zodResolver(channelSchema),
        defaultValues: { type: 'telegram' },
    });

    useEffect(() => {
        if (channel) {
            let config: TelegramConfig | DiscordConfig | SlackConfig | null = null;
            try {
                config = typeof channel.config === 'string'
                    ? JSON.parse(channel.config)
                    : channel.config;
            } catch { config = null; }

            reset({
                name: channel.name,
                type: channel.type as ChannelType,
                botToken: channel.type === 'telegram' && config ? (config as TelegramConfig).botToken : '',
                chatId: channel.type === 'telegram' && config ? (config as TelegramConfig).chatId : '',
                webhookUrl: (channel.type === 'discord' || channel.type === 'slack') && config
                    ? (config as DiscordConfig).webhookUrl : '',
            });
        } else {
            reset({ type: 'telegram', name: '', botToken: '', chatId: '', webhookUrl: '' });
        }
    }, [channel, reset]);

    const watchedType = (watch('type') ?? 'telegram') as ChannelType;
    const watchedName = watch('name') ?? '';
    const watchedBotToken = watch('botToken') ?? '';
    const watchedChatId = watch('chatId') ?? '';
    const watchedWebhook = watch('webhookUrl') ?? '';

    const meta = CHANNEL_META[watchedType];
    const PreviewComponent = PREVIEW_BY_TYPE[watchedType];

    // Build API payload from form values
    const buildPayload = (data: ChannelFormValues): CreateNotificationChannelData => ({
        name: data.name,
        type: data.type,
        config: data.type === 'telegram'
            ? { botToken: data.botToken!, chatId: data.chatId! }
            : { webhookUrl: data.webhookUrl! },
    });

    // Normal save (page header button)
    const onSubmit = async (data: ChannelFormValues) => {
        onSubmittingChange?.(true);
        try {
            if (isEdit) {
                await api.updateNotificationChannel(channel.id, buildPayload(data));
                toast.success(t('alerts.channelUpdated', { defaultValue: 'Channel updated' }));
                onSuccess();
                onCancel();
            } else {
                await api.createNotificationChannel(buildPayload(data));
                toast.success(t('alerts.channelAdded'));
                onSuccess();
                onCancel();
            }
        } catch (error) {
            toast.error(getErrorMessage(error));
        } finally {
            onSubmittingChange?.(false);
        }
    };

    // Test button handler: validate the current form values and send without saving.
    const handleTest = async () => {
        const valid = await trigger();
        if (!valid) {
            setTestState('error');
            setTestError('Please fix the highlighted fields first.');
            toast.error('Please fill in the required fields first.');
            return;
        }

        setTestState('loading');
        setTestError('');
        onSubmittingChange?.(true);
        try {
            await api.testNotificationChannelConfig(buildPayload(getValues()));
            setTestState('success');
            setTestTime(new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
        } catch (error) {
            setTestState('error');
            setTestError(getErrorMessage(error));
        } finally {
            onSubmittingChange?.(false);
        }
    };
    const maskToken = (v: string) => v.length > 8 ? v.slice(0, 6) + '••••' + v.slice(-4) : v ? '••••••' : '';

    return (
        <form id="channel-form" onSubmit={handleSubmit(onSubmit)} className="px-6 py-6">
            <div className="max-w-350 mx-auto grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6">

                {/* ── Left: form steps ─────────────────────────────────── */}
                <div className="space-y-4 min-w-0">

                    {/* Step 1: Type + Name */}
                    <FormStep n={1} title={t('alerts.modal.channelType')}>
                        <Field label={t('common.type')}>
                            <div className="grid grid-cols-3 gap-3">
                                {(['telegram', 'discord', 'slack'] as const).map(type => {
                                    const m = CHANNEL_META[type];
                                    const active = watchedType === type;
                                    return (
                                        <label
                                            key={type}
                                            className={`flex flex-col items-center gap-2.5 p-4 border-2 rounded-xl cursor-pointer transition-all ${
                                                active
                                                    ? m.colorBg
                                                    : 'border-slate-100 dark:border-ui-border-dark hover:border-slate-200 dark:hover:border-slate-600'
                                            }`}
                                        >
                                            <input {...register('type')} type="radio" value={type} className="sr-only" />
                                            <m.Icon size={26} className={active ? m.color : 'text-slate-400 dark:text-text-dim-dark'} />
                                            <span className={`text-sm font-bold ${active ? m.color : 'text-slate-600 dark:text-text-muted-dark'}`}>{m.label}</span>
                                            <span className="text-sm font-semibold uppercase tracking-wider text-slate-400">{m.sub}</span>
                                        </label>
                                    );
                                })}
                            </div>
                        </Field>

                        <Field label={t('common.name')} required error={errors.name?.message}>
                            <input
                                {...register('name')}
                                placeholder={t('alerts.modal.namePlaceholder')}
                                className={inputCls + (errors.name ? ' border-red-500' : '')}
                            />
                        </Field>
                    </FormStep>

                    {/* Step 2: Credentials */}
                    <FormStep n={2} title={t('alerts.modal.credentials')}>
                        {watchedType === 'telegram' ? (
                            <>
                                <Field
                                    label={t('alerts.modal.botToken')}
                                    required
                                    error={errors.botToken?.message}
                                    hint="BotFather에서 발급받은 Bot Token"
                                >
                                    <input
                                        {...register('botToken')}
                                        placeholder={t('alerts.modal.botTokenPlaceholder')}
                                        className={inputMonoCls + (errors.botToken ? ' border-red-500' : '')}
                                    />
                                </Field>
                                <Field
                                    label={t('alerts.modal.chatId')}
                                    required
                                    hint="채팅방 또는 채널의 Chat ID"
                                >
                                    <input
                                        {...register('chatId')}
                                        placeholder={t('alerts.modal.chatIdPlaceholder')}
                                        className={inputMonoCls}
                                    />
                                </Field>
                                <SetupGuide type="telegram" />
                            </>
                        ) : (
                            <>
                                <Field
                                    label={t('alerts.modal.webhookUrl')}
                                    required
                                    error={errors.webhookUrl?.message}
                                    hint={watchedType === 'slack' ? 'Slack Incoming Webhooks URL' : 'Discord Channel Webhook URL'}
                                >
                                    <input
                                        {...register('webhookUrl')}
                                        placeholder={watchedType === 'slack'
                                            ? t('alerts.modal.slackWebhookUrlPlaceholder')
                                            : t('alerts.modal.webhookUrlPlaceholder')}
                                        className={inputMonoCls + (errors.webhookUrl ? ' border-red-500' : '')}
                                    />
                                </Field>
                                <SetupGuide type={watchedType} />
                            </>
                        )}
                    </FormStep>
                </div>

                {/* ── Right: sticky preview + test ─────────────────────── */}
                <div className="hidden lg:block">
                    <div className="sticky top-6 space-y-4">

                        {/* Channel preview card */}
                        <div className="bg-white dark:bg-bg-surface-dark border border-slate-200 dark:border-ui-border-dark rounded-xl overflow-hidden">
                            <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-200 dark:border-ui-border-dark bg-slate-50/50 dark:bg-ui-hover-dark/30">
                                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                                <div>
                                    <p className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-widest">채널 미리보기</p>
                                    <p className="text-sm text-slate-500 dark:text-text-muted-dark mt-0.5">실제 전송 메시지 형식</p>
                                </div>
                            </div>
                            <div className="p-5 space-y-4">
                                {/* Identity */}
                                <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-ui-hover-dark/50 rounded-xl">
                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border-2 ${meta.colorBg}`}>
                                        <meta.Icon size={20} className={meta.color} />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-sm font-bold text-slate-900 dark:text-white truncate">
                                            {watchedName || <span className="text-slate-400 font-normal italic">채널 이름 미입력</span>}
                                        </p>
                                        <p className={`text-sm font-semibold ${meta.color}`}>{meta.label}</p>
                                    </div>
                                </div>

                                {/* Config summary */}
                                <div className="space-y-1.5 text-sm">
                                    {watchedType === 'telegram' ? (
                                        <>
                                            <div className="flex items-center justify-between px-3 py-2 bg-slate-50 dark:bg-ui-hover-dark/50 rounded-lg">
                                                <span className="text-slate-400 font-mono uppercase text-xs tracking-wide">Bot Token</span>
                                                <span className="font-mono text-slate-600 dark:text-slate-400">
                                                    {watchedBotToken ? maskToken(watchedBotToken) : <span className="text-slate-300 dark:text-slate-600 italic">미입력</span>}
                                                </span>
                                            </div>
                                            <div className="flex items-center justify-between px-3 py-2 bg-slate-50 dark:bg-ui-hover-dark/50 rounded-lg">
                                                <span className="text-slate-400 font-mono uppercase text-xs tracking-wide">Chat ID</span>
                                                <span className="font-mono text-slate-600 dark:text-slate-400">
                                                    {watchedChatId || <span className="text-slate-300 dark:text-slate-600 italic">미입력</span>}
                                                </span>
                                            </div>
                                        </>
                                    ) : (
                                        <div className="flex items-center justify-between px-3 py-2 bg-slate-50 dark:bg-ui-hover-dark/50 rounded-lg gap-3">
                                            <span className="text-slate-400 font-mono uppercase text-xs tracking-wide shrink-0">Webhook</span>
                                            <span className="font-mono text-slate-600 dark:text-slate-400 truncate text-right">
                                                {watchedWebhook
                                                    ? watchedWebhook.replace(/^https?:\/\//, '').slice(0, 32) + (watchedWebhook.length > 40 ? '…' : '')
                                                    : <span className="text-slate-300 dark:text-slate-600 italic">미입력</span>}
                                            </span>
                                        </div>
                                    )}
                                </div>

                                {/* Actual message preview */}
                                <div>
                                    <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-2">테스트 메시지 미리보기</p>
                                    <PreviewComponent name={watchedName} />
                                </div>
                            </div>
                        </div>

                        {/* Test send card */}
                        <div className="bg-white dark:bg-bg-surface-dark border border-slate-200 dark:border-ui-border-dark rounded-xl overflow-hidden">
                            <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-200 dark:border-ui-border-dark bg-slate-50/50 dark:bg-ui-hover-dark/30">
                                <MaterialIcon name="send" className="text-base text-slate-400" />
                                <div>
                                    <p className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-widest">테스트 전송</p>
                                    <p className="text-sm text-slate-500 dark:text-text-muted-dark mt-0.5">실제 채널로 테스트 메시지 발송</p>
                                </div>
                            </div>
                            <div className="p-5 space-y-3">
                                <p className="text-sm text-slate-500 dark:text-text-muted-dark leading-relaxed">
                                    Sends a test message using the current form values. The channel is not saved.
                                </p>

                                <button
                                    type="button"
                                    onClick={handleTest}
                                    disabled={testState === 'loading'}
                                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-900 dark:bg-slate-800 text-white text-sm font-bold rounded-xl hover:bg-slate-700 dark:hover:bg-slate-700 transition-all active:scale-95 disabled:opacity-50"
                                >
                                    {testState === 'loading' ? (
                                        <>
                                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                            {'전송 중...'}
                                        </>
                                    ) : (
                                        <>
                                            <MaterialIcon name="send" className="text-sm" />
                                            {'테스트 전송'}
                                        </>
                                    )}
                                </button>

                                {testState === 'success' && (
                                    <div className="flex items-start gap-2 px-3 py-2.5 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 rounded-xl">
                                        <MaterialIcon name="check_circle" className="text-base text-emerald-500 mt-0.5 shrink-0" />
                                        <div>
                                            <p className="text-sm font-bold text-emerald-700 dark:text-emerald-400">발송 성공</p>
                                            <p className="text-sm text-emerald-600 dark:text-emerald-500 mt-0.5">{testTime}에 전송되었습니다</p>
                                        </div>
                                    </div>
                                )}

                                {testState === 'error' && (
                                    <div className="flex items-start gap-2 px-3 py-2.5 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-xl">
                                        <MaterialIcon name="error" className="text-base text-red-500 mt-0.5 shrink-0" />
                                        <div>
                                            <p className="text-sm font-bold text-red-700 dark:text-red-400">발송 실패</p>
                                            <p className="text-sm text-red-600 dark:text-red-500 mt-0.5">{testError}</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                    </div>
                </div>

            </div>
        </form>
    );
}
