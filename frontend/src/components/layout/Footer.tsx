import { useTranslation } from 'react-i18next';
import { useTheme } from '../../contexts/ThemeContext';
import logo from '../../assets/logo.png';
import logoDark from '../../assets/logo-dark.png';

const GitHubIcon = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current" aria-hidden="true">
    <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844a9.59 9.59 0 012.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
  </svg>
);

export function Footer() {
  const { theme } = useTheme();
  const { t } = useTranslation('common');

  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t border-slate-200 dark:border-ui-border-dark bg-white dark:bg-bg-surface-dark/50">
      <div className="px-8 py-3 md:py-4">
        <div className="flex flex-col md:flex-row items-center justify-between gap-3">

          {/* Left - Brand & Copyright */}
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center overflow-hidden">
              <img
                src={theme === 'dark' ? logoDark : logo}
                alt="EveryUp Logo"
                className="h-full w-full object-contain opacity-80 hover:opacity-100 transition-opacity"
              />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-slate-900 dark:text-white">
                EveryUp
              </span>
              <span className="text-xs text-slate-500 dark:text-text-muted-dark">
                © {currentYear} {t('footer.rights')}
              </span>
            </div>
          </div>

          {/* Center - GitHub + Bug Report */}
          <div className="flex items-center gap-5">
            <a
              href="https://github.com/ai-turn/Monitoring"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-sm text-slate-600 dark:text-text-muted-dark hover:text-slate-900 dark:hover:text-white transition-colors"
            >
              <GitHubIcon />
              <span>GitHub</span>
            </a>
            <a
              href="https://github.com/ai-turn/Monitoring/issues"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-sm text-slate-600 dark:text-text-muted-dark hover:text-red-500 dark:hover:text-red-400 transition-colors"
            >
              <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current" aria-hidden="true">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
              </svg>
              <span>{t('footer.bugReport')}</span>
            </a>
          </div>

          {/* Right - Status & Version */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800">
              <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
                {t('footer.systemOperational')}
              </span>
            </div>
            <div className="text-xs text-slate-400 dark:text-text-dim-dark font-mono px-2 py-1 rounded bg-slate-100 dark:bg-ui-hover-dark">
              v1.0.0
            </div>
          </div>

        </div>
      </div>
    </footer>
  );
}
