import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MaterialIcon } from '../common';
import { useTheme } from '../../contexts/ThemeContext';
import { Link } from 'react-router-dom';
import logo from '../../assets/logo.png';
import logoDark from '../../assets/logo-dark.png';
import { NotificationDropdown } from './NotificationDropdown';


export function Header() {
    const { theme, toggleTheme } = useTheme();
    const { i18n } = useTranslation();
    const [notifOpen, setNotifOpen] = useState(false);

    const changeLanguage = (lng: string) => {
        i18n.changeLanguage(lng);
    };

    return (
        <header className="h-16 border-b border-slate-200 dark:border-ui-border-dark bg-white dark:bg-bg-main-dark flex items-center justify-between px-4 shrink-0 transition-colors duration-200 z-30 relative">
            {/* 1. Left: Logo Area */}
            <Link to="/" className="flex items-center gap-2 group shrink-0 z-10 transition-transform active:scale-95">
                <div className="flex items-center justify-center h-10 w-10 overflow-hidden">
                    <img src={theme === 'dark' ? logoDark : logo} alt="Monitoring Logo" className="h-full w-full object-contain" />

                </div>
                <div className="flex flex-col">
                    <h1 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight leading-none group-hover:text-primary transition-colors">EveryUp</h1>
                </div>
            </Link>

            {/* 2. Right: Actions */}
            <div className="flex items-center gap-6 z-10">
                {/* Language Switcher */}
                <div className="flex items-center gap-1 bg-slate-100 dark:bg-bg-surface-dark p-1 rounded-lg">
                    <button
                        onClick={() => changeLanguage('ko')}
                        className={`px-2.5 py-1.5 text-xs font-bold rounded-md transition-all ${i18n.language.startsWith('ko')
                            ? 'bg-white dark:bg-ui-hover-dark text-primary shadow-sm'
                            : 'text-slate-500 hover:text-slate-700 dark:text-text-muted-dark dark:hover:text-white'
                            }`}
                    >
                        KO
                    </button>
                    <button
                        onClick={() => changeLanguage('en')}
                        className={`px-2 py-1 text-xs font-bold rounded-md transition-all ${i18n.language.startsWith('en')
                            ? 'bg-white dark:bg-ui-hover-dark text-primary shadow-sm'
                            : 'text-slate-500 hover:text-slate-700 dark:text-text-muted-dark dark:hover:text-white'
                            }`}
                    >
                        EN
                    </button>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2">
                    <button
                        onClick={toggleTheme}
                        className="p-2.5 rounded-lg hover:bg-slate-100 dark:hover:bg-ui-hover-dark text-slate-500 dark:text-text-muted-dark dark:hover:text-white transition-colors"
                        aria-label="Toggle theme"
                    >
                        <MaterialIcon name={theme === 'light' ? 'dark_mode' : 'light_mode'} />
                    </button>
                    <NotificationDropdown
                        open={notifOpen}
                        onToggle={() => setNotifOpen(v => !v)}
                        onClose={() => setNotifOpen(false)}
                    />
                </div>
            </div>
        </header>
    );
}
