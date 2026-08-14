"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { Phone, MessageCircle, ArrowUpRight, Briefcase } from "lucide-react";
import { formatINR } from "@/kernel/money/format";
import type { ClientRow } from "@/modules/clients/queries";

const TYPE_LABEL: Record<string, string> = {
  HOMEOWNER: "Homeowner", ARCHITECT: "Architect",
  INTERIOR_DESIGNER: "Interior Designer", BUILDER: "Builder",
  COMMERCIAL: "Commercial", GOVERNMENT: "Government", DEALER: "Dealer",
};

const TYPE_STYLE: Record<string, string> = {
  HOMEOWNER:         "bg-accent/10 text-accent",
  ARCHITECT:         "bg-gold/15 text-gold",
  INTERIOR_DESIGNER: "bg-info/12 text-info",
  BUILDER:           "bg-heat/12 text-heat",
  COMMERCIAL:        "bg-good/12 text-good",
  GOVERNMENT:        "bg-text-dim/12 text-text-dim",
  DEALER:            "bg-warn/12 text-warn",
};

const STAGE_LABEL: Record<string, string> = {
  ENQUIRY: "Enquiry", MEASUREMENT: "Measurement", QUOTATION: "Quotation",
  ORDERED: "Ordered", PROCUREMENT: "Procurement", MAKE: "Make",
  INSTALLATION: "Installation", SNAGGING: "Snagging",
  COMPLETED: "Completed", CANCELLED: "Cancelled",
};

const STAGE_CLS: Record<string, string> = {
  ENQUIRY: "text-accent", MEASUREMENT: "text-warn", QUOTATION: "text-info",
  ORDERED: "text-good", PROCUREMENT: "text-warn", MAKE: "text-warn",
  INSTALLATION: "text-good", SNAGGING: "text-heat",
  COMPLETED: "text-solid", CANCELLED: "text-text-faint",
};

function fmtMobile(m: string): string {
  const d = m.replace(/^\+91/, "").replace(/\D/g, "");
  return d.length === 10 ? `${d.slice(0, 5)} ${d.slice(5)}` : m.replace("+91", "");
}

function waHref(mobile: string): string {
  const d = mobile.replace(/\D/g, "");
  const num = d.startsWith("91") && d.length === 12 ? d : `91${d.slice(-10)}`;
  return `https://wa.me/${num}`;
}

function Sep() {
  return <span className="text-text-faint/60 select-none">·</span>;
}

export function ClientsTable({ rows }: { rows: ClientRow[] }) {
  const router = useRouter();

  if (rows.length === 0) {
    return (
      <div className="rounded-[14px] bg-surface border border-rule py-16 text-center">
        <div className="text-[14px] text-text mb-2">No clients yet.</div>
        <p className="text-[12px] text-text-dim">
          Add your first client to start building the 360° view. →{" "}
          <Link href={"/clients/new" as Route} className="text-accent hover:underline">
            New client
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-[14px] border border-rule overflow-hidden divide-y divide-rule/50">
      {rows.map((r) => {
        const typeStyle  = TYPE_STYLE[r.type] ?? "bg-text-dim/12 text-text-dim";
        const typeLabel  = TYPE_LABEL[r.type] ?? r.type;
        const proj       = r.latestProject;
        const stageLabel = proj ? (STAGE_LABEL[proj.stage] ?? proj.stage) : null;
        const stageCls   = proj ? (STAGE_CLS[proj.stage] ?? "text-text-dim") : "";
        const initial    = proj?.ownerName && proj.ownerName !== "—"
          ? proj.ownerName.charAt(0).toUpperCase() : null;

        return (
          <div
            key={r.id}
            onClick={() => router.push(`/clients/${r.id}` as Route)}
            className="flex items-center gap-5 px-5 py-[18px] bg-surface hover:bg-surface-hover transition-colors cursor-pointer"
          >
            {/* ── Identity ─────────────────────────────────────── */}
            <div className="flex-1 min-w-0">

              {/* Name · Type · Project count */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[14px] font-semibold text-text leading-snug">{r.name}</span>
                <span className={`text-[10.5px] font-medium tracking-[0.06em] uppercase px-2 py-0.5 rounded-[3px] ${typeStyle}`}>
                  {typeLabel}
                </span>
                {r.projectCount > 0 && (
                  <span className="flex items-center gap-1 text-[10.5px] text-text-dim bg-surface-2 border border-rule px-2 py-0.5 rounded-[3px]">
                    <Briefcase size={9} strokeWidth={2} />
                    {r.projectCount} {r.projectCount === 1 ? "project" : "projects"}
                  </span>
                )}
              </div>

              {/* Mobile · Email · City */}
              <div className="flex items-center gap-2 mt-1 text-[12px] text-text-dim leading-tight flex-wrap">
                <span className="font-data tabular tracking-tight">{fmtMobile(r.mobile)}</span>
                {r.email && (
                  <>
                    <Sep />
                    <span className="truncate max-w-[180px]">{r.email}</span>
                  </>
                )}
                {r.city && (
                  <>
                    <Sep />
                    <span>{r.city}</span>
                  </>
                )}
              </div>

              {/* Latest project strip */}
              {proj && (
                <div className="flex items-center gap-2 mt-1.5 text-[11.5px] text-text-dim flex-wrap">
                  <span className="font-medium text-text truncate max-w-[200px]">{proj.name}</span>
                  {stageLabel && (
                    <span className={`text-[10px] font-semibold uppercase tracking-[0.07em] ${stageCls}`}>
                      {stageLabel}
                    </span>
                  )}
                  {proj.orderValue > 0n && (
                    <>
                      <Sep />
                      <span className="tabular font-data text-[11px]">{formatINR(proj.orderValue)}</span>
                    </>
                  )}
                  {proj.ownerName && proj.ownerName !== "—" && (
                    <>
                      <Sep />
                      <span>{proj.ownerName}</span>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* ── Owner avatar ─────────────────────────────────── */}
            {initial && (
              <div className="hidden sm:flex items-center gap-2 shrink-0">
                <span className="w-[26px] h-[26px] rounded-full bg-accent/15 text-accent text-[10px] font-bold flex items-center justify-center uppercase select-none">
                  {initial}
                </span>
                <span className="text-[12px] text-text-dim hidden lg:block whitespace-nowrap max-w-[110px] truncate">
                  {proj?.ownerName}
                </span>
              </div>
            )}

            {/* ── Actions ──────────────────────────────────────── */}
            <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
              <a
                href={`tel:${r.mobile}`}
                title={`Call ${r.name}`}
                className="w-8 h-8 rounded-full flex items-center justify-center text-text-dim hover:text-text hover:bg-surface-2 transition-colors"
              >
                <Phone size={13} strokeWidth={1.75} />
              </a>
              <a
                href={waHref(r.mobile)}
                target="_blank"
                rel="noreferrer noopener"
                title={`WhatsApp ${r.name}`}
                className="w-8 h-8 rounded-full flex items-center justify-center text-text-dim hover:text-[#25D366] hover:bg-surface-2 transition-colors"
              >
                <MessageCircle size={13} strokeWidth={1.75} />
              </a>
              <Link
                href={`/clients/${r.id}` as Route}
                onClick={(e) => e.stopPropagation()}
                className="ml-1.5 h-8 px-3 rounded-[7px] text-[12px] font-medium border border-rule text-text-dim hover:text-text hover:border-accent/40 hover:bg-surface-2 transition-colors flex items-center gap-1"
              >
                View
                <ArrowUpRight size={12} strokeWidth={2} />
              </Link>
            </div>
          </div>
        );
      })}
    </div>
  );
}
