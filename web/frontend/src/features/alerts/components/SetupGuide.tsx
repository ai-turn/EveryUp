import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MaterialIcon } from '../../../components/common';

interface SetupGuideProps {
    type: 'telegram' | 'discord' | 'slack';
}

export function SetupGuide({ type }: SetupGuideProps) {
    const { t } = useTranslation(['alerts', 'common']);
    const [isOpen, setIsOpen] = useState(false);

    const stepsMap: Record<string, string[]> = {
        telegram: [
            t('alerts.guide.telegram.step1'),
            t('alerts.guide.telegram.step2'),
            t('alerts.guide.telegram.step3'),
            t('alerts.guide.telegram.step4'),
        ],
        discord: [
            t('alerts.guide.discord.step1'),
            t('alerts.guide.discord.step2'),
            t('alerts.guide.discord.step3'),
        ],
        slack: [
            t('alerts.guide.slack.step1'),
            t('alerts.guide.slack.step2'),
            t('alerts.guide.slack.step3'),
        ],
    };

    const steps = stepsMap[type] || [];
    const tip = t(`alerts.guide.${type}.tip`);

    return (
        <div className="rounded-lg border border-ui-border overflow-hidden">
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-ui-hover-soft transition-colors"
            >
                <MaterialIcon
                    name="help_outline"
                    className="text-base text-primary shrink-0"
                />
                <span className="text-sm font-semibold text-text-secondary flex-1">
                    {t('alerts.guide.title')}
                </span>
                <MaterialIcon
                    name={isOpen ? 'expand_less' : 'expand_more'}
                    className="text-base text-text-dim shrink-0"
                />
            </button>

            {isOpen && (
                <div className="px-3 pb-3 space-y-3 border-t border-ui-border-soft">
                    <ol className="mt-3 space-y-2">
                        {steps.map((step, i) => (
                            <li key={i} className="flex gap-2 text-sm text-text-secondary">
                                <span className="shrink-0 w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center">
                                    {i + 1}
                                </span>
                                <span className="pt-0.5">{step}</span>
                            </li>
                        ))}
                    </ol>

                    {tip && (
                        <div className="flex gap-2 px-2.5 py-2 rounded-md bg-ui-hover-soft border border-ui-border">
                            <MaterialIcon name="lightbulb" className="text-sm text-amber-500 shrink-0 mt-0.5" />
                            <p className="text-sm text-text-secondary">{tip}</p>
                        </div>
                    )}

                    <a
                        href="https://github.com/ai-turn/everyup/blob/main/docs/NOTIFICATION_SETUP.md"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
                    >
                        <MaterialIcon name="open_in_new" className="text-sm" />
                        {t('alerts.guide.detailLink')}
                    </a>
                </div>
            )}
        </div>
    );
}
