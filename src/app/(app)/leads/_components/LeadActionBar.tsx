"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Route } from "next";
import {
  CalendarPlus, MapPin, FileText,
  UserCheck, ArrowUpRight,
} from "lucide-react";
import { ConvertLeadModal } from "./ConvertLeadModal";
import { ScheduleVisitModal } from "./ScheduleVisitModal";
import { DeleteLeadAction } from "./DeleteLeadAction";

interface Props {
  leadId: string;
  stage: string;
  convertedClientId: string | null;
  convertedProjectId: string | null;
  leadName: string;
  mobile: string;
  email: string | null;
  // When quotes exist under the lead, the ConversionApprovalCard is the
  // sanctioned conversion path (needs client-accepted + owner-approved).
  // Hide the free-form Convert button here to remove the duplicate CTA.
  hasQuotes?: boolean;
  canDelete?: boolean;
  /**
   * True when the lead has an APPROVED, non-superseded measurement round.
   * A measured lead gets a FIRM quotation built from its own measured
   * items; an unmeasured one still gets the rough ballpark estimate
   * (owner decision, 2026-08-27 — the two-quote model now turns on
   * whether we've measured, not on whether a client record exists).
   */
  isMeasured?: boolean;
}

export function LeadActionBar({ leadId, stage, convertedClientId, convertedProjectId, leadName, mobile, email, hasQuotes, canDelete, isMeasured }: Props) {
  const router = useRouter();
  const [showConvertModal, setShowConvertModal] = useState(false);
  const [showVisitModal, setShowVisitModal] = useState(false);

  const isConverted = convertedClientId != null;
  const isLost = stage === "LOST";

  function doQuickQuote() {
    // Already-converted → go straight to the client-scoped builder.
    if (convertedClientId) {
      router.push(`/quotations/quick?client=${convertedClientId}` as Route);
      return;
    }
    // Not-yet-converted lead → open the builder in LEAD-SCOPED mode.
    // FIXES-01 §5.1: no more silent conversion on quote. The lead stays
    // a lead until the CLIENT accepts and the owner approves, via the
    // explicit Convert-to-Client action. The quotation carries leadId only.
    //
    // Measured leads go to the firm builder, which preloads a line per
    // approved measurement item with its computed quantity. Unmeasured
    // leads get the quick builder — there is nothing to price precisely.
    router.push((isMeasured
      ? `/quotations/new?lead=${leadId}`
      : `/quotations/quick?leadId=${leadId}`) as Route);
  }

  return (
    <div className="mb-6">
      <div className="flex flex-wrap gap-2">

        {/* Follow-up — scrolls to the follow-up form */}
        <a href="#follow-up" className={btn("neutral")}>
          <CalendarPlus size={14} strokeWidth={1.75} />
          Follow-up
        </a>

        {/* Site Visit — opens scheduling modal */}
        {!isConverted && !isLost && (
          <button
            type="button"
            onClick={() => setShowVisitModal(true)}
            className={btn("neutral")}
          >
            <MapPin size={14} strokeWidth={1.75} />
            Site Visit
          </button>
        )}

        {/* Rough Estimate — pre-measurement, ballpark price sent while
            the client is still shopping around. The Firm Quotation
            happens later on the project page after a real site
            measurement (§ two-quote model). */}
        {!isLost && (
          <button
            type="button"
            onClick={doQuickQuote}
            className={btn("accent")}
            title={isConverted
              ? "Send a rough (pre-measurement) estimate for this client"
              : isMeasured
                ? "Build a firm quotation from this lead's approved measurements"
                : "Send a rough estimate — no measurement yet, no client/project created"}
          >
            <FileText size={14} strokeWidth={1.75} />
            {!isConverted && isMeasured ? "Build Firm Quotation" : "Send Rough Estimate"}
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
        ) : !isLost && !hasQuotes ? (
          // No quotes yet — allow free-form conversion. Once a quote exists,
          // ConversionApprovalCard becomes the single sanctioned path.
          <button
            type="button"
            onClick={() => setShowConvertModal(true)}
            className={btn("good")}
          >
            <UserCheck size={14} strokeWidth={1.75} />
            Convert to Client
          </button>
        ) : null}

        {/* Delete — server refuses converted leads, but we still hide
            the button for them so the danger action isn't a red herring. */}
        {canDelete && !isConverted && (
          <DeleteLeadAction leadId={leadId} leadName={leadName} />
        )}

      </div>

      <ConvertLeadModal
        leadId={leadId}
        leadName={leadName}
        mobile={mobile}
        email={email}
        open={showConvertModal}
        onClose={() => setShowConvertModal(false)}
      />

      <ScheduleVisitModal
        open={showVisitModal}
        onClose={() => setShowVisitModal(false)}
        leadId={leadId}
        stage={stage}
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
