import { ReactNode, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { MaterialIcon } from './MaterialIcon';

type Variant = 'danger' | 'primary';

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: ReactNode;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: Variant;
  icon?: string;
  isProcessing?: boolean;
}

const variantStyles: Record<Variant, { iconBg: string; iconText: string; button: string; defaultIcon: string }> = {
  danger: {
    iconBg: 'bg-red-100 dark:bg-red-900/20',
    iconText: 'text-red-600 dark:text-red-400',
    button: 'bg-red-600 hover:bg-red-700',
    defaultIcon: 'warning',
  },
  primary: {
    iconBg: 'bg-primary/10',
    iconText: 'text-primary',
    button: 'bg-primary hover:bg-primary/90',
    defaultIcon: 'help',
  },
};

export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  description,
  confirmLabel,
  cancelLabel,
  variant = 'danger',
  icon,
  isProcessing = false,
}: ConfirmDialogProps) {
  const { t } = useTranslation('common');
  const cancelRef = useRef<HTMLButtonElement>(null);
  const styles = variantStyles[variant];

  useEffect(() => {
    if (!isOpen) return;
    cancelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isProcessing) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, isProcessing, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={() => !isProcessing && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        className="bg-white dark:bg-bg-surface-dark border border-slate-200 dark:border-ui-border-dark rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-slate-200 dark:border-ui-border-dark flex items-center gap-3">
          <div className={`flex items-center justify-center w-10 h-10 rounded-full ${styles.iconBg}`}>
            <MaterialIcon name={icon ?? styles.defaultIcon} className={`${styles.iconText} text-xl`} />
          </div>
          <h2 id="confirm-dialog-title" className="text-xl font-bold text-slate-900 dark:text-white">
            {title}
          </h2>
        </div>

        <div className="p-6">
          <div className="text-slate-600 dark:text-text-muted-dark mb-2">{message}</div>
          {description && (
            <p className="text-sm text-slate-500 dark:text-text-dim-dark">{description}</p>
          )}
        </div>

        <div className="px-6 pb-6 flex gap-3">
          <button
            ref={cancelRef}
            type="button"
            onClick={onClose}
            disabled={isProcessing}
            className="flex-1 py-2 rounded-lg border border-slate-200 dark:border-ui-border-dark text-slate-600 dark:text-text-muted-dark font-bold hover:bg-slate-50 dark:hover:bg-ui-hover-dark transition-all disabled:opacity-50"
          >
            {cancelLabel ?? t('common.cancel')}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isProcessing}
            className={`flex-1 py-2 ${styles.button} text-white font-bold rounded-lg transition-all shadow-md active:scale-95 disabled:opacity-50 disabled:active:scale-100 flex items-center justify-center gap-2`}
          >
            {isProcessing ? (
              <MaterialIcon name="sync" className="text-lg animate-spin" />
            ) : (
              <>
                {variant === 'danger' && <MaterialIcon name="delete" className="text-lg" />}
                {confirmLabel ?? t('common.delete')}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
