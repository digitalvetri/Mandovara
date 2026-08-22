"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import {
  Phone, MessageCircle, ArrowUpRight, Briefcase,
  PencilLine, BellPlus, FolderPlus, Trash2, Users,
} from "lucide-react";
import type { ClientRow } from "@/modules/clients/queries";
import { deleteClient } from "@/modules/clients/actions";
import { MoreMenu, type MenuItem } from "@/components/data/MoreMenu";

const TYPE_LABEL: Record<string, string> = {
  HOMEOWNER:         "Homeowner",
  ARCHITECT:         "Architect",
  INTERIOR_DESIGNER: "Interior Designer",
  BUILDER:           "Builder",
  COMMERCIAL:        "Commercial",
  GOVERNMENT:        "Government",
  DEALER:            "Dealer",
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

const TYPE_STRIP: Record<string, string> = {
  HOMEOWNER:         "bg-accent",
  ARCHITECT:         "bg-gold",
  INTERIOR_DESIGNER: "bg-info",
  BUILDER:           "bg-heat",
  COMMERCIAL:        "bg-good",
  GOVERNMENT:        "bg-text-dim",
  DEALER:            "bg-warn",
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

function clientMenuItems(r: ClientRow): MenuItem[] {
  const confirmMsg = r.projectCount > 0
    ? `This client has ${r.projectCount} project${r.projectCount > 1 ? "s" : ""} and cannot be deleted.`
    : "Permanently delete this client? This cannot be undone.";
  return [
    { key: "edit",     label: "Edit",          icon: PencilLine, href: `/clients/${r.id}/edit` },
    { key: "followup", label: "Add Follow-up",  icon: BellPlus,   href: `/clients/${r.id}` },
    { key: "project",  label: "New Project",    icon: FolderPlus, href: `/projects/new?clientId=${r.id}` },
    {
      key: "delete", label: "Delete Client", icon: Trash2,
      danger: true, separator: true, confirm: confirmMsg,
      onClick: r.projectCount > 0 ? undefined : () => void deleteClient(r.id),
    },
  ];
}

export function ClientsTable({ rows }: { rows: ClientRow[] }) {
  const router = useRouter();

  if (rows.length === 0) {
    return (
      <div className="rounded-[14px] bg-surface border border-rule py-16 text-center">
        <Users size={28} className="mx-auto mb-3 text-text-faint" />
        <div className="text-[14px] text-text mb-1">No clients found.</div>
        <p className="text-[12px] text-text-dim">
          <Link href={"/clients/new" as Route} className="text-accent hover:underline">
            Add a client
          </Link>{" "}
          to start building the 360° view.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-[12px] border border-rule bg-surface overflow-hidden">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="border-b border-rule bg-surface-2">
            <th className="w-[5px] p-0" aria-hidden />
            <th className="py-3 pl-4 pr-3 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-text-dim">
              Client
            </th>
            <th className="py-3 px-4 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-text-dim hidden sm:table-cell">
              Mobile
            </th>
            <th className="py-3 px-4 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-text-dim hidden lg:table-cell">
              City
            </th>
            <th className="py-3 px-4 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-text-dim hidden md:table-cell">
              Projects
            </th>
            <th className="py-3 px-4 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-text-dim hidden xl:table-cell">
              Owner
            </th>
            <th className="py-3 pl-4 pr-4 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-text-dim text-right">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-rule">
          {rows.map((r) => {
            const typeStyle = TYPE_STYLE[r.type] ?? "bg-text-dim/12 text-text-dim";
            const typeLabel = TYPE_LABEL[r.type] ?? r.type;
            const strip     = TYPE_STRIP[r.type] ?? "bg-text-dim";
            const proj      = r.latestProject;
            const initial   = proj?.ownerName && proj.ownerName !== "—"
              ? proj.ownerName.charAt(0).toUpperCase() : null;

            return (
              <tr
                key={r.id}
                onClick={() => router.push(`/clients/${r.id}` as Route)}
                className="group cursor-pointer transition-colors hover:bg-surface-2/60"
              >
                {/* Accent strip — td fills full row height in a table */}
                <td className={`w-[5px] p-0 ${strip}`} aria-hidden />

                {/* Name + type badge */}
                <td className="py-4 pl-4 pr-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[13.5px] font-semibold text-text leading-tight">
                      {r.name}
                    </span>
                    <span className={`text-[10px] font-medium tracking-[0.06em] uppercase px-1.5 py-0.5 rounded-[3px] ${typeStyle}`}>
                      {typeLabel}
                    </span>
                  </div>
                  {/* Compact sub-line on small screens where mobile col is hidden */}
                  <div className="flex items-center gap-1.5 mt-0.5 text-[11.5px] text-text-dim sm:hidden">
                    <span className="tabular">{fmtMobile(r.mobile)}</span>
                    {r.city && (
                      <>
                        <span className="text-text-faint">·</span>
                        <span>{r.city}</span>
                      </>
                    )}
                  </div>
                </td>

                {/* Mobile + quick-action icons */}
                <td
                  className="py-4 px-4 hidden sm:table-cell"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center gap-1">
                    <a
                      href={`tel:${r.mobile}`}
                      title={`Call ${r.name}`}
                      className="tabular text-[12.5px] text-text-dim hover:text-accent transition-colors"
                    >
                      {fmtMobile(r.mobile)}
                    </a>
                    <a
                      href={waHref(r.mobile)}
                      target="_blank"
                      rel="noreferrer noopener"
                      title="WhatsApp"
                      className="ml-1.5 w-6 h-6 rounded-full flex items-center justify-center text-text-faint hover:text-[#25D366] hover:bg-surface-2 transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <MessageCircle size={11} strokeWidth={1.75} />
                    </a>
                    <a
                      href={`tel:${r.mobile}`}
                      title="Call"
                      onClick={(e) => e.stopPropagation()}
                      className="w-6 h-6 rounded-full flex items-center justify-center text-text-faint hover:text-accent hover:bg-surface-2 transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <Phone size={11} strokeWidth={1.75} />
                    </a>
                  </div>
                </td>

                {/* City */}
                <td className="py-4 px-4 hidden lg:table-cell">
                  <span className="text-[12.5px] text-text-dim">{r.city || "—"}</span>
                </td>

                {/* Project count */}
                <td className="py-4 px-4 hidden md:table-cell">
                  {r.projectCount > 0 ? (
                    <span className="inline-flex items-center gap-1 text-[11px] text-text-dim bg-surface-2 border border-rule px-1.5 py-0.5 rounded-[3px]">
                      <Briefcase size={9} strokeWidth={2} />
                      {r.projectCount}
                    </span>
                  ) : (
                    <span className="text-[12px] text-text-faint">—</span>
                  )}
                </td>

                {/* Owner */}
                <td className="py-4 px-4 hidden xl:table-cell">
                  {initial ? (
                    <div className="flex items-center gap-1.5">
                      <span className="w-[22px] h-[22px] rounded-full bg-accent/15 text-accent text-[9px] font-bold flex items-center justify-center uppercase select-none shrink-0">
                        {initial}
                      </span>
                      <span className="text-[12px] text-text-dim truncate max-w-[90px]">
                        {proj?.ownerName}
                      </span>
                    </div>
                  ) : (
                    <span className="text-[12px] text-text-faint">—</span>
                  )}
                </td>

                {/* Actions */}
                <td
                  className="py-4 pl-4 pr-4"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center justify-end gap-1">
                    <Link
                      href={`/clients/${r.id}` as Route}
                      className="h-7 px-2.5 rounded-[7px] text-[12px] font-medium border border-rule text-text-dim hover:text-text hover:border-accent/40 hover:bg-surface-2 transition-colors flex items-center gap-1"
                    >
                      View
                      <ArrowUpRight size={11} strokeWidth={2} />
                    </Link>
                    <MoreMenu items={clientMenuItems(r)} />
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
