"use client";

// Automation rules panel — right sidebar on the Follow-up Management page.
// Real rules from the AutomationRule table. Toggle enables/disables via
// the same action used on the WhatsApp page.

import Link from "next/link";
import type { Route } from "next";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { toggleAutomationRule } from "@/modules/whatsapp/actions";
import type { AutomationRuleRow } from "@/modules/followups/queries";

export function AutomationPanel({ rules }: { rules: AutomationRuleRow[] }) {
  return (
    <aside className="rounded-[14px] bg-surface border border-rule p-5 sm:p-6 h-fit">
      <div className="font-display text-[18px] font-semibold text-text">Automation rules</div>
      <p className="mt-1 text-[11.5px] text-text-dim">
        {rules.length === 0
          ? "No rules yet. Rules turn a signal (overdue, unanswered, below stock) into a follow-up automatically."
          : "Nothing sits idle. Rules trigger reminders & escalations."}
      </p>

      {rules.length === 0 ? (
        <div className="mt-4">
          <Link
            href={"/whatsapp" as Route}
            className="inline-flex items-center gap-1.5 h-[32px] px-3 rounded-[8px] border border-accent text-accent text-[11.5px] font-medium hover:bg-accent/10 transition-colors"
          >
            <Plus size={12} /> Configure rules
          </Link>
        </div>
      ) : (
        <ul className="mt-4 space-y-3">
          {rules.map((r) => <RuleCard key={r.id} rule={r} />)}
        </ul>
      )}
    </aside>
  );
}

function RuleCard({ rule }: { rule: AutomationRuleRow }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  function flip() {
    startTransition(async () => {
      await toggleAutomationRule({ id: rule.id, enabled: !rule.active });
      router.refresh();
    });
  }
  return (
    <li className="rounded-[10px] bg-bg/60 border border-rule/60 p-3">
      <div className="text-[12px] text-text leading-snug">{rule.name}</div>
      <div className="mt-2 flex items-center gap-1.5 text-[10.5px] text-text-dim">
        <span className={`h-1.5 w-1.5 rounded-full ${rule.active ? "bg-good" : "bg-rule"}`} />
        <span>{rule.active ? "Active" : "Paused"}</span>
        <span className="mx-1">·</span>
        <span className="tabular">{rule.cadence}</span>
        <button
          type="button"
          onClick={flip}
          disabled={pending}
          className="ml-auto text-[10.5px] text-text-dim hover:text-accent"
        >
          {rule.active ? "Pause" : "Resume"}
        </button>
      </div>
    </li>
  );
}
