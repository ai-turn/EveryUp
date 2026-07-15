import { useTranslation } from 'react-i18next';
import { Button, MaterialIcon } from '../common';

interface ErrorFallbackProps {
  error: Error | null;
  onReset: () => void;
}

export function ErrorFallback({ error, onReset }: ErrorFallbackProps) {
  const { t } = useTranslation('common');

  const handleGoHome = () => {
    window.location.href = '/';
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg-main dark:bg-bg-main-dark p-8">
      <div className="text-center max-w-md">
        <MaterialIcon
          name="error_outline"
          className="text-8xl text-red-500 mb-4"
        />

        <h1 className="text-2xl font-bold text-text-base mb-2">
          {t('errorFallback.title')}
        </h1>

        <p className="text-text-muted mb-4">
          {t('errorFallback.description')}
        </p>

        {import.meta.env.DEV && error && (
          <pre className="text-left text-xs bg-ui-hover p-4 rounded-lg mb-4 overflow-auto max-h-32">
            {error.message}
          </pre>
        )}

        <div className="flex gap-4 justify-center">
          <button
            onClick={onReset}
            className="px-4 py-2 border border-ui-border text-text-secondary font-semibold rounded-lg hover:bg-ui-hover transition-colors"
          >
            {t('errorFallback.retry')}
          </button>
          <Button onClick={handleGoHome}>
            {t('errorFallback.goHome')}
          </Button>
        </div>
      </div>
    </div>
  );
}
