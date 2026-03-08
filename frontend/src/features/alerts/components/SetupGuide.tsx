import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MaterialIcon } from '../../../components/common';

interface SetupGuideProps {
    type: 'telegram' | 'discord';
}

export function SetupGuide({ type }: SetupGuideProps) {
    const { t } = useTranslation();
    const [isOpen, setIsOpen] = useState(false);

    const steps = type === 'telegram'
        ? [
            t('alerts.guide.telegram.step1'),
            t('alerts.guide.telegram.step2'),
            t('alerts.guide.telegram.step3'),
            t('alerts.guide.telegram.step4'),
        ]
        : [
            t('alerts.guide.discord.step1'),
            t('alerts.guide.discord.step2'),
            t('alerts.guide.discord.step3'),
        ];

    const tip = type === 'telegram'
        ? t('alerts.guide.telegram.tip')
        : t('alerts.guide.discord.tip');

    return (
        <div className="rounded-lg border border-slate-200 dark:border-ui-border-dark overflow-hidden">
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-slate-50 dark:hover:bg-ui-hover-dark transition-colors"
            >
                <MaterialIcon
                    name="help_outline"
                    className="text-base text-primary shrink-0"
                />
                <span className="text-xs font-semibold text-slate-600 dark:text-text-secondary-dark flex-1">
                    {t('alerts.guide.title')}
                </span>
                <MaterialIcon
                    name={isOpen ? 'expand_less' : 'expand_more'}
                    className="text-base text-slate-400 dark:text-text-dim-dark shrink-0"
                />
            </button>

            {isOpen && (
                <div className="px-3 pb-3 space-y-3 border-t border-slate-100 dark:border-ui-border-dark">
                    <ol className="mt-3 space-y-2">
                        {steps.map((step, i) => (
                            <li key={i} className="flex gap-2 text-xs text-slate-600 dark:text-text-secondary-dark">
                                <span className="shrink-0 w-5 h-5 rounded-full bg-primary/10 text-primary text-[10px] font-bold flex items-center justify-center">
                                    {i + 1}
                                </span>
                                <span className="pt-0.5">{step}</span>
                            </li>
                        ))}
                    </ol>

                    {tip && (
                        <div className="flex gap-2 px-2.5 py-2 rounded-md bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20">
                            <MaterialIcon name="lightbulb" className="text-sm text-amber-500 shrink-0 mt-0.5" />
                            <p className="text-[11px] text-amber-700 dark:text-amber-400">{tip}</p>
                        </div>
                    )}

                    <a
                        href="https://github.com/AI-turn/EveryUp/blob/main/docs/NOTIFICATION_SETUP.md"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
                    >
                        <MaterialIcon name="open_in_new" className="text-sm" />
                        {t('alerts.guide.detailLink')}
                    </a>
                </div>
            )}
        </div>
    );
}
