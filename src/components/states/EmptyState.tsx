import type { ReactNode } from "react";

// Copy pattern (BUILD-SPEC §6.7):
// "No quotations yet. Quotations you create from a lead will appear here.
//  → Create quotation"
// Never apologise. Always name the next action.

interface EmptyStateProps {
  title: string;
  description: string;
  action?: ReactNode;
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-8 text-center">
      <div className="text-[16px] font-medium text-paper">{title}</div>
      <p className="mt-2 max-w-[440px] text-[13px] text-paper-dim">{description}</p>
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}
