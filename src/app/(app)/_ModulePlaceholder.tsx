import { PrimaryButton, Topbar } from "@/components/layout/Topbar";

interface ModulePlaceholderProps {
  title: string;
  session: string;
  description: string;
}

export function ModulePlaceholder({ title, session, description }: ModulePlaceholderProps) {
  return (
    <>
      <Topbar
        title={title}
        eyebrow={`Coming in ${session}`}
        actions={<PrimaryButton>New</PrimaryButton>}
      />
      <div className="rounded-[14px] bg-surface border border-rule p-16 text-center">
        <div className="max-w-[520px] mx-auto">
          <div className="text-[16px] font-medium text-text mb-2">{title}</div>
          <p className="text-[13px] text-text-dim">{description}</p>
          <p className="mt-6 text-[11px] text-text-faint">
            The kernel (Sessions 1–6) is complete. This module screen lands in <span className="text-text-dim">{session}</span>.
          </p>
        </div>
      </div>
    </>
  );
}
