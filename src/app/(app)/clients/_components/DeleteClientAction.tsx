"use client";

import { DangerDeleteButton } from "@/components/data/DangerDeleteButton";
import { deleteClient } from "@/modules/clients/actions";

interface Props {
  clientId:   string;
  clientName: string;
  projectCount: number;
}

export function DeleteClientAction({ clientId, clientName, projectCount }: Props) {
  const blocked = projectCount > 0;
  return (
    <DangerDeleteButton
      entityLabel="client"
      entityName={clientName}
      redirectTo="/clients"
      extraWarning={
        blocked
          ? `This client has ${projectCount} project${projectCount === 1 ? "" : "s"}. Cancel or complete those first, then delete.`
          : undefined
      }
      onDelete={() =>
        blocked
          ? Promise.resolve({ ok: false, error: `Cannot delete — this client has ${projectCount} project${projectCount === 1 ? "" : "s"}.` })
          : deleteClient(clientId)
      }
    />
  );
}
