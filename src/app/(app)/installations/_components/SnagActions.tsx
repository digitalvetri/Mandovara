"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { postSnag, setSnagStatus } from "@/modules/installations/actions";
import { SNAG_STATUSES, type SnagStatus } from "@/modules/installations/schema";
import type { ProjectPickerRow } from "@/modules/installations/queries";

const STATUS_LABEL: Record<SnagStatus, string> = {
  OPEN: "Open", IN_PROGRESS: "In progress", RESOLVED: "Resolved", CLOSED: "Closed",
};
const STATUS_TONE: Record<string, string> = {
  OPEN:        "bg-bad/12 text-bad",
  IN_PROGRESS: "bg-warn/15 text-warn",
  RESOLVED:    "bg-good/12 text-good",
  CLOSED:      "bg-good/15 text-good",
};

export function SnagStatusChanger({ id, current }: { id: string; current: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  // Optimistic local value — reflects the user's pick immediately, and only
  // reverts if the server refuses. Also stays in sync when the parent
  // re-fetches after a successful update.
  const [value, setValue] = useState<string>(current);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { setValue(current); }, [current]);

  function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const to = e.target.value;
    if (to === value) return;
    setError(null);
    setValue(to); // optimistic
    startTransition(async () => {
      const res = await setSnagStatus({ id, status: to });
      if (!res.ok) {
        setValue(current);                              // revert
        setError(res.error ?? "Could not update status");
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="inline-flex flex-col items-end gap-0.5">
      <select
        value={value}
        onChange={onChange}
        disabled={pending}
        className={`h-[24px] px-1.5 text-[10.5px] tracking-[0.06em] uppercase font-medium rounded-[3px] border-0 outline-none focus:ring-1 focus:ring-accent ${STATUS_TONE[value] ?? "bg-text-dim/12 text-text-dim"}`}
      >
        {SNAG_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
      </select>
      {error && <div className="text-[10px] text-bad max-w-[180px] text-right leading-tight">{error}</div>}
    </div>
  );
}

export function PostSnagButton({ projects }: { projects: ProjectPickerRow[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [projectId, setProjectId] = useState<string>(projects[0]?.id ?? "");
  const [location, setLocation] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  function commit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await postSnag({ projectId, location, description });
      if (!res.ok) { setError(res.error ?? "Could not post snag"); return; }
      setLocation(""); setDescription(""); setOpen(false);
      router.refresh();
    });
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)}
              disabled={projects.length === 0}
              className="inline-flex items-center gap-1.5 h-[30px] px-3 rounded-[8px] bg-accent text-white text-[12px] font-medium hover:bg-accent-hover disabled:opacity-40 transition-colors">
        <Plus size={12} /> Post snag
      </button>
    );
  }

  return (
    <form onSubmit={commit} className="w-[520px] rounded-[8px] border border-rule bg-surface p-3 shadow-lg">
      <div className="mb-2">
        <div className="mb-1 text-[10.5px] uppercase tracking-[0.06em] text-text-dim">Project</div>
        <select value={projectId} onChange={(e) => setProjectId(e.target.value)}
                className="w-full h-[30px] px-2 bg-white/60 border border-rule rounded-[6px] text-[12.5px] outline-none focus:border-accent">
          {projects.map((p) => (
            <option key={p.id} value={p.id}>{p.number} — {p.name}</option>
          ))}
        </select>
      </div>
      <div className="mb-2">
        <div className="mb-1 text-[10.5px] uppercase tracking-[0.06em] text-text-dim">Location</div>
        <input value={location} onChange={(e) => setLocation(e.target.value)}
               placeholder="e.g. Kitchen — north wall cabinet"
               className="w-full h-[30px] px-2 bg-white/60 border border-rule rounded-[6px] text-[12.5px] outline-none focus:border-accent" />
      </div>
      <div className="mb-3">
        <div className="mb-1 text-[10.5px] uppercase tracking-[0.06em] text-text-dim">Description</div>
        <textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)}
                  placeholder="What's the issue?"
                  className="w-full px-2 py-1.5 bg-white/60 border border-rule rounded-[6px] text-[12.5px] outline-none focus:border-accent" />
      </div>
      {error && <div className="mb-2 text-[11.5px] text-bad">{error}</div>}
      <div className="flex items-center justify-end gap-2">
        <button type="button" onClick={() => setOpen(false)}
                className="h-[28px] px-3 text-[11.5px] text-text-dim hover:text-text">
          Cancel
        </button>
        <button type="submit" disabled={pending || !projectId || !location || !description}
                className="h-[28px] px-3 rounded-[6px] bg-accent text-white text-[11.5px] font-medium disabled:opacity-40">
          {pending ? "Saving…" : "Post snag"}
        </button>
      </div>
    </form>
  );
}
