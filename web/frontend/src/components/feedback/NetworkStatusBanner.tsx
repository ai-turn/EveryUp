import { useTranslation } from 'react-i18next';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';
import { MaterialIcon } from '../common';

export function NetworkStatusBanner() {
  const { isOnline } = useNetworkStatus();
  const { t } = useTranslation('common');

  if (isOnline) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-red-600 text-white py-2 px-4">
      <div className="flex items-center justify-center gap-2 text-sm font-medium">
        <MaterialIcon name="wifi_off" className="text-lg animate-pulse" />
        <span>{t('network.disconnected')}</span>
      </div>
    </div>
  );
}
