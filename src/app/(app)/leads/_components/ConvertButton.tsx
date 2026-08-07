"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { convertLead } from "@/modules/leads/actions";

interface Props {
  id: string;
  status: string;
  convertedClientId: string | null;
}

export function ConvertButton({ id, status, convertedClientId }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (convertedClientId) {
    return (
      <Link
        href={`/clients/${convertedClientId}` as Route}
        className="h-[30px] inline-flex items-center px-3 rounded-[6px] bg-accent/12 text-accent text-[11.5px] font-medium hover:bg-accent/20 transition-colors"
      >
        Open client →
      </Link>
    );
  }

  if (status === "LOST") return null;

  function onClick() {
    setError(null);
    startTransition(async () => {
      const res = await convertLead({ id });
      if (!res.ok || !res.data) {
        setError(res.error ?? "Could not convert lead");
        return;
      }
      router.push(`/clients/${res.data.clientId}` as Route);
      router.refresh();
    });
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={onClick}
        disabled={pending}
        className="h-[30px] px-3 rounded-[6px] bg-accent text-white text-[11.5px] font-medium hover:bg-accent-hover disabled:opacity-60 transition-colors"
      >
        {pending ? "Converting…" : "Convert to client"}
      </button>
      {error && <div className="text-[11.5px] text-bad">{error}</div>}
    </div>
  );
}
