"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition, useState } from "react";
import type { Route } from "next";
import {
  CalendarPlus, MapPin, FileText,
  UserCheck, ArrowUpRight, Loader2,
} from "lucide-react";
import { changeLeadStage } from "@/modules/leads/actions";
import { ConvertLeadModal } from "./ConvertLeadModal";

interface Props {
  leadId: string;
  stage: string;
  convertedClientId: string | null;
  convertedProjectId: string | null;
  leadName: string;
  mobile: string;
  email: string | null;
}

export function LeadActionBar({ leadId, stage, convertedClientId, convertedProjectId, leadName, mobile, email }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showConvertModal, setShowConvertModal] = useState(false);

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
    // Already-converted → go straight to the client-scoped builder.
    if (convertedClientId) {
      router.push(`/quotations/quick?client=${convertedClientId}` as Route);
      return;
    }
    // Not-yet-converted lead → open the builder in LEAD-SCOPED mode.
    // FIXES-01 §5.1: no more silent conversion on quote. The lead stays
    // a lead until the client accepts + owner approves via the explicit
    // Convert-to-Client action. The quotation carries leadId only.
    router.push(`/quotations/quick?leadId=${leadId}` as Route);
  }

  return (
    <div className="mb-6">
      <div className="flex flex-wrap gap-2">

        {/* Follow-up — scrolls to the follow-up form */}
        <a href="#follow-up" className={btn("neutral")}>
          <CalendarPlus size={14} strokeWidth={1.75} />
          Follow-up
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

        {/* Quick Quote — opens the builder in either client-scoped
            (isConverted) or lead-scoped mode. Lead-scoped quotes leave
            the lead as a lead; conversion is now a separate step. */}
        {!isLost && (
          <button
            type="button"
            onClick={doQuickQuote}
            disabled={busy}
            className={btn("accent")}
            title={isConverted
              ? "Open the Quick Quote builder for this client"
              : "Draft a preliminary quote against this lead — no client/project created yet"}
          >
            {pendingAction === "quote"
              ? <Loader2 size={14} className="animate-spin" />
              : <FileText size={14} strokeWidth={1.75} />}
            Quick Quote
          </button>
        )}

        {/* Convert to Client (unconverted) or Open Client/Project (already converted) */}
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
            onClick={() => setShowConvertModal(true)}
            disabled={busy}
            className={btn("good")}
          >
            <UserCheck size={14} strokeWidth={1.75} />
            Convert to Client
          </button>
        ) : null}

      </div>

      {error && (
        <p className="mt-2 text-[12px] text-bad">{error}</p>
      )}

      <ConvertLeadModal
        leadId={leadId}
        leadName={leadName}
        mobile={mobile}
        email={email}
        open={showConvertModal}
        onClose={() => setShowConvertModal(false)}
      />
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
