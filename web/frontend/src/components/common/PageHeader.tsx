import React from 'react';

interface PageHeaderProps {
    title: string;
    subtitle?: string;
    children?: React.ReactNode;
}

export function PageHeader({ title, subtitle, children }: PageHeaderProps) {
    return (
        <div className="mb-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold mb-2 text-slate-900 dark:text-white">{title}</h1>
                    {subtitle && (
                        <p className="text-slate-600 dark:text-text-muted-dark max-w-2xl">
                            {subtitle}
                        </p>
                    )}
                </div>
                {children && (
                    <div className="flex items-center gap-3">
                        {children}
                    </div>
                )}
            </div>
        </div>
    );
}
