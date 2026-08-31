// /my-expenses — the owner's own spending.
//
// Owner, 2026-08-31: "for admin I need a new module named self expense
// calculator where he can maintain the expense of his own like fuel, food
// etc, and the household expense."
//
// Separate from Accounts & Payments on purpose. That module is the studio's
// books — GST, approvals, the P&L. This is a private notebook, scoped to
// the signed-in user, and nothing here reaches a report.

import { Topbar } from "@/components/layout/Topbar";
import { listPersonalExpenses } from "@/modules/personal-expenses";
import { PersonalExpenseBoard } from "./_components/PersonalExpenseBoard";

export const dynamic = "force-dynamic";

interface SearchParams { months?: string }

export default async function MyExpensesPage({
  searchParams,
}: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const months = params.months === "3" ? 3 : params.months === "12" ? 12 : 1;

  const { rows, total, byCategory } = await listPersonalExpenses(months);

  return (
    <>
      <Topbar
        title="My expenses"
        eyebrow="Your own spending — kept out of the studio books"
      />
      <PersonalExpenseBoard rows={rows} total={total} byCategory={byCategory} months={months} />
    </>
  );
}
