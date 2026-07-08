import { useTranslation } from 'react-i18next';
import { useAuth } from '../../../contexts/AuthContext';
import { SectionCard } from './SectionCard';

// Signed-in account summary (ver2 settings: 계정 · 인증). Info-only — there is
// no password-change endpoint yet.
export function AccountSection() {
  const { t } = useTranslation('settings');
  const { user } = useAuth();

  if (!user) return null;

  const initials = user.username.slice(0, 2).toUpperCase();

  return (
    <SectionCard icon="person" title={t('settings.account.title')} subtitle={t('settings.account.subtitle')}>
      <div className="flex items-center gap-4">
        <span className="w-10 h-10 rounded-full bg-slate-200 dark:bg-ui-active-dark flex items-center justify-center text-sm font-bold text-slate-600 dark:text-text-secondary-dark shrink-0">
          {initials}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{user.username}</p>
          <p className="text-xs text-slate-400 dark:text-text-dim-dark mt-0.5">
            {t('settings.account.role')} {user.role} · {t('settings.account.session')}
          </p>
        </div>
      </div>
    </SectionCard>
  );
}
