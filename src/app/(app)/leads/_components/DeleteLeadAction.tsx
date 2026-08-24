"use client";

import { DangerDeleteButton } from "@/components/data/DangerDeleteButton";
import { deleteLead } from "@/modules/leads/actions-part2";

interface Props {
  leadId:   string;
  leadName: string;
}

export function DeleteLeadAction({ leadId, leadName }: Props) {
  return (
    <DangerDeleteButton
      entityLabel="lead"
      entityName={leadName}
      redirectTo="/leads"
      extraWarning="Any quotations, follow-ups or WhatsApp logs tied to this lead will be kept but detached — they'll show up in their own modules without a lead link."
      onDelete={() => deleteLead(leadId)}
    />
  );
}
