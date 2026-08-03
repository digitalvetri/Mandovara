import type { ReactNode } from "react";

// Copy pattern (BUILD-SPEC §6.7):
// "Could not save invoice. Number MDV/26-27/0412 is already used.
//  Refresh to get the next number."
// Directions, not apologies. Never "Something went wrong."

interface ErrorStateProps {
  title: string;
  description: string;
  action?: ReactNode;
}

export function ErrorState({ title, description, action }: ErrorStateProps) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center justify-center py-16 px-8 text-center"
    >
      <div className="text-[16px] font-medium text-alarm">{title}</div>
      <p className="mt-2 max-w-[440px] text-[13px] text-paper-dim">{description}</p>
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}
