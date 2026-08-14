"use client";

import { useState, useEffect, useCallback, useTransition } from "react";
import Link from "next/link";
import type { Route } from "next";
import { ChevronLeft, ChevronRight, Plus, X, CalendarDays } from "lucide-react";
import { createFollowUp } from "@/modules/followups/actions";
import { FollowUpItem, type CalendarItem } from "./FollowUpItem";

// ── date helpers ──────────────────────────────────────────────────────────────

function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
function startOfDay(d: Date): Date   { const c=new Date(d); c.setHours(0,0,0,0); return c; }
function startOfMonth(d: Date): Date { return new Date(d.getFullYear(), d.getMonth(), 1); }
function endOfMonth(d: Date): Date   { return new Date(d.getFullYear(), d.getMonth()+1, 0); }
function startOfWeek(d: Date): Date  { const c=new Date(d); c.setDate(d.getDate()-d.getDay()); return startOfDay(c); }
function addDays(d: Date, n: number): Date { const c=new Date(d); c.setDate(c.getDate()+n); return c; }
function addMonths(d: Date, n: number): Date { return new Date(d.getFullYear(), d.getMonth()+n, 1); }
function sameDay(a: Date, b: Date): boolean { return iso(a) === iso(b); }

function buildMonthGrid(anchor: Date): Date[] {
  const first = startOfMonth(anchor);
  const start = addDays(first, -first.getDay());
  return Array.from({ length: 42 }, (_, i) => addDays(start, i));
}
function buildWeek(anchor: Date): Date[] {
  const s = startOfWeek(anchor);
  return Array.from({ length: 7 }, (_, i) => addDays(s, i));
}

type View = "month" | "week" | "day";
interface Lead { id: string; name: string; mobile: string; }

const DAY_ABBR = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

// ── CalendarView ──────────────────────────────────────────────────────────────

export function CalendarView() {
  const today = startOfDay(new Date());
  const [view, setView]       = useState<View>("month");
  const [anchor, setAnchor]   = useState<Date>(startOfMonth(today));
  const [selected, setSelected] = useState<Date>(today);
  const [items, setItems]     = useState<CalendarItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [leads, setLeads]     = useState<Lead[]>([]);
  const [createForm, setCreateForm] = useState({ leadId:"", time:"10:00", note:"" });
  const [createError, setCreateError] = useState<string|null>(null);
  const [, startTx] = useTransition();

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchItems = useCallback(async () => {
    let from: string, to: string;
    if (view === "month") {
      from = iso(startOfMonth(anchor)); to = iso(endOfMonth(anchor));
    } else if (view === "week") {
      const ws = startOfWeek(anchor);
      from = iso(ws); to = iso(addDays(ws, 6));
    } else {
      from = iso(selected); to = iso(selected);
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/schedule/upcoming?from=${from}&to=${to}`);
      const data = await res.json() as { rows: CalendarItem[] };
      setItems(data.rows);
    } catch { /* silent */ }
    setLoading(false);
  }, [view, anchor, selected]);

  useEffect(() => { void fetchItems(); }, [fetchItems]);

  // ── Item map ────────────────────────────────────────────────────────────────
  const byDay = new Map<string, CalendarItem[]>();
  for (const it of items) {
    const k = it.dueAt.slice(0,10);
    if (!byDay.has(k)) byDay.set(k, []);
    byDay.get(k)!.push(it);
  }
  const selectedItems = byDay.get(iso(selected)) ?? [];

  // ── Navigation ──────────────────────────────────────────────────────────────
  function navLabel(): string {
    if (view === "month") return anchor.toLocaleDateString("en-IN", { month:"long", year:"numeric" });
    if (view === "week") {
      const s = startOfWeek(anchor); const e = addDays(s,6);
      return `${s.getDate()} – ${e.getDate()} ${e.toLocaleDateString("en-IN", { month:"short" })}`;
    }
    return selected.toLocaleDateString("en-IN", { weekday:"long", day:"numeric", month:"long", year:"numeric" });
  }

  function navPrev() {
    if (view==="month") setAnchor(a=>addMonths(a,-1));
    else if (view==="week") setAnchor(a=>addDays(a,-7));
    else { const d=addDays(selected,-1); setSelected(d); setAnchor(d); }
  }
  function navNext() {
    if (view==="month") setAnchor(a=>addMonths(a,1));
    else if (view==="week") setAnchor(a=>addDays(a,7));
    else { const d=addDays(selected,1); setSelected(d); setAnchor(d); }
  }
  function goToday() {
    setSelected(today);
    setAnchor(view==="month" ? startOfMonth(today) : view==="week" ? startOfWeek(today) : today);
  }

  // ── Create ─────────────────────────────────────────────────────────────────
  async function openCreate() {
    setCreating(true); setCreateError(null);
    if (leads.length === 0) {
      const res = await fetch("/api/leads/open");
      const data = await res.json() as { rows: Lead[] };
      setLeads(data.rows);
    }
  }

  function submitCreate(e: React.FormEvent) {
    e.preventDefault(); setCreateError(null);
    if (!createForm.leadId) { setCreateError("Select a lead to attach this follow-up"); return; }
    startTx(async () => {
      const dueAt = `${iso(selected)}T${createForm.time}:00`;
      const res = await createFollowUp({ leadId: createForm.leadId, dueAt, note: createForm.note });
      if (!res.ok) { setCreateError(res.error ?? "Could not schedule follow-up"); return; }
      setCreating(false); setCreateForm({ leadId:"", time:"10:00", note:"" });
      void fetchItems();
    });
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  const btnBase = "h-[34px] px-3.5 rounded-[7px] text-[12px] font-medium transition-colors";

  return (
    <div className="space-y-4 pb-10">
      {/* ── Toolbar ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3 justify-between">
        {/* View tabs */}
        <div className="flex items-center gap-0.5 bg-surface-2 rounded-[8px] p-0.5 border border-rule">
          {(["month","week","day"] as View[]).map(v => (
            <button key={v} type="button" onClick={() => {
              setView(v);
              if (v==="week") setAnchor(startOfWeek(selected));
              if (v==="month") setAnchor(startOfMonth(selected));
            }} className={["h-[28px] px-3.5 rounded-[6px] text-[12px] font-medium capitalize transition-colors",
              view===v ? "bg-surface text-text shadow-sm border border-rule" : "text-text-dim hover:text-text",
            ].join(" ")}>
              {v}
            </button>
          ))}
        </div>

        {/* Nav */}
        <div className="flex items-center gap-2">
          <button type="button" onClick={navPrev}
                  className="h-[34px] w-[34px] grid place-items-center rounded-[7px] bg-surface border border-rule text-text-dim hover:text-text hover:bg-surface-hover transition-colors">
            <ChevronLeft size={15} />
          </button>
          <span className="text-[13.5px] font-semibold text-text min-w-[200px] text-center">{navLabel()}</span>
          <button type="button" onClick={navNext}
                  className="h-[34px] w-[34px] grid place-items-center rounded-[7px] bg-surface border border-rule text-text-dim hover:text-text hover:bg-surface-hover transition-colors">
            <ChevronRight size={15} />
          </button>
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-2">
          <button type="button" onClick={goToday}
                  className={`${btnBase} bg-surface border border-rule text-text-dim hover:text-text hover:bg-surface-hover`}>
            Today
          </button>
          <button type="button" onClick={openCreate}
                  className={`${btnBase} bg-accent text-white hover:bg-accent-hover flex items-center gap-1.5`}>
            <Plus size={13} strokeWidth={2.2} /> New follow-up
          </button>
        </div>
      </div>

      {/* ── Month view ──────────────────────────────────────────────────────── */}
      {view === "month" && (
        <div className="rounded-[14px] bg-surface border border-rule overflow-hidden">
          {/* Day-of-week header */}
          <div className="grid grid-cols-7 border-b border-rule">
            {DAY_ABBR.map(d => (
              <div key={d} className="h-9 flex items-center justify-center text-[10.5px] uppercase tracking-[0.14em] text-text-dim">
                {d}
              </div>
            ))}
          </div>
          {/* Grid cells */}
          <div className="grid grid-cols-7 divide-x divide-rule border-b border-rule">
            {buildMonthGrid(anchor).map(d => {
              const inMonth = d.getMonth() === anchor.getMonth();
              const isToday = sameDay(d,today);
              const isSel   = sameDay(d,selected);
              const dayItems = byDay.get(iso(d)) ?? [];
              const overdue  = dayItems.some(i=>i.status==="OVERDUE");
              return (
                <button key={d.toISOString()} type="button" onClick={() => setSelected(new Date(d))}
                        className={["relative min-h-[72px] p-1.5 text-left transition-colors border-b border-rule",
                          isSel  ? "bg-accent/8 ring-1 ring-inset ring-accent/40" : "hover:bg-surface-hover",
                          !inMonth && "opacity-40",
                        ].filter(Boolean).join(" ")}>
                  <span className={["text-[12px] tabular w-6 h-6 rounded-full inline-flex items-center justify-center",
                    isSel  ? "bg-accent text-white font-semibold" :
                    isToday? "text-accent font-semibold" : "text-text-dim",
                  ].join(" ")}>{d.getDate()}</span>
                  {/* Item pills */}
                  <div className="mt-0.5 space-y-0.5">
                    {dayItems.slice(0,2).map(it => (
                      <div key={it.id} className={["text-[10px] truncate rounded-[3px] px-1 py-0.5 leading-tight",
                        it.status==="OVERDUE"   ? "bg-fault/15 text-fault" :
                        it.status==="COMPLETED" ? "bg-good/12 text-good" :
                                                  "bg-accent/12 text-accent",
                      ].join(" ")}>{it.refLabel}</div>
                    ))}
                    {dayItems.length > 2 && (
                      <div className={`text-[9.5px] ${overdue ? "text-fault" : "text-text-dim"}`}>
                        +{dayItems.length-2} more
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
          {/* Day detail panel */}
          <DayDetail day={selected} items={selectedItems} loading={loading} onRefresh={fetchItems} />
        </div>
      )}

      {/* ── Week view ───────────────────────────────────────────────────────── */}
      {view === "week" && (
        <div className="rounded-[14px] bg-surface border border-rule overflow-hidden divide-y divide-rule">
          {buildWeek(anchor).map(d => {
            const dayItems = byDay.get(iso(d)) ?? [];
            const isToday  = sameDay(d,today);
            return (
              <div key={d.toISOString()}>
                <div className={["flex items-center gap-3 px-5 py-2.5 border-b border-rule/60",
                  isToday ? "bg-accent/5" : "",
                ].join(" ")}>
                  <span className={["text-[11px] uppercase tracking-[0.12em] font-semibold w-8",
                    isToday ? "text-accent" : "text-text-dim",
                  ].join(" ")}>{d.toLocaleDateString("en-IN",{weekday:"short"})}</span>
                  <span className={["text-[13px] tabular", isToday ? "text-accent font-semibold" : "text-text"].join(" ")}>
                    {d.toLocaleDateString("en-IN",{day:"numeric",month:"short"})}
                  </span>
                  <span className="text-[11px] text-text-faint">
                    {dayItems.length === 0 ? "No follow-ups" : `${dayItems.length} follow-up${dayItems.length===1?"":"s"}`}
                  </span>
                </div>
                {dayItems.length > 0 && dayItems.map(it => (
                  <FollowUpItem key={it.id} item={it} onRescheduled={fetchItems} />
                ))}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Day view ────────────────────────────────────────────────────────── */}
      {view === "day" && (
        <div className="rounded-[14px] bg-surface border border-rule overflow-hidden">
          <DayDetail day={selected} items={selectedItems} loading={loading} onRefresh={fetchItems} />
        </div>
      )}

      {/* ── Create form ─────────────────────────────────────────────────────── */}
      {creating && (
        <div className="rounded-[14px] bg-surface border border-rule p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="text-[13px] font-semibold text-text">
              New Follow-up · {selected.toLocaleDateString("en-IN",{day:"numeric",month:"short",year:"numeric"})}
            </div>
            <button type="button" onClick={() => setCreating(false)}
                    className="text-text-dim hover:text-text transition-colors">
              <X size={14} />
            </button>
          </div>
          <form onSubmit={submitCreate} className="space-y-3">
            <label className="block">
              <div className="mb-1 text-[10.5px] uppercase tracking-[0.12em] text-text-dim">Lead *</div>
              <select value={createForm.leadId} onChange={e => setCreateForm(f => ({...f, leadId: e.target.value}))}
                      className="w-full h-[34px] px-2.5 bg-surface border border-rule rounded-[7px] text-[12.5px] text-text outline-none focus:border-accent">
                <option value="">— select a lead —</option>
                {leads.map(l => <option key={l.id} value={l.id}>{l.name} · {l.mobile}</option>)}
              </select>
            </label>
            <div className="flex gap-3">
              <label className="flex-1 block">
                <div className="mb-1 text-[10.5px] uppercase tracking-[0.12em] text-text-dim">Date</div>
                <input type="date" value={iso(selected)} onChange={e => { const d=new Date(e.target.value); if(!isNaN(d.getTime())) setSelected(d); }}
                       className="w-full h-[34px] px-2.5 bg-surface border border-rule rounded-[7px] text-[12.5px] tabular outline-none focus:border-accent" />
              </label>
              <label className="w-[130px] block">
                <div className="mb-1 text-[10.5px] uppercase tracking-[0.12em] text-text-dim">Time</div>
                <input type="time" value={createForm.time} onChange={e => setCreateForm(f => ({...f, time: e.target.value}))}
                       className="w-full h-[34px] px-2.5 bg-surface border border-rule rounded-[7px] text-[12.5px] tabular outline-none focus:border-accent" />
              </label>
            </div>
            <label className="block">
              <div className="mb-1 text-[10.5px] uppercase tracking-[0.12em] text-text-dim">Note</div>
              <input value={createForm.note} onChange={e => setCreateForm(f => ({...f, note: e.target.value}))}
                     placeholder="What's this follow-up about?" maxLength={300}
                     className="w-full h-[34px] px-2.5 bg-surface border border-rule rounded-[7px] text-[12.5px] outline-none focus:border-accent" />
            </label>
            {createError && <div className="text-[11.5px] text-fault">{createError}</div>}
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => setCreating(false)}
                      className="h-8 px-3 text-[12px] text-text-dim hover:text-text transition-colors">Cancel</button>
              <button type="submit"
                      className="h-8 px-4 bg-accent text-white text-[12px] font-medium rounded-[7px] hover:bg-accent-hover transition-colors">
                Schedule
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── All follow-ups link ─────────────────────────────────────────────── */}
      <div className="text-right">
        <Link href={"/followups" as Route} className="text-[12px] text-text-dim hover:text-accent transition-colors">
          All follow-ups →
        </Link>
      </div>
    </div>
  );
}

// ── DayDetail ─────────────────────────────────────────────────────────────────

function DayDetail({ day, items, loading, onRefresh }: {
  day: Date; items: CalendarItem[]; loading: boolean; onRefresh: () => void;
}) {
  const isToday = sameDay(day, startOfDay(new Date()));
  return (
    <div>
      <div className="flex items-center justify-between px-5 py-3 border-t border-rule/60">
        <div className="text-[12px] font-semibold text-text">
          {isToday && <span className="text-accent mr-1.5">Today ·</span>}
          {day.toLocaleDateString("en-IN",{ weekday:"long", day:"numeric", month:"long" })}
        </div>
        <span className="text-[11px] text-text-faint">
          {loading ? "Loading…" : `${items.length} follow-up${items.length===1?"":"s"}`}
        </span>
      </div>
      {!loading && items.length === 0 && (
        <div className="px-5 pb-5 flex flex-col items-center py-8 text-center gap-2">
          <CalendarDays size={28} strokeWidth={1.25} className="text-text-faint" />
          <p className="text-[12.5px] text-text-dim">Nothing scheduled for this day.</p>
        </div>
      )}
      {items.map(it => <FollowUpItem key={it.id} item={it} onRescheduled={onRefresh} />)}
    </div>
  );
}
