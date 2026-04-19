import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useTranslate } from '@tolgee/react';
import { useSidePanel } from '../contexts/SidePanelContext';
import { useIsMobile } from '../hooks/useMediaQuery';
import { HealthCheckForm } from '../features/healthcheck/components/HealthCheckForm';
import { HealthCheckDesktopView } from '../features/healthcheck/components/HealthCheckDesktopView';
import { HealthCheckMobileView } from '../features/healthcheck/components/HealthCheckMobileView';

export function HealthCheckPage() {
  const { t } = useTranslate();
  const { openPanel } = useSidePanel();
  const isMobile = useIsMobile();
  const location = useLocation();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  const handleServiceAdded = () => {
    setRefreshKey(prev => prev + 1);
  };

  const handleAddService = () => {
    openPanel(
      t('헬스체크 추가'),
      <HealthCheckForm onSuccess={handleServiceAdded} />
    );
  };

  useEffect(() => {
    if (location.state?.openAddModal) {
      handleAddService();
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  const sharedProps = {
    searchQuery,
    statusFilter,
    refreshKey,
    onSearchChange: setSearchQuery,
    onStatusFilterChange: setStatusFilter,
    onAddService: handleAddService,
  } as const;

  if (isMobile) return <HealthCheckMobileView {...sharedProps} />;

  return <HealthCheckDesktopView {...sharedProps} />;
}
