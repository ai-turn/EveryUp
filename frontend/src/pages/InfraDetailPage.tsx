import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-hot-toast';
import { getErrorMessage } from '../utils/errors';
import { useHost } from '../hooks/useInfra';
import { useSidePanel } from '../contexts/SidePanelContext';
import { api } from '../services/api';
import { InfraForm } from '../features/infra';
import { InfraDetailView } from '../features/infra/components/InfraDetailView';

const hostStatusMap: Record<string, string> = {
  online: 'healthy',
  offline: 'critical',
  unknown: 'warning',
  error: 'error',
};

export function InfraDetailPage() {
  const { resourceId } = useParams();
  const { t } = useTranslation(['infra', 'common']);
  const navigate = useNavigate();
  const { openPanel } = useSidePanel();

  const hostId = resourceId || 'local';
  const { data: host, loading: hostLoading, refetch } = useHost(hostId);

  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isPausing, setIsPausing] = useState(false);

  const name = host?.name || hostId;
  const ip = host?.ip || '';
  const cluster = host?.group || '';
  const isLocal = host?.type === 'local';
  const status = hostStatusMap[host?.status || 'unknown'] || 'healthy';

  // --- Handlers ---
  const handlePauseResume = async () => {
    if (!host) return;
    setIsPausing(true);
    try {
      if (host.isActive) {
        await api.pauseHost(host.id);
        toast.success(t('infra.toast.paused'));
      } else {
        await api.resumeHost(host.id);
        toast.success(t('infra.toast.resumed'));
      }
      refetch();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setIsPausing(false);
    }
  };

  const handleDelete = async () => {
    if (!host) return;
    setIsDeleting(true);
    try {
      await api.deleteHost(host.id);
      toast.success(t('infra.toast.deleted'));
      navigate('/infra');
    } catch (error) {
      toast.error(getErrorMessage(error));
      setIsDeleting(false);
    }
  };

  const handleEdit = () => {
    if (!host) return;
    openPanel(
      t('infra.editHost'),
      <InfraForm onSuccess={refetch} host={host} />
    );
  };

  // --- Shared props ---
  const sharedProps = {
    host,
    hostId,
    hostLoading,
    status,
    name,
    ip,
    isLocal,
    isDeleting,
    isDeleteDialogOpen,
    onPauseResume: handlePauseResume,
    onDelete: handleDelete,
    onEdit: handleEdit,
    onDeleteDialogOpen: () => {
      if (isLocal) {
        toast.error(t('infra.toast.cannotDeleteLocal'));
        return;
      }
      setIsDeleteDialogOpen(true);
    },
    onDeleteDialogClose: () => setIsDeleteDialogOpen(false),
  } as const;

  return (
    <InfraDetailView
      {...sharedProps}
      cluster={cluster}
      isPausing={isPausing}
    />
  );
}
