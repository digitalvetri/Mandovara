import { Topbar } from "@/components/layout/Topbar";
import { MessageCircle } from "lucide-react";
import { devContext } from "@/lib/dev-context";
import { loadWhatsApp } from "@/modules/whatsapp/queries";
import { AddRuleForm } from "./_components/AddRuleForm";
import { RuleToggle } from "./_components/RuleToggle";

export const dynamic = "force-dynamic";

export default async function WhatsAppPage() {
  const ctx = await devContext();
  const w = await loadWhatsApp(ctx);

  return (
    <>
      <Topbar
        title="WhatsApp Automation"
        eyebrow="Official Meta Cloud API · verified business number"
      />

      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-4">
        <Kpi label="Sent today" value={w.sentToday} />
        <Kpi label="Delivered"  value={w.delivered} />
        <Kpi label="Read"       value={w.read} />
        <Kpi label="Templates"  value={w.templateCount} />
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 rounded-[14px] bg-surface border border-rule p-5 sm:p-6">
          <div className="flex items-baseline justify-between mb-4 gap-3 flex-wrap">
            <div className="font-display text-[18px] font-semibold">Automation rules</div>
            <span className="text-[10.5px] uppercase tracking-[0.06em] px-2 py-0.5 rounded-[3px] bg-good/12 text-good">
              Meta Cloud API
            </span>
          </div>

          {w.rules.length === 0 ? (
            <div className="py-6 text-center text-[12px] text-text-faint">
              No rules yet. Add one so events like a new lead, dispatched order,
              or overdue invoice trigger the right message automatically.
            </div>
          ) : (
            <ul className="divide-y divide-rule/60">
              {w.rules.map((r) => (
                <li key={r.id} className="py-3 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="text-[13px] text-text">{r.name}</div>
                    <div className="text-[11px] text-text-dim">{r.trigger} · {r.action}</div>
                  </div>
                  <RuleToggle id={r.id} enabled={r.active} />
                </li>
              ))}
            </ul>
          )}

          <div className="mt-3">
            <AddRuleForm />
          </div>

          <div className="mt-6 pt-4 border-t border-rule">
            <div className="text-[10.5px] uppercase tracking-[0.16em] text-text-dim mb-3">
              Message templates
            </div>
            {w.templates.length === 0 ? (
              <div className="text-[12px] text-text-faint">
                No templates yet. Add one and submit it to Meta for approval before sending.
              </div>
            ) : (
              <div className="flex flex-wrap gap-x-6 gap-y-2 text-[12.5px]">
                {w.templates.map((t) => (
                  <div key={t.id} className="flex items-center gap-2">
                    <span className="tabular text-text">{t.name}</span>
                    <span className={`text-[10.5px] uppercase tracking-[0.06em] ${t.approved ? "text-good" : "text-warn"}`}>
                      {t.approved ? "Approved" : "Pending"}
                    </span>
                    <span className="text-[10.5px] text-text-faint">· {t.language}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="rounded-[14px] bg-surface border border-rule p-5 sm:p-6 h-fit">
          <div className="font-display text-[18px] font-semibold mb-4">Inbox</div>
          {w.inbox.length === 0 ? (
            <div className="text-[12px] text-text-faint py-4 text-center">
              No incoming messages yet.
            </div>
          ) : (
            <ul className="space-y-4">
              {w.inbox.map((m) => (
                <li key={m.id} className="flex items-start gap-3 pb-4 border-b border-rule/60 last:border-0 last:pb-0">
                  <div className="mt-0.5 h-9 w-9 rounded-full bg-good/12 grid place-items-center text-good shrink-0">
                    <MessageCircle size={16} strokeWidth={1.75} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between gap-2">
                      <div className="text-[12.5px] text-text truncate">{m.contact}</div>
                      <div className="text-[10.5px] text-text-dim tabular shrink-0">{m.when}</div>
                    </div>
                    <div className="text-[11.5px] text-text-dim truncate">{m.body}</div>
                    {m.serviceWindowMins != null ? (
                      <div className="mt-0.5 text-[10.5px] text-good font-medium tabular-nums">
                        Free window: {fmtWindow(m.serviceWindowMins)}
                      </div>
                    ) : (
                      <div className="mt-0.5 text-[10.5px] text-text-faint">Window closed</div>
                    )}
                  </div>
                  {m.unread > 0 && (
                    <span className="tabular text-[11px] font-medium h-[20px] min-w-[20px] px-1.5 rounded-full bg-accent text-white grid place-items-center shrink-0">
                      {m.unread}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </>
  );
}

function fmtWindow(mins: number): string {
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function Kpi({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[14px] bg-surface border border-rule p-4 sm:p-5">
      <div className="text-[10.5px] uppercase tracking-[0.16em] text-text-dim">{label}</div>
      <div className="mt-2 sm:mt-3 font-display text-[28px] sm:text-[36px] font-semibold text-text tabular-nums leading-none">{value}</div>
    </div>
  );
}
