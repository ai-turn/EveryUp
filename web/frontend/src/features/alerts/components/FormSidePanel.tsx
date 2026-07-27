import { ReactNode } from 'react';
import { MaterialIcon } from '../../../components/common';
import { useOverlay, SCRIM_PANEL } from '../../../hooks/useOverlay';

interface FormSidePanelProps {
    open: boolean;
    icon: string;
    title: string;
    onClose: () => void;
    /** Bottom action bar (cancel/submit) — submit targets the form via form="…". */
    footer: ReactNode;
    children: ReactNode;
}

// 로그/API의 TracePanel과 같은 우측 슬라이드 오버레이 — 폼 전용으로 하단 액션 바가 고정된다.
export function FormSidePanel({ open, icon, title, onClose, footer, children }: FormSidePanelProps) {
    useOverlay(open, onClose);

    if (!open) return null;

    return (
        <div
            className="fixed inset-0 z-50"
            role="dialog"
            aria-modal="true"
            aria-label={title}
            onClick={onClose}
        >
            <div className={`absolute inset-0 ${SCRIM_PANEL}`} aria-hidden="true" />
            <div
                onClick={(e) => e.stopPropagation()}
                className="fixed inset-y-0 right-0 w-full sm:w-[560px] lg:w-[820px] xl:w-[980px] bg-bg-surface border-l border-ui-border shadow-2xl flex flex-col animate-slide-in-right"
            >
                <div className="flex-none flex items-center gap-3 px-5 h-16 border-b border-ui-border">
                    <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-primary/10 text-primary shrink-0">
                        <MaterialIcon name={icon} className="text-lg" />
                    </div>
                    <h3 className="flex-1 min-w-0 truncate text-base font-bold text-text-base">{title}</h3>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1.5 rounded hover:bg-ui-hover text-slate-400 hover:text-text-secondary cursor-pointer shrink-0"
                    >
                        <MaterialIcon name="close" className="text-base" />
                        <span className="sr-only">Close panel</span>
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>

                <div className="flex-none flex items-center justify-end gap-2 px-5 py-3 border-t border-ui-border">
                    {footer}
                </div>
            </div>
        </div>
    );
}
