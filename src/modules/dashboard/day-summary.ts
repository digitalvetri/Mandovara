import { scoped } from "@/kernel/db/scoped";
import type { RequestContext } from "@/kernel/auth/context";

export interface DaySummaryItem {
  id: string;
  icon: "Users" | "CalendarCheck" | "Ruler" | "Wrench" | "AlertCircle" | "Package" | "ClipboardList" | "FileText" | "UserCheck" | "IndianRupee";
  count: number;
  label: string;
  href: string;
  urgency: "normal" | "warn" | "hot";
}

function todayRange() {
  const now  = new Date();
  const s    = new Date(now); s.setHours(0, 0, 0, 0);
  const e    = new Date(now); e.setHours(23, 59, 59, 999);
  return { now, start: s, end: e };
}

function push(
  items: DaySummaryItem[],
  item: Omit<DaySummaryItem, "label"> & { singular: string; plural: string },
) {
  items.push({
    id:      item.id,
    icon:    item.icon,
    count:   item.count,
    label:   item.count === 1 ? item.singular : item.plural,
    href:    item.href,
    urgency: item.urgency,
  });
}

export async function loadDaySummary(ctx: RequestContext): Promise<DaySummaryItem[]> {
  const db   = scoped(ctx);
  const role = ctx.roles[0] ?? "OWNER";
  const { now, start, end } = todayRange();
  const items: DaySummaryItem[] = [];

  if (role === "OWNER") {
    const [
      leadsOpen, followupsDue, measurementsToday,
      overdueInvoices, makeJobsReady,
    ] = await Promise.all([
      db.lead.count({ where: { stage: { in: ["NEW", "CONTACTED"] } } }),
      db.followUp.count({ where: { dueAt: { lte: end }, completedAt: null } }),
      db.measurement.count({ where: { visitedAt: { gte: start, lte: end } } }),
      db.invoice.count({ where: { status: { in: ["ISSUED", "PARTIALLY_PAID"] }, dueDate: { lt: now } } }),
      db.makeJob.count({ where: { status: "READY" } }),
    ]);

    if (leadsOpen > 0)        push(items, { id: "leads",     icon: "Users",        count: leadsOpen,        singular: "lead to contact",       plural: "leads to contact",        href: "/leads",        urgency: "normal" });
    if (followupsDue > 0)     push(items, { id: "followups", icon: "CalendarCheck", count: followupsDue,     singular: "follow-up due today",    plural: "follow-ups due today",     href: "/leads",        urgency: followupsDue > 5 ? "warn" : "normal" });
    if (measurementsToday > 0)push(items, { id: "measure",   icon: "Ruler",         count: measurementsToday,singular: "site measurement today",  plural: "site measurements today",  href: "/measurements", urgency: "normal" });
    if (makeJobsReady > 0)    push(items, { id: "makejobs",  icon: "Package",       count: makeJobsReady,    singular: "job ready to finalise",  plural: "jobs ready to finalise",   href: "/make",         urgency: "normal" });
    if (overdueInvoices > 0)  push(items, { id: "invoices",  icon: "AlertCircle",   count: overdueInvoices,  singular: "invoice overdue",        plural: "invoices overdue",         href: "/invoicing",    urgency: overdueInvoices > 5 ? "hot" : "warn" });

    return items;
  }

  if (role === "SALES") {
    const [myLeads, myFollowups] = await Promise.all([
      db.lead.count({ where: { stage: { in: ["NEW", "CONTACTED"] }, ownerId: ctx.userId } }),
      db.followUp.count({ where: { ownerId: ctx.userId, dueAt: { lte: end }, completedAt: null } }),
    ]);
    if (myLeads > 0)     push(items, { id: "leads",     icon: "Users",        count: myLeads,     singular: "lead to contact",    plural: "leads to contact",    href: "/leads", urgency: "normal" });
    if (myFollowups > 0) push(items, { id: "followups", icon: "CalendarCheck", count: myFollowups, singular: "follow-up due today", plural: "follow-ups due today", href: "/leads", urgency: myFollowups > 5 ? "warn" : "normal" });
    return items;
  }

  if (role === "DESIGNER") {
    const [inQuote, myFollowups] = await Promise.all([
      db.project.count({ where: { stage: "QUOTATION", ownerId: ctx.userId } }),
      db.followUp.count({ where: { ownerId: ctx.userId, dueAt: { lte: end }, completedAt: null } }),
    ]);
    if (inQuote > 0)     push(items, { id: "projects",  icon: "FileText",     count: inQuote,     singular: "project awaiting quote",  plural: "projects awaiting quote",  href: "/projects", urgency: "normal" });
    if (myFollowups > 0) push(items, { id: "followups", icon: "CalendarCheck", count: myFollowups, singular: "follow-up due today",      plural: "follow-ups due today",      href: "/leads",    urgency: myFollowups > 5 ? "warn" : "normal" });
    return items;
  }

  if (role === "MEASURE_EXEC") {
    const today = await db.measurement.count({
      where: { visitedAt: { gte: start, lte: end }, measuredById: ctx.userId },
    });
    if (today > 0) push(items, { id: "measure", icon: "Ruler", count: today, singular: "measurement today", plural: "measurements today", href: "/measurements", urgency: "normal" });
    return items;
  }

  if (role === "MAKE_SUPERVISOR") {
    const [ready, inQc] = await Promise.all([
      db.makeJob.count({ where: { status: "READY" } }),
      db.makeJob.count({ where: { status: "QC"    } }),
    ]);
    if (ready > 0) push(items, { id: "ready", icon: "Package",       count: ready, singular: "job ready", plural: "jobs ready", href: "/make", urgency: "normal" });
    if (inQc > 0)  push(items, { id: "qc",    icon: "ClipboardList", count: inQc,  singular: "job awaiting QC",       plural: "jobs awaiting QC",       href: "/make", urgency: "normal" });
    return items;
  }

  if (role === "STORE") {
    const pendingPos = await db.purchaseOrder.count({ where: { status: { in: ["SENT", "PARTIAL"] } } });
    if (pendingPos > 0) push(items, { id: "pos", icon: "Package", count: pendingPos, singular: "PO awaiting delivery", plural: "POs awaiting delivery", href: "/purchase", urgency: "normal" });
    return items;
  }

  if (role === "ACCOUNTS") {
    const overdue = await db.invoice.count({
      where: { status: { in: ["ISSUED", "PARTIALLY_PAID"] }, dueDate: { lt: now } },
    });
    if (overdue > 0) push(items, { id: "invoices", icon: "IndianRupee", count: overdue, singular: "invoice overdue", plural: "invoices overdue", href: "/invoicing", urgency: "hot" });
    return items;
  }

  if (role === "HR") {
    const pending = await db.leave.count({ where: { state: "PENDING" } });
    if (pending > 0) push(items, { id: "leaves", icon: "UserCheck", count: pending, singular: "leave request pending", plural: "leave requests pending", href: "/attendance", urgency: "normal" });
    return items;
  }

  return items;
}
