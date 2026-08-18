import { notFound } from "next/navigation";
import { orgPrisma } from "@/kernel/db/rls";
import { devContext } from "@/lib/dev-context";
import { InstallPWA } from "./_components/InstallPWA";

export const dynamic = "force-dynamic";

export default async function InstallerPWAPage({ params }: { params: Promise<{ visitId: string }> }) {
  const { visitId } = await params;

  // Resolve the caller's tenant. This used to fetch by bare visitId with no
  // organizationId check at all ("no auth middleware in dev"), which meant any
  // logged-in user could read another tenant's install visit by guessing an id.
  const ctx = await devContext();
  const visit = await orgPrisma(ctx.orgId).installVisit.findUnique({
    where: { id: visitId },
    select: {
      id: true,
      number: true,
      status: true,
      scheduledAt: true,
      completedAt: true,
      clientSignatureKey: true,
      notes: true,
      project: {
        select: {
          name: true,
          siteAddress: true,
          client: { select: { name: true, mobile: true } },
        },
      },
      lines: {
        orderBy: { id: "asc" },
        select: {
          id: true,
          roomLabel: true,
          plannedQty: true,
          installedQty: true,
          dyeLotUsed: true,
          issue: true,
          orderLineId: true,
        },
      },
    },
  });

  if (!visit) notFound();

  // Resolve order line descriptions separately (no Prisma relation on InstallLine → OrderLine)
  const orderLineIds = visit.lines.map((l) => l.orderLineId);
  const orderLines = await orgPrisma(ctx.orgId).orderLine.findMany({
    where: { id: { in: orderLineIds } },
    select: { id: true, description: true },
  });
  const olMap = new Map(orderLines.map((l) => [l.id, l]));

  const visitWithDescriptions = {
    ...visit,
    lines: visit.lines.map((l) => ({
      ...l,
      orderLine: olMap.get(l.orderLineId) ? { description: olMap.get(l.orderLineId)!.description } : null,
    })),
  };

  return <InstallPWA visit={visitWithDescriptions} />;
}
