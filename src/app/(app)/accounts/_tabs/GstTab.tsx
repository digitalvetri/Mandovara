// GST filing tab — shows output tax (from invoices) and input credit (from
// expenses with GST fields) for a chosen calendar month. Purpose: give the
// accountant a single screen to compute the GSTR-3B net payable and extract
// the GSTR-1 HSN-wise summary without touching a spreadsheet.

import Link from "next/link";
import type { Route } from "next";
import { devContext } from "@/lib/dev-context";
import { can } from "@/kernel/rbac/guard";
import { formatINR } from "@/kernel/money/format";
import { formatDate } from "@/kernel/datetime";
import {
  loadGstSummary, last12Months, formatPeriod,
  type GstPeriod,
} from "@/modules/accounts/gst";
import { NetCard, ComponentRow, Section, Th, Td } from "./_gst-components";

interface Props {
  ctx:   Awaited<ReturnType<typeof devContext>>;
  year:  number;
  month: number;
}

const MONTH_NAMES = [
  "Jan","Feb","Mar","Apr","May","Jun",
  "Jul","Aug","Sep","Oct","Nov","Dec",
];

export async function GstTab({ ctx, year, month }: Props) {
  if (!can(ctx, "expense.view")) {
    return (
      <div className="rounded-[14px] bg-surface border border-rule px-6 py-14 text-center">
        <div className="text-[13.5px] text-text mb-1.5">Restricted to Owner and Accounts.</div>
        <p className="text-[11.5px] text-text-dim">GST data is visible to finance roles only.</p>
      </div>
    );
  }

  const period: GstPeriod = { year, month };
  const [summary, periods] = await Promise.all([
    loadGstSummary(ctx, period),
    Promise.resolve(last12Months()),
  ]);

  const fmt = (n: bigint) => formatINR(n);

  return (
    <div className="space-y-6">
      {/* Period picker */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          {periods.map((p) => {
            const active = p.year === year && p.month === month;
            return (
              <Link
                key={`${p.year}-${p.month}`}
                href={`/accounts?tab=gst&year=${p.year}&gstMonth=${p.month}` as Route}
                className={`h-8 px-3 rounded-[8px] text-[11.5px] font-medium transition-colors
                  ${active
                    ? "bg-accent text-white"
                    : "bg-surface-2 text-text-dim hover:text-text hover:bg-surface-hover border border-rule"
                  }`}
              >
                {MONTH_NAMES[p.month - 1]}{p.year !== new Date().getFullYear() ? ` ${p.year}` : ""}
              </Link>
            );
          })}
        </div>
      </div>

      {/* Net payable hero */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <NetCard label="Output tax collected" value={fmt(summary.totalOutput)}
          sub={`Taxable: ${fmt(summary.outputTaxable)}`} tone="accent" />
        <NetCard label="Input credit (expenses)" value={fmt(summary.totalInput)}
          sub={`Taxable: ${fmt(summary.inputTaxable)}`} tone="solid" />
        <NetCard label={`Net payable — ${formatPeriod(period)}`} value={fmt(summary.netPayable)}
          sub={`CGST ${fmt(summary.netCgst)} · SGST ${fmt(summary.netSgst)} · IGST ${fmt(summary.netIgst)}`}
          tone={summary.netPayable > 0n ? "heat" : "solid"} big />
      </div>

      {/* Output — invoices */}
      <Section title="Output Tax — Invoices issued">
        {summary.outputLines.length === 0 ? (
          <div className="overflow-x-auto px-4 py-8 text-center text-[12px] text-text-dim">
            No invoices issued in {formatPeriod(period)}.
          </div>
        ) : (
          <table className="min-w-[480px] w-full text-[12px]">
            <thead>
              <tr className="border-b border-rule text-[10px] uppercase tracking-[0.14em] text-text-dim">
                <Th>Invoice</Th><Th>Date</Th><Th>Client</Th>
                <Th align="right">Taxable</Th><Th align="right">CGST</Th>
                <Th align="right">SGST</Th><Th align="right">IGST</Th><Th align="right">GST total</Th>
              </tr>
            </thead>
            <tbody>
              {summary.outputLines.map((l) => (
                <tr key={l.invoiceId} className="border-b border-rule/60 last:border-0 hover:bg-surface-hover">
                  <Td><Link href={`/invoicing/${l.invoiceId}` as Route} className="tabular text-accent hover:underline">{l.invoiceNumber}</Link></Td>
                  <Td className="tabular text-text-dim">{formatDate(l.date)}</Td>
                  <Td>{l.clientName}</Td>
                  <Td align="right" className="tabular">{fmt(l.taxable)}</Td>
                  <Td align="right" className="tabular text-text-dim">{fmt(l.cgst)}</Td>
                  <Td align="right" className="tabular text-text-dim">{fmt(l.sgst)}</Td>
                  <Td align="right" className="tabular text-text-dim">{fmt(l.igst)}</Td>
                  <Td align="right" className="tabular font-medium">{fmt(l.cgst + l.sgst + l.igst)}</Td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-rule bg-surface-2 text-[11.5px] font-semibold">
                <Td colSpan={3}>Total</Td>
                <Td align="right" className="tabular">{fmt(summary.outputTaxable)}</Td>
                <Td align="right" className="tabular">{fmt(summary.outputCgst)}</Td>
                <Td align="right" className="tabular">{fmt(summary.outputSgst)}</Td>
                <Td align="right" className="tabular">{fmt(summary.outputIgst)}</Td>
                <Td align="right" className="tabular text-accent">{fmt(summary.totalOutput)}</Td>
              </tr>
            </tfoot>
          </table>
        )}
      </Section>

      {/* HSN summary for GSTR-1 */}
      {summary.hsnRows.length > 0 && (
        <Section title="HSN Summary (for GSTR-1)">
          <table className="min-w-[480px] w-full text-[12px]">
            <thead>
              <tr className="border-b border-rule text-[10px] uppercase tracking-[0.14em] text-text-dim">
                <Th>HSN / SAC</Th><Th align="right">Rate</Th>
                <Th align="right">Taxable</Th><Th align="right">CGST</Th>
                <Th align="right">SGST</Th><Th align="right">IGST</Th><Th align="right">Tax total</Th>
              </tr>
            </thead>
            <tbody>
              {summary.hsnRows.map((r) => (
                <tr key={`${r.hsn}-${r.gstRate}`} className="border-b border-rule/60 last:border-0 hover:bg-surface-hover">
                  <Td className="tabular font-medium">{r.hsn}</Td>
                  <Td align="right" className="tabular text-text-dim">{r.gstRate}%</Td>
                  <Td align="right" className="tabular">{fmt(r.taxable)}</Td>
                  <Td align="right" className="tabular text-text-dim">{fmt(r.cgst)}</Td>
                  <Td align="right" className="tabular text-text-dim">{fmt(r.sgst)}</Td>
                  <Td align="right" className="tabular text-text-dim">{fmt(r.igst)}</Td>
                  <Td align="right" className="tabular">{fmt(r.cgst + r.sgst + r.igst)}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      )}

      {/* Input credit — expenses */}
      {/* Read-only here by design. Both "+ New Expense" controls were
          removed from this tab on 2026-08-29 (owner): logging an expense
          belongs in the Expenses tab, and the GST view stays focused on
          tax summaries, input credit and GSTR reporting. */}
      <Section title="Input Credit — Expenses with GST">
        {summary.inputLines.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <div className="text-[13px] text-text mb-1">No GST-captured expenses for {formatPeriod(period)}.</div>
            <p className="text-[11.5px] text-text-dim">
              Log expenses under the Expenses tab — expand "Add GST details" and enter the GST rate to capture input credit here.
            </p>
          </div>
        ) : (
          <table className="min-w-[480px] w-full text-[12px]">
            <thead>
              <tr className="border-b border-rule text-[10px] uppercase tracking-[0.14em] text-text-dim">
                <Th>Date</Th><Th>Category</Th><Th>Description</Th>
                <Th>Vendor GSTIN</Th><Th>Bill ref</Th>
                <Th align="right">Rate</Th><Th align="right">Taxable</Th>
                <Th align="right">CGST</Th><Th align="right">SGST</Th><Th align="right">IGST</Th>
              </tr>
            </thead>
            <tbody>
              {summary.inputLines.map((l) => (
                <tr key={l.expenseId} className="border-b border-rule/60 last:border-0 hover:bg-surface-hover">
                  <Td className="tabular text-text-dim whitespace-nowrap">{formatDate(l.date)}</Td>
                  <Td>{l.head}</Td>
                  <Td className="text-text-dim max-w-[140px] truncate">{l.description}</Td>
                  <Td className="tabular text-[10.5px]">{l.vendorGstin ?? <span className="text-text-subtle">—</span>}</Td>
                  <Td className="tabular text-[10.5px]">{l.billRef ?? <span className="text-text-subtle">—</span>}</Td>
                  <Td align="right" className="tabular text-text-dim">{l.gstRate}%</Td>
                  <Td align="right" className="tabular">{fmt(l.taxable)}</Td>
                  <Td align="right" className="tabular text-text-dim">{fmt(l.cgst)}</Td>
                  <Td align="right" className="tabular text-text-dim">{fmt(l.sgst)}</Td>
                  <Td align="right" className="tabular text-text-dim">{fmt(l.igst)}</Td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-rule bg-surface-2 text-[11.5px] font-semibold">
                <Td colSpan={6}>Total input credit</Td>
                <Td align="right" className="tabular">{fmt(summary.inputTaxable)}</Td>
                <Td align="right" className="tabular">{fmt(summary.inputCgst)}</Td>
                <Td align="right" className="tabular">{fmt(summary.inputSgst)}</Td>
                <Td align="right" className="tabular text-solid">{fmt(summary.inputIgst)}</Td>
              </tr>
            </tfoot>
          </table>
        )}
      </Section>

      {/* GSTR-3B summary */}
      <Section title="GSTR-3B — Net payable this month">
        <div className="px-4 py-4 grid grid-cols-3 gap-6 text-[12.5px]">
          <ComponentRow label="CGST payable" output={fmt(summary.outputCgst)} input={fmt(summary.inputCgst)} net={fmt(summary.netCgst)} />
          <ComponentRow label="SGST payable" output={fmt(summary.outputSgst)} input={fmt(summary.inputSgst)} net={fmt(summary.netSgst)} />
          <ComponentRow label="IGST payable" output={fmt(summary.outputIgst)} input={fmt(summary.inputIgst)} net={fmt(summary.netIgst)} />
        </div>
        <div className="border-t border-rule px-4 py-3 flex items-baseline justify-between">
          <span className="text-[11.5px] text-text-dim">Total net payable to government</span>
          <span className="text-[22px] tabular font-semibold text-text">{fmt(summary.netPayable)}</span>
        </div>
        <p className="px-4 pb-3 text-[10.5px] text-text-subtle">
          Estimate only. Carry-forward credits, RCM liability and advances from prior months are not reflected — confirm final figures with your CA.
        </p>
      </Section>
    </div>
  );
}
