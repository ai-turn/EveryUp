import { useState } from 'react';
import { useTranslate } from '@tolgee/react';
import { Button, MaterialIcon } from '../../../components/common';
import type { AgentCollectionCapability } from '../../../services/api';
import { AddServiceModal } from './AddServiceModal';

interface CapabilityAgentSetupProps {
  capability: AgentCollectionCapability;
  onCreated?: () => void;
}

export function CapabilityAgentSetup({ capability, onCreated }: CapabilityAgentSetupProps) {
  const { t } = useTranslate();
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <MaterialIcon name="add" />
        {t('Agent 연결')}
      </Button>
      {open && (
        <AddServiceModal
          initialProfile={{ kind: 'custom', capabilities: [capability] }}
          onClose={() => setOpen(false)}
          onCreated={onCreated ?? (() => {})}
        />
      )}
    </>
  );
}
