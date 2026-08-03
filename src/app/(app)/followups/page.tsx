import Link from "next/link";
import type { Route } from "next";
import { PrimaryButton, Topbar } from "@/components/layout/Topbar";
import { Pager } from "@/components/data/Pager";
import { devContext } from "@/lib/dev-context";
import { listFollowUps, listAutomationRules } from "@/modules/followups/queries";
import { FollowUpsTable } from "./_components/FollowUpsTable";
import { AutomationPanel } from "./_components/AutomationPanel";

export const dynamic = "force-dynamic";

interface SearchParams { page?: string; }

export default async function FollowUpsPage({
  searchParams,
}: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const ctx = await devContext();

  const page = parsePositiveInt(params.page) ?? 1;
  const [{ rows, total, pageSize, counts }, rules] = await Promise.all([
    // Show ALL open + overdue + today's items in a single, un-tabbed view —
    // matches the reference. Completed items surface only when the user
    // just marked them (via optimistic UI) and stay visible until refresh.
    listFollowUps(ctx, { bucket: "OPEN", page, pageSize: 40 }),
    listAutomationRules(ctx),
  ]);

  return (
    <>
      <Topbar
        title="Follow-up Management"
        eyebrow="The discipline layer — nothing sits idle"
        actions={
          <Link href={"/followups/new" as Route}>
            <PrimaryButton>New Follow-up</PrimaryButton>
          </Link>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4 pb-10">
        <div>
          <FollowUpsTable rows={rows} />
          <Pager page={page} pageSize={pageSize} total={total} />
          <div className="mt-3 text-[10.5px] text-text-faint tabular">
            {counts.overdue > 0 && (
              <span className="text-bad">⚠ {counts.overdue} overdue · </span>
            )}
            {counts.today} due today · {counts.open} open in total
          </div>
        </div>
        <AutomationPanel rules={rules} />
      </div>
    </>
  );
}

function parsePositiveInt(v: string | undefined): number | null {
  if (v == null) return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 1) return null;
  return Math.floor(n);
}
