"use client";

import { CheckCircle2 } from "lucide-react";

interface CompletedVisit {
  number: string;
  completedAt: Date | null;
  project: { name: string };
}

export function InstallCompleted({ visit }: { visit: CompletedVisit }) {
  return (
    <div className="min-h-screen bg-[#F8F7F4] flex flex-col items-center justify-center p-6 text-center">
      <CheckCircle2 size={56} className="text-green-600 mb-4" strokeWidth={1.5} />
      <h1 className="text-[22px] font-semibold text-gray-900 mb-2">Visit Complete</h1>
      <p className="text-[14px] text-gray-600">{visit.project.name}</p>
      {visit.completedAt && (
        <p className="text-[12px] text-gray-400 mt-3">
          {new Date(visit.completedAt).toLocaleString("en-IN")}
        </p>
      )}
    </div>
  );
}
