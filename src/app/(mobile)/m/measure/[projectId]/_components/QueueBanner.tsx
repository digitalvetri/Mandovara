"use client";

// Persistent strip at the bottom of the field PWA. Shows the outbox
// depth and toggles between "Working offline — N queued" and
// "N synced" as `navigator.onLine` and the drain summary change.
//
// Polls the outbox every 3s while there are queued rows so the count
// updates without waiting for a state change — cheap since the query
// hits IndexedDB, not the network.

import { useEffect, useState } from "react";
import { CircleDashed, CloudUpload, WifiOff } from "lucide-react";
import { countPending, listConflicts } from "@/lib/measure-outbox";
import type { DrainSummary } from "@/lib/measure-drain";

interface QueueBannerProps {
  projectId: string;
  drain:     DrainSummary | null;
}

export function QueueBanner({ projectId, drain }: QueueBannerProps) {
  const [pending, setPending]     = useState(0);
  const [conflicts, setConflicts] = useState(0);
  const [online, setOnline]       = useState(true);

  useEffect(() => {
    setOnline(typeof navigator !== "undefined" ? navigator.onLine : true);
    const onOnline  = (): void => setOnline(true);
    const onOffline = (): void => setOnline(false);
    window.addEventListener("online",  onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online",  onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function refresh(): Promise<void> {
      const [p, c] = await Promise.all([countPending(projectId), listConflicts(projectId)]);
      if (cancelled) return;
      setPending(p);
      setConflicts(c.length);
    }
    void refresh();
    const iv = window.setInterval(refresh, 3000);
    return () => { cancelled = true; window.clearInterval(iv); };
  }, [projectId, drain]);

  const label = !online
    ? `Working offline — ${pending} queued`
    : pending > 0
      ? `Syncing — ${pending} queued`
      : "All synced";
  const tone = !online
    ? "bg-heat/10 text-heat border-heat/30"
    : pending > 0
      ? "bg-info/10 text-info border-info/30"
      : "bg-solid-tint text-solid-strong border-solid/30";
  const Icon = !online ? WifiOff : pending > 0 ? CircleDashed : CloudUpload;

  return (
    <div className={`fixed bottom-0 inset-x-0 z-30 border-t px-3 py-2 backdrop-blur-sm flex items-center gap-2 ${tone}`}>
      <Icon size={14} className={pending > 0 && online ? "animate-pulse" : undefined} />
      <div className="text-[11.5px] tabular">{label}</div>
      {conflicts > 0 && (
        <div className="ml-auto text-[11px] text-fault">
          {conflicts} conflict{conflicts === 1 ? "" : "s"} · review later
        </div>
      )}
    </div>
  );
}
