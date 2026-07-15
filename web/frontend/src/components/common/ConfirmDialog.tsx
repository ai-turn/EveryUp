import { ReactNode, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { MaterialIcon } from './MaterialIcon';
import { Button } from './Button';

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

const variantStyles: Record<Variant, { iconBg: string; iconText: string; defaultIcon: string }> = {
  danger: {
    iconBg: 'bg-red-100 dark:bg-red-900/20',
    iconText: 'text-red-600 dark:text-red-400',
    defaultIcon: 'warning',
  },
  primary: {
    iconBg: 'bg-primary/10',
    iconText: 'text-primary',
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
        className="bg-bg-surface border border-ui-border rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-ui-border flex items-center gap-3">
          <div className={`flex items-center justify-center w-10 h-10 rounded-full ${styles.iconBg}`}>
            <MaterialIcon name={icon ?? styles.defaultIcon} className={`${styles.iconText} text-xl`} />
          </div>
          <h2 id="confirm-dialog-title" className="text-xl font-bold text-text-base">
            {title}
          </h2>
        </div>

        <div className="p-6">
          <div className="text-text-muted mb-2">{message}</div>
          {description && (
            <p className="text-sm text-text-dim">{description}</p>
          )}
        </div>

        <div className="px-6 pb-6 flex gap-3">
          <Button
            ref={cancelRef}
            type="button"
            variant="secondary"
            onClick={onClose}
            disabled={isProcessing}
            className="flex-1"
          >
            {cancelLabel ?? t('common.cancel')}
          </Button>
          <Button
            type="button"
            variant={variant}
            onClick={onConfirm}
            disabled={isProcessing}
            className="flex-1"
          >
            {isProcessing ? (
              <MaterialIcon name="sync" className="text-lg animate-spin" />
            ) : (
              <>
                {variant === 'danger' && <MaterialIcon name="delete" className="text-lg" />}
                {confirmLabel ?? t('common.delete')}
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
