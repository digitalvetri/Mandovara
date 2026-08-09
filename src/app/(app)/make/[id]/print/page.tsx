// Printable cut sheet for the tailor. Deliberately plain — the
// tailor prints this on A4, staples it to the fabric, and walks
// away with it. No app shell, no navigation. Static columns:
// room · panels · cut length · lining · heading · eyelets · notes.
//
// The route lives under (app) which brings the Sidebar shell in via
// the layout — the print CSS below hides the shell for @media print
// so the paper output is clean.

import { notFound } from "next/navigation";
import { devContext } from "@/lib/dev-context";
import { getMakeJob } from "@/modules/make/queries";
import { formatDate } from "@/kernel/datetime";
import { PrintButton } from "./_components/PrintButton";

export const dynamic = "force-dynamic";

interface Props { params: Promise<{ id: string }> }

export default async function CutSheetPrintPage({ params }: Props) {
  const { id } = await params;
  const ctx = await devContext();
  const job = await getMakeJob(ctx, id);
  if (!job) notFound();

  const totalPanels = job.lines.reduce((n, l) => n + (l.panels ?? 0), 0);
  const totalFabricMm = job.lines.reduce(
    (n, l) => n + (l.panels ?? 0) * (l.cutLengthMm ?? 0), 0,
  );

  return (
    <>
      {/* Hide the sidebar chrome on paper. */}
      <style>{`
        @media print {
          html, body { background: #fff !important; }
          aside, [data-print-hide], header.topbar { display: none !important; }
          .print-only-shell { padding: 0 !important; margin: 0 !important; max-width: none !important; }
          .cut-sheet { border: none !important; }
        }
      `}</style>

      <div className="print-only-shell max-w-[820px] mx-auto py-6">
        {/* Force light-theme tokens for the paper card so text-text /
            text-text-dim / border-rule all resolve to dark-on-white
            regardless of the surrounding app theme. The `light` class
            is what ThemeToggle sets on <html>; we scope it locally so
            only the sheet flips, not the surrounding chrome. */}
        <div className="light cut-sheet rounded-[8px] border border-rule bg-white text-text p-8 print:p-4">
          {/* Letterhead */}
          <div className="flex items-start justify-between pb-4 border-b border-rule">
            <div>
              <div className="font-display text-[22px] font-semibold tracking-[0.02em]">
                MANDOVARA
              </div>
              <div className="text-[10.5px] text-text-dim mt-0.5">
                32 Thirumoorthy Layout, Thadagam Road, RS Puram, Coimbatore 641002
              </div>
            </div>
            <div className="text-right">
              <div className="text-[10px] uppercase tracking-[0.14em] text-text-dim">Cut Sheet</div>
              <div className="tabular text-[16px] font-medium mt-1">{job.number}</div>
            </div>
          </div>

          {/* Header table */}
          <div className="grid grid-cols-2 gap-x-8 gap-y-1 py-4 text-[12px]">
            <MetaRow k="Client"    v={job.clientName} />
            <MetaRow k="Order"     v={job.orderNumber} />
            <MetaRow k="Mobile"    v={job.clientMobile} />
            <MetaRow k="Status"    v={job.status.replace("_", " ")} />
            {job.targetDate && <MetaRow k="Target" v={formatDate(job.targetDate)} />}
            <MetaRow k="Issued"    v={formatDate(new Date())} />
          </div>

          {/* Cut list */}
          <table className="w-full text-[11.5px] border-t border-rule mt-2">
            <thead className="text-[9.5px] uppercase tracking-[0.10em] text-text-dim">
              <tr className="border-b border-rule">
                <Th align="left"   width={220}>Room / Item</Th>
                <Th align="right"  width={60}>Panels</Th>
                <Th align="right"  width={90}>Cut (mm)</Th>
                <Th align="right"  width={70}>Fabric m</Th>
                <Th align="right"  width={70}>Lining m</Th>
                <Th align="left"   width={100}>Heading</Th>
                <Th align="right"  width={60}>Eyelets</Th>
              </tr>
            </thead>
            <tbody>
              {job.lines.map((l) => (
                <tr key={l.id} className="border-b border-rule/60 align-top">
                  <Td align="left">
                    <div className="text-text">{l.roomLabel}</div>
                    <div className="text-[10.5px] text-text-dim">{l.productName}</div>
                  </Td>
                  <Td align="right" mono>{l.panels ?? "—"}</Td>
                  <Td align="right" mono>{l.cutLengthMm ?? "—"}</Td>
                  <Td align="right" mono>{l.fabricIssuedM ?? "—"}</Td>
                  <Td align="right" mono>{l.liningIssuedM ?? "—"}</Td>
                  <Td align="left">{l.headingType ?? "—"}</Td>
                  <Td align="right" mono>{l.eyeletCount ?? "—"}</Td>
                </tr>
              ))}
              <tr className="text-[11px]">
                <Td align="left"><b>Totals</b></Td>
                <Td align="right" mono><b>{totalPanels}</b></Td>
                <Td align="right" mono>—</Td>
                <Td align="right" mono>{(totalFabricMm / 1000).toFixed(2)} m</Td>
                <Td align="left">{""}</Td>
                <Td align="left">{""}</Td>
                <Td align="left">{""}</Td>
              </tr>
            </tbody>
          </table>

          {/* Sign-off strip — the tailor initials on completion */}
          <div className="grid grid-cols-3 gap-8 pt-8 mt-6 text-[10.5px] text-text-dim">
            <SignoffBox label="Cut by" />
            <SignoffBox label="Stitched by" />
            <SignoffBox label="QC by" />
          </div>

          <div className="mt-6 text-[10px] text-text-faint text-center">
            Numbers generated from the frozen quote snapshot. Do not re-measure.
          </div>
        </div>

        <div className="pt-4 flex items-center justify-between text-[11.5px]" data-print-hide>
          <a href={`/make/${job.id}`} className="text-text-dim hover:text-accent">
            ← back to make job
          </a>
          <PrintButton />
        </div>
      </div>
    </>
  );
}

function MetaRow({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="text-[9.5px] uppercase tracking-[0.10em] text-text-dim min-w-[54px]">{k}</span>
      <span className="text-text">{v}</span>
    </div>
  );
}
function Th({
  children, align, width,
}: { children: React.ReactNode; align: "left" | "right"; width?: number }) {
  return (
    <th
      style={width ? { width } : undefined}
      className={`h-[26px] font-medium px-2 ${align === "right" ? "text-right" : "text-left"}`}
    >
      {children}
    </th>
  );
}
function Td({
  children, align, mono,
}: { children: React.ReactNode; align: "left" | "right"; mono?: boolean }) {
  return (
    <td className={`py-2 px-2 ${align === "right" ? "text-right" : "text-left"} ${mono ? "tabular" : ""}`}>
      {children}
    </td>
  );
}
function SignoffBox({ label }: { label: string }) {
  return (
    <div>
      <div className="mb-8 border-b border-text/40" />
      <div className="uppercase tracking-[0.10em]">{label}</div>
    </div>
  );
}
