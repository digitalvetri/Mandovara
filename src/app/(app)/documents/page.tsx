import { FolderOpen } from "lucide-react";
import { Topbar } from "@/components/layout/Topbar";

export const dynamic = "force-dynamic";

export default function DocumentsPage() {
  return (
    <>
      <Topbar title="Documents" />

      <div className="flex flex-col items-center justify-center py-28 text-center">
        <div className="h-16 w-16 rounded-[16px] border border-border bg-surface-2 flex items-center justify-center mb-5">
          <FolderOpen size={28} strokeWidth={1.2} className="text-text-muted opacity-60" />
        </div>
        <h2 className="font-display text-[20px] font-semibold text-text mb-2">
          Documents
        </h2>
        <p className="text-[13.5px] text-text-muted max-w-sm leading-relaxed">
          Your payslips, ID documents, and project sign-off sheets will appear here.
          This module is coming in a future update.
        </p>
      </div>
    </>
  );
}
