import { useEffect, useRef } from 'react';
import { MaterialIcon } from '../common';
import { useSidePanel } from '../../contexts/SidePanelContext';

export function SidePanel() {
    const { isOpen, title, content, size, closePanel } = useSidePanel();
    const widthClass =
        size === 'wide'
            ? 'w-full sm:w-[560px] lg:w-[820px] xl:w-[980px]'
            : 'w-full sm:w-[500px] lg:w-[600px]';
    const panelRef = useRef<HTMLDivElement>(null);

    // Handle ESC key to close
    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (isOpen && e.key === 'Escape') {
                closePanel();
            }
        };
        window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, [isOpen, closePanel]);

    return (
        <>
            {/* Mobile Backdrop - only visible/active on mobile when panel is open */}
            <div
                className={`fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40 transition-opacity duration-500 lg:hidden ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
                    }`}
                onClick={closePanel}
                aria-hidden="true"
            />

            {/* Side Panel */}
            <div
                ref={panelRef}
                className={`
          fixed inset-y-0 right-0 z-50 ${widthClass}
          bg-white dark:bg-bg-surface-dark border-l border-slate-200 dark:border-ui-border-dark
          shadow-2xl transform transition-transform duration-500 ease-in-out
          ${isOpen ? 'translate-x-0' : 'translate-x-full'}
          flex flex-col
        `}
                style={{
                    transitionProperty: 'transform'
                }}
            >
                {/* Header */}
                <div className="flex-none flex items-center justify-between px-6 h-16 border-b border-slate-200 dark:border-ui-border-dark bg-white dark:bg-bg-surface-dark z-10 transition-colors duration-200">
                    <div className="flex items-center gap-3 min-w-0">
                        <MaterialIcon name="apps" className="text-slate-400 dark:text-text-muted-dark shrink-0" />
                        <h2 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight truncate">
                            {title}
                        </h2>
                    </div>
                    <button
                        type="button"
                        className="p-2 -mr-2 text-slate-400 hover:text-slate-600 dark:hover:text-text-base-dark rounded-lg hover:bg-slate-100 dark:hover:bg-ui-hover-dark transition-colors shrink-0"
                        onClick={closePanel}
                    >
                        <MaterialIcon name="close" className="text-xl" />
                        <span className="sr-only">Close panel</span>
                    </button>
                </div>

                {/* Content — forms provide their own scroll area + footer */}
                <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                    {content}
                </div>
            </div>
        </>
    );
}
