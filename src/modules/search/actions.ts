"use server";

// Global search — one server action that fans out to every module the
// command palette can jump to. Kept intentionally shallow (5 hits per
// kind) so the round-trip stays under 100ms across the seeded fixtures.

import { scoped } from "@/kernel/db/scoped";
import { devContext } from "@/lib/dev-context";

export type SearchKind =
  | "client" | "project" | "quotation" | "order" | "invoice"
  | "lead"   | "design"  | "vendor";

export interface SearchHit {
  kind:      SearchKind;
  id:        string;
  title:     string;
  subtitle?: string;
  href:      string;
}

const LIMIT_PER_KIND = 5;

export async function searchAll(q: string): Promise<SearchHit[]> {
  const query = q.trim();
  if (query.length < 2) return [];

  const ctx = await devContext();
  const db  = scoped(ctx);

  const contains = { contains: query, mode: "insensitive" as const };

  const [clients, projects, quotes, orders, invoices, leads, designs, vendors] =
    await Promise.all([
      db.client.findMany({
        where: { OR: [
          { name:   contains },
          { mobile: { contains: query } },
          { gstin:  { contains: query, mode: "insensitive" } },
        ] },
        take: LIMIT_PER_KIND,
        select: { id: true, name: true, mobile: true, gstin: true },
      }),
      db.project.findMany({
        where: { OR: [
          { name:   contains },
          { number: { contains: query, mode: "insensitive" } },
        ] },
        take: LIMIT_PER_KIND,
        select: {
          id: true, name: true, number: true,
          client: { select: { name: true } },
        },
      }),
      db.quotation.findMany({
        where: { OR: [
          { number: { contains: query, mode: "insensitive" } },
          { project: { client: { name: contains } } },
        ] },
        take: LIMIT_PER_KIND,
        select: {
          id: true, number: true, total: true, status: true,
          project: { select: { client: { select: { name: true } } } },
        },
      }),
      db.order.findMany({
        where: { OR: [
          { number: { contains: query, mode: "insensitive" } },
          { project: { client: { name: contains } } },
        ] },
        take: LIMIT_PER_KIND,
        select: {
          id: true, number: true, status: true,
          project: { select: { client: { select: { name: true } } } },
        },
      }),
      db.invoice.findMany({
        where: { number: { contains: query, mode: "insensitive" } },
        take: LIMIT_PER_KIND,
        select: { id: true, number: true, status: true },
      }),
      db.lead.findMany({
        where: { OR: [
          { name:   contains },
          { mobile: { contains: query } },
        ] },
        take: LIMIT_PER_KIND,
        select: { id: true, name: true, mobile: true, stage: true },
      }),
      db.design.findMany({
        where: { OR: [
          { name: contains },
          { code: { contains: query, mode: "insensitive" } },
          { hsn:  { contains: query } },
        ] },
        take: LIMIT_PER_KIND,
        select: {
          id: true, name: true, code: true,
          collection: { select: { brand: { select: { name: true } } } },
        },
      }),
      db.vendor.findMany({
        where: { OR: [
          { name:   contains },
          { mobile: { contains: query } },
          { gstin:  { contains: query, mode: "insensitive" } },
        ] },
        take: LIMIT_PER_KIND,
        select: { id: true, name: true, mobile: true },
      }),
    ]);

  const hits: SearchHit[] = [
    ...clients.map((c): SearchHit => ({
      kind: "client", id: c.id, title: c.name,
      subtitle: [c.mobile, c.gstin].filter(Boolean).join(" · "),
      href: `/clients/${c.id}`,
    })),
    ...projects.map((p): SearchHit => ({
      kind: "project", id: p.id, title: p.name,
      subtitle: `${p.number} · ${p.client.name}`,
      href: `/projects/${p.id}`,
    })),
    ...quotes.map((q): SearchHit => ({
      kind: "quotation", id: q.id, title: q.number,
      // Lead-scoped quotations have no project; label them "Lead quote"
      // until the search index grows a lead-name lookup next session.
      subtitle: q.project
        ? `${q.project.client.name} · ${q.status.toLowerCase()}`
        : `Lead quote · ${q.status.toLowerCase()}`,
      href: `/quotations/${q.id}`,
    })),
    ...orders.map((o): SearchHit => ({
      kind: "order", id: o.id, title: o.number,
      subtitle: `${o.project.client.name} · ${o.status.toLowerCase()}`,
      href: `/orders/${o.id}`,
    })),
    ...invoices.map((i): SearchHit => ({
      kind: "invoice", id: i.id, title: i.number,
      subtitle: i.status.toLowerCase(),
      href: `/invoicing/${i.id}`,
    })),
    ...leads.map((l): SearchHit => ({
      kind: "lead", id: l.id, title: l.name,
      subtitle: [l.mobile, l.stage.toLowerCase()].filter(Boolean).join(" · "),
      href: `/leads/${l.id}`,
    })),
    ...designs.map((d): SearchHit => ({
      kind: "design", id: d.id, title: d.name,
      subtitle: `${d.collection.brand.name} · ${d.code}`,
      href: `/catalog/design/${d.id}`,
    })),
    ...vendors.map((v): SearchHit => ({
      kind: "vendor", id: v.id, title: v.name,
      subtitle: v.mobile,
      href: `/purchase/vendors/${v.id}`,
    })),
  ];

  return hits;
}