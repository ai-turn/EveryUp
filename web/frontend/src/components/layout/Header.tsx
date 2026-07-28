import { useTranslation } from 'react-i18next';
import { useTheme } from '../../contexts/ThemeContext';
import { Link, useLocation } from 'react-router-dom';
import logo from '../../assets/logo.png';
import logoDark from '../../assets/logo-dark.png';
import { useIsMobile } from '../../hooks/useMediaQuery';
import { MaterialIcon } from '../common';

export function Header() {
    const { theme, toggleTheme } = useTheme();
    const { i18n } = useTranslation('common');
    const isMobile = useIsMobile();
    const location = useLocation();

    const changeLanguage = (lng: string) => {
        i18n.changeLanguage(lng);
    };

    const toggleLanguage = () => {
        const next = i18n.language.startsWith('ko') ? 'en' : 'ko';
        i18n.changeLanguage(next);
    };

    const isAlertsActive = location.pathname.startsWith('/alerts');
    const isSettingsActive = location.pathname.startsWith('/settings');

    const iconLinkCls = (active: boolean) =>
        `w-9 h-9 flex items-center justify-center rounded-lg transition-colors ${
            active
                ? 'text-primary bg-primary/10'
                : 'text-text-muted hover:bg-ui-hover hover:text-text-base'
        }`;

    return (
        <header className="h-14 lg:h-16 border-b border-ui-border bg-bg-surface shrink-0 transition-colors duration-200 z-30 relative">
          <div className="h-full max-w-320 mx-auto flex items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
            {/* Left: Logo */}
            <Link to="/" className="flex items-center gap-2 group shrink-0 z-10 transition-transform active:scale-95">
                <div className="flex items-center justify-center h-12 w-12 overflow-hidden">
                    <img src={theme === 'dark' ? logoDark : logo} alt="Monitoring Logo" className="h-full w-full object-contain" />
                </div>
                <div className="flex flex-col">
                    <h1 className="text-lg font-bold text-text-base tracking-tight leading-none group-hover:text-primary transition-colors">EveryUp</h1>
                </div>
            </Link>

            {/* Right: Actions */}
            <div className="flex items-center gap-2 lg:gap-3 z-10 shrink-0">
                {/* Language Switcher */}
                {isMobile ? (
                    <button
                        onClick={toggleLanguage}
                        aria-label={i18n.language.startsWith('ko') ? 'Switch to English' : '한국어로 전환'}
                        className="w-9 h-9 flex items-center justify-center rounded-lg bg-slate-100 dark:bg-bg-surface-dark text-sm font-bold text-text-muted active:scale-95 transition-all"
                    >
                        {i18n.language.startsWith('ko') ? 'EN' : 'KO'}
                    </button>
                ) : (
                    <div className="flex items-center gap-1 bg-slate-100 dark:bg-bg-surface-dark p-1 rounded-lg">
                        <button
                            onClick={() => changeLanguage('ko')}
                            className={`px-2.5 py-1.5 text-sm font-bold rounded-md transition-all ${i18n.language.startsWith('ko')
                                ? 'bg-white dark:bg-ui-hover-dark text-primary shadow-sm'
                                : 'text-slate-500 hover:text-text-secondary dark:hover:text-white'
                                }`}
                        >
                            KO
                        </button>
                        <button
                            onClick={() => changeLanguage('en')}
                            className={`px-2 py-1 text-sm font-bold rounded-md transition-all ${i18n.language.startsWith('en')
                                ? 'bg-white dark:bg-ui-hover-dark text-primary shadow-sm'
                                : 'text-slate-500 hover:text-text-secondary dark:hover:text-white'
                                }`}
                        >
                            EN
                        </button>
                    </div>
                )}

                {/* Icon buttons */}
                <div className="flex items-center gap-1">
                    {!isMobile && (
                        <button
                            onClick={toggleTheme}
                            className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-ui-hover text-text-muted hover:text-text-base transition-colors"
                            aria-label="Toggle theme"
                        >
                            <MaterialIcon name={theme === 'light' ? 'dark_mode' : 'light_mode'} className="text-xl" />
                        </button>
                    )}
                    {!isMobile && (
                        <>
                            <Link to="/alerts" aria-label="Alerts" className={iconLinkCls(isAlertsActive)}>
                                <MaterialIcon name="notifications" className="text-xl" />
                            </Link>
                            <Link to="/settings" aria-label="Settings" className={iconLinkCls(isSettingsActive)}>
                                <MaterialIcon name="settings" className="text-xl" />
                            </Link>
                        </>
                    )}
                </div>
            </div>
          </div>
        </header>
    );
}
