import { Topbar } from "@/components/layout/Topbar";
import { Pager } from "@/components/data/Pager";
import { devContext } from "@/lib/dev-context";
import {
  listNotifications, type NotificationFilter,
} from "@/modules/notifications/queries";
import { NotificationsPage } from "./_components/NotificationsPage";

export const dynamic = "force-dynamic";

export default async function InboxPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; page?: string }>;
}) {
  const sp     = await searchParams;
  const filter = normaliseFilter(sp.filter);
  const page   = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);

  const ctx  = await devContext();
  const data = await listNotifications(ctx, { filter, page });

  return (
    <>
      <Topbar
        title="Notifications"
        eyebrow={`${data.counts.unread} unread of ${data.counts.all} total. Chronological — newest first.`}
      />

      <NotificationsPage
        rows={data.rows}
        counts={data.counts}
        activeFilter={filter}
      />

      <Pager page={data.page} pageSize={data.pageSize} total={data.total} />
    </>
  );
}

function normaliseFilter(v: string | undefined): NotificationFilter {
  return v === "READ" || v === "ALL" ? v : v === "UNREAD" ? "UNREAD" : "UNREAD";
}
