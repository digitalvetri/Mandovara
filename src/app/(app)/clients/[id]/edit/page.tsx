import { notFound } from "next/navigation";
import { Topbar } from "@/components/layout/Topbar";
import { devContext } from "@/lib/dev-context";
import { scoped } from "@/kernel/db/scoped";
import { ClientForm } from "../../_components/ClientForm";
import type { CreateClientInput } from "@/modules/clients/schema";

export const dynamic = "force-dynamic";

export default async function EditClientPage({
  params,
}: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await devContext();
  const db = scoped(ctx);

  const client = await db.client.findUnique({
    where: { id },
    select: {
      id: true, name: true, type: true, mobile: true, email: true,
      gstin: true, pan: true, stateCode: true, paymentTermsDays: true,
      creditLimit: true,
    },
  });
  if (!client) notFound();

  const initial: Partial<CreateClientInput> & { id: string } = {
    id:            client.id,
    name:          client.name,
    type:          client.type as CreateClientInput["type"],
    primaryMobile: client.mobile.replace(/^\+91/, ""),
    primaryEmail:  client.email ?? "",
    gstin:         client.gstin ?? "",
    pan:           client.pan ?? "",
    stateCode:     client.stateCode,
    paymentTerms:  client.paymentTermsDays,
    creditLimit:   client.creditLimit > 0n ? (client.creditLimit / 100n).toString() : "",
  };

  return (
    <>
      <Topbar
        title={`Edit — ${client.name}`}
        eyebrow="Billing address is managed from the client page separately."
      />
      <ClientForm mode="edit" initial={initial} />
    </>
  );
}
