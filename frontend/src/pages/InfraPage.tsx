import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { InfraForm } from '../features/infra';
import { InfraDesktopView } from '../features/infra/components/InfraDesktopView';
import { InfraMobileView } from '../features/infra/components/InfraMobileView';
import { useMonitoringResources } from '../hooks/useInfra';
import { useSidePanel } from '../contexts/SidePanelContext';
import { useIsMobile } from '../hooks/useMediaQuery';

export function InfraPage() {
  const navigate = useNavigate();
  const { t } = useTranslation(['infra', 'common']);
  const { openPanel } = useSidePanel();
  const isMobile = useIsMobile();

  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const { data: resources, loading, error, refetch } = useMonitoringResources();

  const handleAddResource = () => {
    openPanel(
      t('infra.addResource'),
      <InfraForm onSuccess={refetch} />
    );
  };

  const filteredResources = (resources || []).filter(r => {
    const matchesSearch =
      r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.ip.includes(searchQuery) ||
      r.cluster.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = !typeFilter || r.type === typeFilter;
    const matchesStatus = !statusFilter || r.status === statusFilter;
    return matchesSearch && matchesType && matchesStatus;
  });

  const sharedProps = {
    filteredResources,
    loading,
    error,
    searchQuery,
    typeFilter,
    statusFilter,
    onSearchChange: setSearchQuery,
    onTypeFilterChange: setTypeFilter,
    onStatusFilterChange: setStatusFilter,
    onClearFilters: () => { setSearchQuery(''); setTypeFilter(''); setStatusFilter(''); },
    onAddResource: handleAddResource,
    onResourceClick: (id: string) => navigate(`/infra/${id}`),
    onRetry: refetch,
  } as const;

  if (isMobile) return <InfraMobileView {...sharedProps} />;

  return <InfraDesktopView {...sharedProps} />;
}
