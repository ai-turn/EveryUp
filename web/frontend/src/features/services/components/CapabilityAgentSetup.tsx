import { useState } from 'react';
import { Button, MaterialIcon } from '../../../components/common';
import type { AgentCollectionCapability } from '../../../services/api';
import { AddServiceModal } from './AddServiceModal';

interface CapabilityAgentSetupProps {
  capability: AgentCollectionCapability;
  onCreated?: () => void;
  buttonVariant?: 'primary' | 'secondary' | 'ghost';
}

export function CapabilityAgentSetup({ capability, onCreated, buttonVariant = 'primary' }: CapabilityAgentSetupProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant={buttonVariant} onClick={() => setOpen(true)}>
        <MaterialIcon name="add" />
        Docker 연결
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
