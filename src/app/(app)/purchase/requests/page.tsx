import { Topbar } from "@/components/layout/Topbar";
import { devContext } from "@/lib/dev-context";
import { can } from "@/kernel/rbac/guard";
import { listPurchaseRequests } from "@/modules/purchase-requests/queries";
import { formatDate } from "@/kernel/datetime";
import { NewRequestButton } from "./_components/NewRequestButton";
import { ApprovalButtons } from "./_components/ApprovalButtons";

export const dynamic = "force-dynamic";

const STATUS_CHIP: Record<string, string> = {
  DRAFT:     "bg-surface-2 text-text-dim",
  SUBMITTED: "bg-heat/12 text-heat",
  APPROVED:  "bg-solid/12 text-solid",
  REJECTED:  "bg-fault/12 text-fault",
};

export default async function PurchaseRequestsPage() {
  const ctx = await devContext();
  const [requests, canApprove] = await Promise.all([
    listPurchaseRequests(ctx),
    Promise.resolve(can(ctx, "requisition.approve")),
  ]);

  return (
    <>
      <Topbar
        title="Purchase Requests"
        eyebrow="Employees raise requests — Owner or Store approves before a PO is raised"
        actions={<NewRequestButton />}
      />

      <div className="rounded-[14px] bg-surface border border-rule overflow-x-auto">
        {requests.length === 0 ? (
          <div className="py-16 text-center">
            <div className="text-[13px] text-text-dim">No purchase requests yet.</div>
            <div className="text-[11.5px] text-text-faint mt-1">Raise the first request using the button above.</div>
          </div>
        ) : (
          <table className="w-full text-[12.5px]">
            <thead>
              <tr className="border-b border-rule text-[10.5px] uppercase tracking-[0.14em] text-text-dim">
                <Th>Number</Th>
                <Th>Raised by</Th>
                <Th>Reason</Th>
                <Th>Project</Th>
                <Th>Lines</Th>
                <Th>Needed by</Th>
                <Th>Status</Th>
                {canApprove && <Th>Actions</Th>}
              </tr>
            </thead>
            <tbody>
              {requests.map((r) => (
                <tr key={r.id} className="border-b border-rule/60 last:border-0 hover:bg-surface-2/30 transition-colors">
                  <Td>
                    <a href={`/purchase/requests/${r.id}`} className="font-mono text-[11.5px] text-accent hover:underline">
                      {r.number}
                    </a>
                  </Td>
                  <Td className="text-text-dim">{r.raisedBy}</Td>
                  <Td className="max-w-[200px] truncate text-text-dim">{r.reason}</Td>
                  <Td className="text-text-dim">{r.projectName ?? "—"}</Td>
                  <Td className="tabular text-text-dim">{r.lineCount}</Td>
                  <Td className="tabular text-text-dim">{r.neededBy ? formatDate(r.neededBy) : "—"}</Td>
                  <Td>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10.5px] font-medium ${STATUS_CHIP[r.status] ?? "bg-surface-2 text-text-dim"}`}>
                      {r.status}
                    </span>
                  </Td>
                  {canApprove && (
                    <Td>
                      {r.status === "SUBMITTED" && <ApprovalButtons id={r.id} />}
                    </Td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

function Th({ children }: { children?: React.ReactNode }) {
  return <th className="px-4 h-[36px] font-medium text-left whitespace-nowrap">{children}</th>;
}
function Td({ children, className = "" }: { children?: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-2 ${className}`}>{children}</td>;
}
