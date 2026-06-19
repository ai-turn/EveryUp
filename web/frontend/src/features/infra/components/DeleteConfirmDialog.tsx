import { useEffect, useRef } from 'react';
import { MaterialIcon } from '../../../components/common';
import { useTranslation } from 'react-i18next';

interface DeleteConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  hostName: string;
  isDeleting: boolean;
}

export function DeleteConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  hostName,
  isDeleting,
}: DeleteConfirmDialogProps) {
  const { t } = useTranslation(['infra', 'common']);
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (isOpen) cancelRef.current?.focus();
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-dialog-title"
        className="bg-white dark:bg-bg-surface-dark border border-slate-200 dark:border-ui-border-dark rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-ui-border-dark flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 bg-red-100 dark:bg-red-900/20 rounded-full">
            <MaterialIcon name="warning" className="text-red-600 dark:text-red-400 text-xl" />
          </div>
          <h2 id="delete-dialog-title" className="text-xl font-bold text-slate-900 dark:text-white">{t('infra.deleteConfirm.title')}</h2>
        </div>

        {/* Content */}
        <div className="p-6">
          <p className="text-slate-600 dark:text-text-muted-dark mb-2">
            {t('infra.deleteConfirm.message')} <span className="font-bold text-slate-900 dark:text-white">{hostName}</span>?
          </p>
          <p className="text-sm text-slate-500 dark:text-text-dim-dark">
            {t('infra.deleteConfirm.warning')}
          </p>
        </div>

        {/* Actions */}
        <div className="px-6 pb-6 flex gap-3">
          <button
            ref={cancelRef}
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="flex-1 py-2 rounded-lg border border-slate-200 dark:border-ui-border-dark text-slate-600 dark:text-text-muted-dark font-bold hover:bg-slate-50 dark:hover:bg-ui-hover-dark transition-all disabled:opacity-50"
          >
            {t('common.cancel')}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isDeleting}
            className="flex-1 py-2 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 transition-all shadow-md active:scale-95 disabled:opacity-50 disabled:active:scale-100 flex items-center justify-center gap-2"
          >
            {isDeleting ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <MaterialIcon name="delete" className="text-lg" />
                {t('common.delete')}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
