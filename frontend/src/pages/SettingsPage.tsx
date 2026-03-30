import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-hot-toast';
import { getErrorMessage } from '../utils/errors';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { useIsMobile } from '../hooks/useMediaQuery';
import { api } from '../services/api';
import { env } from '../config/env';
import { SettingsDesktopView } from '../features/settings/components/SettingsDesktopView';
import { SettingsMobileView } from '../features/settings/components/SettingsMobileView';

export function SettingsPage() {
  const { t, i18n } = useTranslation(['settings', 'common']);
  const { theme, setTheme } = useTheme();
  const { logout } = useAuth();
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  const [metricsRetention, setMetricsRetention] = useState('7d');
  const [logsRetention, setLogsRetention] = useState('3d');
  const [backendLoading, setBackendLoading] = useState(true);
  const [savingRetention, setSavingRetention] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const settings = await api.getSettings();
        setMetricsRetention(settings.retention.metrics);
        setLogsRetention(settings.retention.logs);
      } catch {
        // Backend unreachable in mock/dev mode
      } finally {
        setBackendLoading(false);
      }
    };
    load();
  }, []);

  const handleLanguageChange = (lng: string) => {
    i18n.changeLanguage(lng);
  };

  const handleSaveRetention = async () => {
    setSavingRetention(true);
    try {
      await api.updateSettings({ retention: { metrics: metricsRetention, logs: logsRetention } });
      toast.success(t('settings.saved'));
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSavingRetention(false);
    }
  };

  const handleReset = async () => {
    setResetting(true);
    try {
      await api.resetAccount();
      toast.success(t('settings.accountReset.success'));
      logout();
      navigate('/login');
    } catch (error) {
      toast.error(getErrorMessage(error));
      setResetting(false);
    }
  };

  const sharedProps = {
    currentLanguage: i18n.language,
    theme: theme as 'light' | 'dark',
    metricsRetention,
    logsRetention,
    backendLoading,
    savingRetention,
    showResetConfirm,
    resetting,
    onLanguageChange: handleLanguageChange,
    onThemeChange: setTheme,
    onMetricsRetentionChange: setMetricsRetention,
    onLogsRetentionChange: setLogsRetention,
    onSaveRetention: handleSaveRetention,
    onResetClick: () => !env.useMock && setShowResetConfirm(true),
    onResetConfirm: handleReset,
    onResetCancel: () => setShowResetConfirm(false),
  } as const;

  if (isMobile) return <SettingsMobileView {...sharedProps} />;

  return <SettingsDesktopView {...sharedProps} />;
}
