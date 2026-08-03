import { Topbar } from "@/components/layout/Topbar";
import { ClientForm } from "../_components/ClientForm";

export const dynamic = "force-dynamic";

export default function NewClientPage() {
  return (
    <>
      <Topbar
        title="New client"
        eyebrow="GSTIN and PAN are optional — add later once verified."
      />
      <ClientForm mode="create" />
    </>
  );
}
