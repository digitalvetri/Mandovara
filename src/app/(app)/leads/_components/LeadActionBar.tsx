"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition, useState } from "react";
import type { Route } from "next";
import {
  CalendarPlus, StickyNote, MapPin, FileText,
  Paperclip, UserCheck, ArrowUpRight, Loader2,
} from "lucide-react";
import { changeLeadStage, convertLead } from "@/modules/leads/actions";

interface Props {
  leadId: string;
  stage: string;
  convertedClientId: string | null;
  convertedProjectId: string | null;
}

export function LeadActionBar({ leadId, stage, convertedClientId, convertedProjectId }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isConverted = convertedClientId != null;
  const isLost = stage === "LOST";
  const isSiteVisit = stage === "VISIT_SCHEDULED";
  const busy = pendingAction !== null;

  function doSiteVisit() {
    if (isSiteVisit || busy) return;
    setError(null);
    setPendingAction("siteVisit");
    startTransition(async () => {
      const res = await changeLeadStage({ id: leadId, to: "VISIT_SCHEDULED" });
      if (!res.ok) setError(res.error ?? "Could not update stage");
      else router.refresh();
      setPendingAction(null);
    });
  }

  function doQuickQuote() {
    if (busy) return;
    if (convertedProjectId) {
      router.push(`/quotations/new?project=${convertedProjectId}` as Route);
      return;
    }
    setError(null);
    setPendingAction("quote");
    startTransition(async () => {
      const res = await convertLead({ id: leadId });
      if (!res.ok || !res.data) {
        setError(res.error ?? "Could not prepare quote");
        setPendingAction(null);
        return;
      }
      const dest = res.data.projectId
        ? `/quotations/new?project=${res.data.projectId}`
        : "/quotations/new";
      router.push(dest as Route);
    });
  }

  function doConvert() {
    if (busy) return;
    setError(null);
    setPendingAction("convert");
    startTransition(async () => {
      const res = await convertLead({ id: leadId });
      if (!res.ok || !res.data) {
        setError(res.error ?? "Could not convert lead");
        setPendingAction(null);
        return;
      }
      const dest = res.data.projectId
        ? `/projects/${res.data.projectId}`
        : `/clients/${res.data.clientId}`;
      router.push(dest as Route);
    });
  }

  return (
    <div className="mb-6">
      <div className="flex flex-wrap gap-2">

        {/* Follow-up — scrolls to the follow-up form */}
        <a href="#follow-up" className={btn("neutral")}>
          <CalendarPlus size={14} strokeWidth={1.75} />
          Follow-up
        </a>

        {/* Activity — logs a note in the same follow-up section */}
        <a href="#follow-up" className={btn("neutral")}>
          <StickyNote size={14} strokeWidth={1.75} />
          Activity
        </a>

        {/* Site Visit — changes stage to VISIT_SCHEDULED */}
        {!isConverted && !isLost && (
          <button
            type="button"
            onClick={doSiteVisit}
            disabled={busy || isSiteVisit}
            className={btn(isSiteVisit ? "active-warn" : "neutral")}
          >
            {pendingAction === "siteVisit"
              ? <Loader2 size={14} className="animate-spin" />
              : <MapPin size={14} strokeWidth={1.75} />}
            {isSiteVisit ? "Site Visit Set" : "Site Visit"}
          </button>
        )}

        {/* Quick Quote — navigates to quotation builder; converts lead first if needed */}
        {!isLost && (
          <button
            type="button"
            onClick={doQuickQuote}
            disabled={busy}
            className={btn("accent")}
          >
            {pendingAction === "quote"
              ? <Loader2 size={14} className="animate-spin" />
              : <FileText size={14} strokeWidth={1.75} />}
            Quick Quote
          </button>
        )}

        {/* Documents — scrolls to the documents section */}
        <a href="#documents" className={btn("neutral")}>
          <Paperclip size={14} strokeWidth={1.75} />
          Documents
        </a>

        {/* Convert to Client (unconverted) or Open Project (already converted) */}
        {isConverted ? (
          <Link
            href={(convertedProjectId
              ? `/projects/${convertedProjectId}`
              : `/clients/${convertedClientId}`) as Route}
            className={btn("good")}
          >
            <ArrowUpRight size={14} strokeWidth={1.75} />
            {convertedProjectId ? "Open Project" : "Open Client"}
          </Link>
        ) : !isLost ? (
          <button
            type="button"
            onClick={doConvert}
            disabled={busy}
            className={btn("good")}
          >
            {pendingAction === "convert"
              ? <Loader2 size={14} className="animate-spin" />
              : <UserCheck size={14} strokeWidth={1.75} />}
            Convert to Client
          </button>
        ) : null}

      </div>

      {error && (
        <p className="mt-2 text-[12px] text-bad">{error}</p>
      )}
    </div>
  );
}

const BASE =
  "inline-flex items-center gap-2 h-9 px-4 rounded-[8px] text-[12.5px] font-medium border transition-colors disabled:opacity-50 cursor-pointer select-none whitespace-nowrap";

function btn(tone: "neutral" | "accent" | "good" | "active-warn"): string {
  switch (tone) {
    case "accent":
      return `${BASE} bg-accent/8 text-accent border-accent/25 hover:bg-accent/15 hover:border-accent/40`;
    case "good":
      return `${BASE} bg-good/8 text-good border-good/25 hover:bg-good/15 hover:border-good/40`;
    case "active-warn":
      return `${BASE} bg-warn/10 text-warn border-warn/30 cursor-default`;
    default:
      return `${BASE} bg-surface-2 text-text-dim border-rule hover:bg-surface-hover hover:text-text`;
  }
}
