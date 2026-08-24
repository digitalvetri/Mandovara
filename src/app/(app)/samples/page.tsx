import { Topbar } from "@/components/layout/Topbar";
import { devContext } from "@/lib/dev-context";
import { formatINR } from "@/kernel/money/format";
import { listSampleBooks } from "@/modules/samples/queries";
import { ReturnBookButton } from "./_components/ReturnBookButton";

export const dynamic = "force-dynamic";

const STATUS_FILTERS = ["ALL", "OVERDUE", "ISSUED", "IN_LIBRARY", "RETURNED", "LOST"] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number];

const STATUS_TONE: Record<string, string> = {
  IN_LIBRARY: "bg-good/12 text-good",
  ISSUED:     "bg-info/12 text-info",
  OVERDUE:    "bg-bad/12 text-bad",
  RETURNED:   "bg-text-dim/12 text-text-dim",
  LOST:       "bg-warn/15 text-warn",
};
const STATUS_LABEL: Record<string, string> = {
  IN_LIBRARY: "In library",
  ISSUED:     "Issued",
  OVERDUE:    "Overdue",
  RETURNED:   "Returned",
  LOST:       "Lost",
};

interface SearchParams { status?: string }

export default async function SamplesPage({
  searchParams,
}: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const ctx = await devContext();

  const statusFilter = normaliseStatus(params.status);
  const { rows, overdueCount, issuedCount, inLibraryCount } =
    await listSampleBooks(ctx, { status: statusFilter });

  return (
    <>
      <Topbar
        title="Sample Library"
        eyebrow={`${overdueCount > 0 ? `${overdueCount} overdue · ` : ""}${issuedCount} issued · ${inLibraryCount} in library`}
      />

      {/* Status filter tabs */}
      <div className="flex flex-wrap gap-1.5 mb-4">
        {STATUS_FILTERS.map((s) => (
          <a
            key={s}
            href={`/samples${s === "ALL" ? "" : `?status=${s}`}`}
            className={`h-[28px] px-3 rounded-[6px] text-[11.5px] font-medium transition-colors inline-flex items-center
              ${statusFilter === s
                ? "bg-accent text-white"
                : "bg-surface border border-rule text-text-dim hover:text-text"
              }`}
          >
            {s === "ALL" ? "All books" : STATUS_LABEL[s] ?? s}
          </a>
        ))}
      </div>

      {/* Overdue alert */}
      {overdueCount > 0 && statusFilter === "ALL" && (
        <div className="mb-4 rounded-[10px] border border-bad/40 bg-bad/8 px-4 py-3 text-[12.5px] text-bad">
          {overdueCount} book{overdueCount === 1 ? "" : "s"} overdue — holders should be nudged via WhatsApp.
          <a href="/samples?status=OVERDUE" className="ml-2 underline underline-offset-2">
            View overdue
          </a>
        </div>
      )}

      {/* Main table */}
      {rows.length === 0 ? (
        <div className="rounded-[14px] bg-surface border border-rule py-16 text-center">
          <div className="text-[12px] text-text-dim mb-1">
            {statusFilter === "ALL"
              ? "No sample books in the library yet."
              : `No books with status "${STATUS_LABEL[statusFilter] ?? statusFilter}".`}
          </div>
          {statusFilter !== "ALL" && (
            <a href="/samples" className="text-[11.5px] text-accent hover:underline">
              View all books
            </a>
          )}
        </div>
      ) : (
        <div className="rounded-[14px] bg-surface border border-rule overflow-hidden">
          <table className="w-full text-[12.5px]">
            <thead>
              <tr className="border-b border-rule text-[10.5px] uppercase tracking-[0.14em] text-text-dim">
                <Th>Barcode</Th>
                <Th>Collection</Th>
                <Th>Brand</Th>
                <Th>Status</Th>
                <Th>Holder</Th>
                <Th>Due date</Th>
                <Th align="right">Overdue</Th>
                <Th align="right">Value</Th>
                <Th></Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((book) => (
                <tr key={book.id} className="border-b border-rule/60 last:border-0">
                  <Td>
                    <span className="font-mono text-[11.5px] text-text-dim tabular">{book.barcode}</span>
                  </Td>
                  <Td>{book.collectionName}</Td>
                  <Td className="text-text-dim">{book.brandName}</Td>
                  <Td>
                    <span className={`inline-block text-[10.5px] font-medium tracking-[0.06em] uppercase px-2 py-0.5 rounded-[3px] ${STATUS_TONE[book.status] ?? "bg-text-dim/12 text-text-dim"}`}>
                      {STATUS_LABEL[book.status] ?? book.status}
                    </span>
                  </Td>
                  <Td>
                    {book.holderName ? (
                      <>
                        <div className="text-text">{book.holderName}</div>
                        <div className="text-[10.5px] text-text-dim">{holderTypeLabel(book.holderType)}</div>
                      </>
                    ) : (
                      <span className="text-text-dim">—</span>
                    )}
                  </Td>
                  <Td className="tabular text-text-dim">
                    {book.dueAt
                      ? book.dueAt.toLocaleDateString("en-IN", {
                          day: "2-digit", month: "short", year: "numeric",
                          timeZone: "Asia/Kolkata",
                        })
                      : "—"}
                  </Td>
                  <Td align="right">
                    {book.daysOverdue != null ? (
                      <span className="tabular text-bad font-medium">
                        {book.daysOverdue}d
                      </span>
                    ) : (
                      <span className="text-text-dim">—</span>
                    )}
                  </Td>
                  <Td align="right">
                    <span className="tabular text-text-dim">{formatINR(book.costValue)}</span>
                  </Td>
                  <Td align="right">
                    {book.status === "IN_LIBRARY" && (
                      <a
                        href={`/samples/issue/${book.id}`}
                        className="h-[24px] px-2.5 rounded-[4px] text-[10.5px] font-medium bg-info/12 text-info hover:bg-info/20 transition-colors inline-flex items-center whitespace-nowrap"
                      >
                        Issue
                      </a>
                    )}
                    {(book.status === "ISSUED" || book.status === "OVERDUE") && (
                      <ReturnBookButton bookId={book.id} />
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function normaliseStatus(v: string | undefined): StatusFilter {
  if (!v || !STATUS_FILTERS.includes(v as StatusFilter)) return "ALL";
  return v as StatusFilter;
}
function holderTypeLabel(t: string | null): string {
  if (t === "CLIENT")    return "Client";
  if (t === "ARCHITECT") return "Architect / Designer";
  if (t === "STAFF")     return "Staff";
  return "—";
}
function Th({ children, align = "left" }: { children?: React.ReactNode; align?: "left" | "right" }) {
  return (
    <th className={`px-4 h-[34px] font-medium ${align === "right" ? "text-right" : "text-left"}`}>
      {children}
    </th>
  );
}
function Td({ children, align = "left", className = "" }: {
  children: React.ReactNode; align?: "left" | "right"; className?: string;
}) {
  return (
    <td className={`px-4 py-2.5 ${align === "right" ? "text-right" : "text-left"} ${className}`}>
      {children}
    </td>
  );
}
