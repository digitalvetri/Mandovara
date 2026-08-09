import { notFound } from "next/navigation";
import { prisma as db } from "@/kernel/db/client";
import { InstallPWA } from "./_components/InstallPWA";

export const dynamic = "force-dynamic";

export default async function InstallerPWAPage({ params }: { params: Promise<{ visitId: string }> }) {
  const { visitId } = await params;

  // Lightweight fetch — no auth middleware in dev, installer-scoped data only
  const visit = await db.installVisit.findUnique({
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
  const orderLines = await db.orderLine.findMany({
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
