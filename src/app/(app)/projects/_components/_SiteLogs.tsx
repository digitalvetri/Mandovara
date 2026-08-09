"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { addSiteLog } from "@/modules/projects/actions";
import type { ProjectSiteLog } from "@/modules/projects/queries";

function iso(d: Date): string { return d.toISOString().slice(0, 10); }
function fmt(d: Date): string {
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", timeZone: "Asia/Kolkata" });
}

export function SiteLogs({ projectId, logs }: { projectId: string; logs: ProjectSiteLog[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [summary, setSummary] = useState("");
  const [weather, setWeather] = useState("");
  const [manpower, setManpower] = useState("");
  const [loggedAt, setLoggedAt] = useState(iso(new Date()));

  function addOne(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      await addSiteLog({
        projectId, summary, weather, loggedAt,
        ...(manpower !== "" && { manpowerCount: Number(manpower) }),
      });
      setSummary(""); setWeather(""); setManpower(""); setOpen(false);
      router.refresh();
    });
  }

  return (
    <div className="rounded-[14px] bg-surface border border-rule">
      <div className="px-4 py-3 border-b border-rule flex items-center justify-between">
        <div className="text-[10.5px] uppercase tracking-[0.16em] text-text-dim">
          Site logs ({logs.length})
        </div>
        <button type="button" onClick={() => setOpen(!open)}
                className="inline-flex items-center gap-1.5 h-[28px] px-3 rounded-[6px] text-[11.5px] text-text-dim hover:text-text hover:bg-surface-hover transition-colors">
          <Plus size={12} /> Add log
        </button>
      </div>
      {open && (
        <form onSubmit={addOne} className="px-4 py-3 border-b border-rule space-y-2">
          <div className="flex items-end gap-2">
            <div>
              <div className="mb-1 text-[10.5px] uppercase tracking-[0.06em] text-text-dim">Date</div>
              <input type="date" value={loggedAt} onChange={(e) => setLoggedAt(e.target.value)}
                     className="h-[30px] px-2 bg-white/60 border border-rule rounded-[6px] text-[12.5px] tabular outline-none focus:border-accent" />
            </div>
            <div>
              <div className="mb-1 text-[10.5px] uppercase tracking-[0.06em] text-text-dim">Weather</div>
              <input value={weather} onChange={(e) => setWeather(e.target.value)} placeholder="e.g. Rainy"
                     className="h-[30px] w-[130px] px-2 bg-white/60 border border-rule rounded-[6px] text-[12.5px] outline-none focus:border-accent" />
            </div>
            <div>
              <div className="mb-1 text-[10.5px] uppercase tracking-[0.06em] text-text-dim">Manpower</div>
              <input inputMode="numeric" value={manpower} onChange={(e) => setManpower(e.target.value)}
                     className="h-[30px] w-[90px] px-2 bg-white/60 border border-rule rounded-[6px] text-[12.5px] tabular outline-none focus:border-accent" />
            </div>
          </div>
          <div>
            <div className="mb-1 text-[10.5px] uppercase tracking-[0.06em] text-text-dim">Summary</div>
            <textarea rows={2} value={summary} onChange={(e) => setSummary(e.target.value)}
                      placeholder="What happened at site today?"
                      className="w-full px-2 py-1.5 bg-white/60 border border-rule rounded-[6px] text-[12.5px] outline-none focus:border-accent" />
          </div>
          <div className="flex justify-end">
            <button type="submit" disabled={pending || !summary}
                    className="h-[30px] px-3 rounded-[6px] bg-accent text-white text-[11.5px] font-medium disabled:opacity-60">
              Add log
            </button>
          </div>
        </form>
      )}
      {logs.length === 0 ? (
        <div className="py-8 text-center text-[12px] text-text-faint">No site logs yet.</div>
      ) : (
        <ol className="divide-y divide-rule/60">
          {logs.map((l) => (
            <li key={l.id} className="px-4 py-3">
              <div className="text-[11px] text-text-dim tabular flex items-center gap-3">
                <span>{fmt(l.loggedAt)}</span>
                {l.weather && <span>· {l.weather}</span>}
                {l.manpowerCount != null && <span>· {l.manpowerCount} on site</span>}
              </div>
              <div className="mt-1 text-[12.5px] text-text">{l.summary}</div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
