import React from 'react';

interface PageHeaderProps {
    title: string;
    subtitle?: string;
    children?: React.ReactNode;
}

export function PageHeader({ title, subtitle, children }: PageHeaderProps) {
    return (
        <div className="mb-6">
            <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
                <div className="min-w-0 flex-1 md:pt-1">
                    <h1 className="type-page-title text-text-base">{title}</h1>
                    {subtitle && (
                        <p className="mt-2 type-body text-text-muted max-w-2xl">
                            {subtitle}
                        </p>
                    )}
                </div>
                {children && (
                    <div className="flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center md:w-auto md:shrink-0 md:justify-end">
                        {children}
                    </div>
                )}
            </div>
        </div>
    );
}
