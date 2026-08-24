import { Topbar } from "@/components/layout/Topbar";
import { devContext } from "@/lib/dev-context";
import { scoped } from "@/kernel/db/scoped";
import { CreateMakeJobForm } from "./_components/CreateMakeJobForm";

export const dynamic = "force-dynamic";

export default async function NewMakeJobPage() {
  const ctx = await devContext();
  const db  = scoped(ctx);

  const [orders, vendors, users] = await Promise.all([
    db.order.findMany({
      where:   { status: { in: ["CONFIRMED", "PROCUREMENT", "MAKE"] }, organizationId: ctx.orgId },
      orderBy: { date: "desc" },
      take:    100,
      select: {
        id: true, number: true,
        project: { select: { name: true, client: { select: { name: true } } } },
      },
    }),
    db.vendor.findMany({
      where:   { organizationId: ctx.orgId, isActive: true },
      orderBy: { name: "asc" },
      take:    100,
      select:  { id: true, name: true },
    }),
    db.user.findMany({
      where:   { organizationId: ctx.orgId },
      orderBy: { name: "asc" },
      take:    100,
      select:  { id: true, name: true },
    }),
  ]);

  const orderOptions = orders.map((o) => ({
    id:     o.id,
    label:  `${o.number} — ${o.project.client.name} · ${o.project.name}`,
  }));

  return (
    <>
      <Topbar title="New make job" eyebrow="Select the sales order to create a cut & stitch job" />
      <div className="max-w-lg">
        <CreateMakeJobForm
          orders={orderOptions}
          vendors={vendors}
          users={users}
        />
      </div>
    </>
  );
}
