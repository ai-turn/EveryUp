import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MaterialIcon } from '../components/common';

export function NotFoundPage() {
  const { t } = useTranslation('common');

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8">
      {/* 404 아이콘 */}
      <MaterialIcon
        name="sentiment_dissatisfied"
        className="text-8xl text-slate-300 dark:text-text-dim-dark mb-4"
      />

      {/* 404 텍스트 */}
      <h1 className="text-6xl font-bold text-slate-900 dark:text-white mb-2">
        {t('notfound.title')}
      </h1>

      {/* 설명 */}
      <p className="text-xl text-slate-600 dark:text-text-muted-dark mb-8">
        {t('notfound.subtitle')}
      </p>

      {/* 홈으로 돌아가기 버튼 */}
      <Link
        to="/"
        className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-white font-semibold rounded-lg hover:bg-primary/90 transition-colors"
      >
        <MaterialIcon name="home" className="text-xl" />
        {t('common.backToDashboard')}
      </Link>
    </div>
  );
}
