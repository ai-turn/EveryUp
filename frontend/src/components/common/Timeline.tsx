import React from 'react';
import { MaterialIcon } from './MaterialIcon';

export interface TimelineEvent {
    id: string;
    time: string;
    icon: string;
    iconColorClass: string;
    content: React.ReactNode;
    onClick?: () => void;
}

interface TimelineProps {
    title?: string;
    events: TimelineEvent[];
    emptyMessage?: string;
    action?: {
        label: string;
        onClick: () => void;
    };
}

export function Timeline({ title, events, emptyMessage = 'No events found', action }: TimelineProps) {
    return (
        <div className="bg-white dark:bg-bg-surface-dark border border-slate-300 dark:border-ui-border-dark rounded-xl overflow-hidden">
            {/* Header - only rendered when title is provided */}
            {title && (
                <div className="px-6 py-4 border-b border-slate-300 dark:border-ui-border-dark flex items-center justify-between">
                    <h2 className="font-bold text-slate-900 dark:text-white">{title}</h2>
                    {action && (
                        <span
                            onClick={action.onClick}
                            className="text-sm text-primary font-medium cursor-pointer hover:underline"
                        >
                            {action.label}
                        </span>
                    )}
                </div>
            )}

            {/* Event List */}
            <div className="divide-y divide-slate-200 dark:divide-ui-border-dark">
                {events.length > 0 ? (
                    events.map((event) => (
                        <div
                            key={event.id}
                            onClick={event.onClick}
                            className={`px-6 py-4 flex items-center gap-4 transition-colors ${event.onClick ? 'cursor-pointer hover:bg-slate-50 dark:hover:bg-ui-hover-dark/50 active:bg-slate-100 dark:active:bg-ui-hover-dark' : ''}`}
                        >
                            <span className="text-sm text-slate-500 font-mono w-24 shrink-0">{event.time}</span>
                            <MaterialIcon name={event.icon} className={`${event.iconColorClass} text-lg shrink-0`} />
                            <div className="text-sm text-slate-700 dark:text-text-secondary-dark flex-1 min-w-0">
                                {event.content}
                            </div>
                            {event.onClick && (
                                <MaterialIcon name="chevron_right" className="text-slate-300 dark:text-text-dim-dark text-lg shrink-0" />
                            )}
                        </div>
                    ))
                ) : (
                    <div className="px-6 py-8 text-center text-slate-500 text-sm">
                        {emptyMessage}
                    </div>
                )}
            </div>
        </div>
    );
}
