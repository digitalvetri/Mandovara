import { Topbar } from "@/components/layout/Topbar";
import { NewArchitectForm } from "../_components/NewArchitectForm";

export const dynamic = "force-dynamic";

export default function NewArchitectPage() {
  return (
    <>
      <Topbar title="New architect" eyebrow="Referral partner — commission stamps on their clients' orders" />
      <div className="max-w-[600px]">
        <NewArchitectForm />
      </div>
    </>
  );
}
