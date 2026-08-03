import { Topbar } from "@/components/layout/Topbar";
import { VendorForm } from "../_components/VendorForm";

export const dynamic = "force-dynamic";

export default function NewVendorPage() {
  return (
    <>
      <Topbar title="New vendor" eyebrow="Add supplier once; use across POs, GRNs and payments." />
      <VendorForm mode="create" />
    </>
  );
}
