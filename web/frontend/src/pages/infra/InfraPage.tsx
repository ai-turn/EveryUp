import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { InfraDesktopView } from '../../features/infra/components/InfraDesktopView';
import { InfraMobileView } from '../../features/infra/components/InfraMobileView';
import { useMonitoringResources } from '../../hooks/useInfra';
import { useIsMobile } from '../../hooks/useMediaQuery';

export function InfraPage() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const { data: resources, loading, error, refetch } = useMonitoringResources();

  const handleAddResource = () => {
    navigate('/infra/new');
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

  const incidentCount = (resources || []).filter(r =>
    ['warning', 'critical', 'error', 'unknown'].includes(r.status)
  ).length;
  const remoteCount = (resources || []).filter(r => r.isRemote).length;

  const sharedProps = {
    resources: resources || [],
    filteredResources,
    incidentCount,
    remoteCount,
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
