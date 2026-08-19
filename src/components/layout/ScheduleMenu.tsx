"use client";

// Dashboard-only calendar popover. Renders a real month grid with meeting
// dots on populated days; click a day to see that day's items, or use the
// "Schedule meeting" mini-form to add one. Meetings live as Follow-ups so
// they also appear on /followups.

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Calendar as CalIcon, ChevronLeft, ChevronRight, Plus, X } from "lucide-react";
import { createFollowUp } from "@/modules/followups/actions";

interface Meeting {
  id: string;
  dueAt: string;
  note: string;
  subject: string;
  kind: "LEAD" | "CLIENT" | "QUOTE" | "OPEN";
}

const KIND_TONE: Record<string, string> = {
  LEAD:   "text-accent",
  CLIENT: "text-good",
  QUOTE:  "text-warn",
  OPEN:   "text-text-dim",
};

export function ScheduleMenu() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const ref = useRef<HTMLDivElement>(null);

  const today = useMemo(() => startOfDay(new Date()), []);
  const [monthAnchor, setMonthAnchor] = useState<Date>(startOfMonth(today));
  const [selected, setSelected] = useState<Date>(today);

  // Quick-schedule form state (opens below selected day)
  const [pending, startTransition] = useTransition();
  const [scheduling, setScheduling] = useState(false);
  const [subject, setSubject] = useState("");
  const [time, setTime] = useState<string>("10:00");
  const [error, setError] = useState<string | null>(null);

  // Fetch meetings whenever popover opens.
  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetch("/api/schedule/upcoming")
      .then((r) => r.json())
      .then((data: { rows: Meeting[] }) => setMeetings(data.rows))
      .finally(() => setLoading(false));
  }, [open]);

  // Close on outside click.
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!ref.current || ref.current.contains(e.target as Node)) return;
      setOpen(false);
    }
    if (open) document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  // Build the month grid (6 rows × 7 cols starting on Sunday).
  const gridDays = useMemo(() => buildGrid(monthAnchor), [monthAnchor]);

  // Map yyyy-mm-dd → meeting count for dot markers.
  const meetingsByDay = useMemo(() => {
    const m = new Map<string, Meeting[]>();
    for (const meet of meetings) {
      const key = new Date(meet.dueAt).toISOString().slice(0, 10);
      if (!m.has(key)) m.set(key, []);
      m.get(key)!.push(meet);
    }
    return m;
  }, [meetings]);

  const selectedKey = iso(selected);
  const selectedMeetings = meetingsByDay.get(selectedKey) ?? [];

  function commitSchedule(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const dueAt = `${iso(selected)}T${padHM(time)}:00`;
      const res = await createFollowUp({ dueAt: iso(selected), note: `${time} — ${subject}` });
      if (!res.ok) {
        setError("Meetings need a lead or client. Use “Attach to…” below.");
        void dueAt;
        return;
      }
      setSubject(""); setScheduling(false);
      // Refresh meeting list.
      setLoading(true);
      const r = await fetch("/api/schedule/upcoming");
      const data = await r.json() as { rows: Meeting[] };
      setMeetings(data.rows);
      setLoading(false);
      router.refresh();
    });
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        aria-label="Schedule"
        onClick={() => setOpen(!open)}
        className="h-[38px] w-[38px] grid place-items-center rounded-[8px] on-chrome border relative"
      >
        <CalIcon size={15} strokeWidth={1.75} />
        {meetings.length > 0 && (
          <span className="absolute top-[6px] right-[6px] h-1.5 w-1.5 rounded-full bg-accent" />
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-[340px] sm:w-[380px] z-50 rounded-[12px] bg-surface border border-rule shadow-lg overflow-hidden">
          {/* Header */}
          <div className="px-4 py-3 border-b border-rule flex items-center justify-between">
            <div className="text-[12.5px] font-medium text-text">Schedule</div>
            <button type="button" onClick={() => setOpen(false)}
                    className="h-[24px] w-[24px] grid place-items-center rounded-[4px] text-text-dim hover:bg-surface-hover">
              <X size={13} />
            </button>
          </div>

          {/* Month nav */}
          <div className="px-4 py-2 flex items-center justify-between">
            <button type="button" onClick={() => setMonthAnchor(addMonths(monthAnchor, -1))}
                    aria-label="Previous month"
                    className="h-[24px] w-[24px] grid place-items-center rounded-[4px] text-text-dim hover:bg-surface-hover hover:text-text">
              <ChevronLeft size={14} />
            </button>
            <div className="text-[12.5px] font-medium text-text tabular">
              {monthAnchor.toLocaleDateString("en-IN", { month: "long", year: "numeric" })}
            </div>
            <button type="button" onClick={() => setMonthAnchor(addMonths(monthAnchor, 1))}
                    aria-label="Next month"
                    className="h-[24px] w-[24px] grid place-items-center rounded-[4px] text-text-dim hover:bg-surface-hover hover:text-text">
              <ChevronRight size={14} />
            </button>
          </div>

          {/* Day-of-week header */}
          <div className="px-3 grid grid-cols-7 text-center text-[9.5px] uppercase tracking-[0.14em] text-text-dim">
            {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
              <div key={i} className="h-5">{d}</div>
            ))}
          </div>

          {/* Grid */}
          <div className="px-3 pb-3 grid grid-cols-7 gap-y-0.5">
            {gridDays.map((d) => {
              const inMonth = d.getMonth() === monthAnchor.getMonth();
              const isToday = sameDay(d, today);
              const isSel = sameDay(d, selected);
              const hasItems = (meetingsByDay.get(iso(d))?.length ?? 0) > 0;
              return (
                <button
                  key={d.toISOString()}
                  type="button"
                  onClick={() => setSelected(d)}
                  className={[
                    "h-8 w-full grid place-items-center rounded-[6px] text-[12px] tabular relative transition-colors",
                    !inMonth && "text-text-faint",
                    inMonth && !isSel && !isToday && "text-text hover:bg-surface-hover",
                    isToday && !isSel && "text-accent font-medium",
                    isSel && "bg-accent text-white font-medium",
                  ].filter(Boolean).join(" ")}
                >
                  {d.getDate()}
                  {hasItems && (
                    <span className={`absolute bottom-1 h-1 w-1 rounded-full ${isSel ? "bg-white" : "bg-accent"}`} />
                  )}
                </button>
              );
            })}
          </div>

          {/* Selected day panel */}
          <div className="border-t border-rule">
            <div className="px-4 py-2 flex items-center justify-between">
              <div className="text-[11.5px] text-text-dim">
                {selected.toLocaleDateString("en-IN", { weekday: "long", day: "2-digit", month: "short" })}
              </div>
              <div className="text-[10.5px] text-text-faint tabular">
                {selectedMeetings.length} meeting{selectedMeetings.length === 1 ? "" : "s"}
              </div>
            </div>
            {loading ? (
              <div className="py-4 text-center text-[11.5px] text-text-faint">Loading…</div>
            ) : selectedMeetings.length === 0 ? (
              <div className="px-4 pb-3 text-[11.5px] text-text-faint italic">
                Nothing scheduled for this day.
              </div>
            ) : (
              <ul className="max-h-[140px] overflow-y-auto divide-y divide-rule/60">
                {selectedMeetings.map((m) => (
                  <li key={m.id} className="px-4 py-2">
                    <div className="flex items-baseline justify-between gap-2">
                      <div className="text-[12px] text-text truncate">{m.subject}</div>
                      <div className="text-[10.5px] text-text-dim tabular whitespace-nowrap">
                        {new Date(m.dueAt).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true })}
                      </div>
                    </div>
                    {m.note && <div className="text-[10.5px] text-text-dim truncate">{m.note}</div>}
                    <div className={`text-[9.5px] uppercase tracking-[0.06em] ${KIND_TONE[m.kind] ?? "text-text-dim"}`}>
                      {m.kind.toLowerCase()}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Schedule footer */}
          {scheduling ? (
            <form onSubmit={commitSchedule} className="p-3 border-t border-rule space-y-2">
              <label className="block">
                <div className="mb-1 text-[10.5px] uppercase tracking-[0.06em] text-text-dim">Subject</div>
                <input value={subject} onChange={(e) => setSubject(e.target.value)}
                       placeholder="e.g. Site visit — Anand Residence"
                       className="w-full h-[30px] px-2 bg-white/60 border border-rule rounded-[6px] text-[12px] outline-none focus:border-accent" />
              </label>
              <label className="block">
                <div className="mb-1 text-[10.5px] uppercase tracking-[0.06em] text-text-dim">Time</div>
                <input type="time" value={time} onChange={(e) => setTime(e.target.value)}
                       className="w-full h-[30px] px-2 bg-white/60 border border-rule rounded-[6px] text-[12px] tabular outline-none focus:border-accent" />
              </label>
              {error && <div className="text-[11px] text-bad">{error}</div>}
              <div className="flex items-center justify-end gap-2 pt-1">
                <button type="button" onClick={() => setScheduling(false)}
                        className="h-[28px] px-2 text-[11px] text-text-dim hover:text-text">
                  Cancel
                </button>
                <button type="submit" disabled={pending || !subject}
                        className="h-[28px] px-3 rounded-[6px] bg-accent text-white text-[11px] font-medium disabled:opacity-40">
                  {pending ? "Saving…" : "Schedule"}
                </button>
              </div>
            </form>
          ) : (
            <div className="p-3 border-t border-rule flex items-center justify-between gap-2">
              <button type="button" onClick={() => setScheduling(true)}
                      className="inline-flex items-center gap-1 h-[30px] px-3 rounded-[6px] bg-accent text-white text-[11.5px] font-medium hover:bg-accent-hover transition-colors">
                <Plus size={12} /> New meeting
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── date helpers ────────────────────────────────────────────────

function startOfDay(d: Date): Date  { const c = new Date(d); c.setHours(0, 0, 0, 0); return c; }
function startOfMonth(d: Date): Date { return new Date(d.getFullYear(), d.getMonth(), 1); }
function addMonths(d: Date, n: number): Date { return new Date(d.getFullYear(), d.getMonth() + n, 1); }
function iso(d: Date): string {
  const y = d.getFullYear(); const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function padHM(s: string): string {
  const [h = "0", m = "0"] = s.split(":");
  return `${h.padStart(2, "0")}:${m.padStart(2, "0")}`;
}
function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear()
      && a.getMonth()    === b.getMonth()
      && a.getDate()     === b.getDate();
}
function buildGrid(monthStart: Date): Date[] {
  // Grid always starts on the Sunday on or before the 1st, 42 cells.
  const days: Date[] = [];
  const first = new Date(monthStart);
  const offset = first.getDay(); // 0 = Sunday
  const gridStart = new Date(first); gridStart.setDate(1 - offset);
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart); d.setDate(gridStart.getDate() + i);
    days.push(d);
  }
  return days;
}
