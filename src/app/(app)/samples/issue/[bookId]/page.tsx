import { notFound, redirect } from "next/navigation";
import { Topbar } from "@/components/layout/Topbar";
import { devContext } from "@/lib/dev-context";
import { scoped } from "@/kernel/db/scoped";
import { issueSampleBook } from "@/modules/catalog/sample-actions";

export const dynamic = "force-dynamic";

export default async function IssueSamplePage({
  params,
}: { params: Promise<{ bookId: string }> }) {
  const { bookId } = await params;
  const ctx = await devContext();
  const db  = scoped(ctx);

  const [book, clients, architects, users] = await Promise.all([
    db.sampleBook.findUnique({
      where:  { id: bookId },
      select: {
        id:     true,
        barcode: true,
        status:  true,
        collection: { select: { name: true, brand: { select: { name: true } } } },
      },
    }),
    db.client.findMany({
      where:   { organizationId: ctx.orgId },
      orderBy: { name: "asc" },
      take:    100,
      select:  { id: true, name: true },
    }),
    db.architect.findMany({
      where:   { organizationId: ctx.orgId },
      orderBy: { contactName: "asc" },
      take:    100,
      select:  { id: true, contactName: true },
    }),
    db.user.findMany({
      where:   { organizationId: ctx.orgId },
      orderBy: { name: "asc" },
      take:    100,
      select:  { id: true, name: true },
    }),
  ]);

  if (!book) notFound();
  if (book.status !== "IN_LIBRARY") {
    redirect("/samples");
  }

  const defaultDue = new Date();
  defaultDue.setDate(defaultDue.getDate() + 14);
  const defaultDueStr = defaultDue.toISOString().slice(0, 10);

  async function handleIssue(formData: FormData) {
    "use server";
    const type        = formData.get("issuedToType") as string;
    const clientId    = formData.get("clientId") as string | null;
    const architectId = formData.get("architectId") as string | null;
    const userId      = formData.get("userId") as string | null;
    const dueAtStr    = formData.get("dueAt") as string;

    const r = await issueSampleBook({
      sampleBookId: bookId,
      issuedToType: type as "CLIENT" | "ARCHITECT" | "STAFF",
      clientId:    type === "CLIENT"    ? clientId    : null,
      architectId: type === "ARCHITECT" ? architectId : null,
      userId:      type === "STAFF"     ? userId      : null,
      dueAt:       new Date(dueAtStr),
      depositAmount: 0n,
    });

    if (r.ok) redirect("/samples");
  }

  return (
    <>
      <Topbar
        title={`Issue sample — ${book.barcode}`}
        eyebrow={`${book.collection.brand.name} · ${book.collection.name}`}
      />

      <div className="max-w-lg">
        <div className="rounded-[14px] bg-surface border border-rule p-6">
          <form action={handleIssue} className="space-y-5">
            <div>
              <label className="block text-[10.5px] uppercase tracking-[0.12em] text-text-dim mb-1.5">
                Issue to
              </label>
              <select
                name="issuedToType"
                className="w-full h-[36px] px-3 bg-surface-2 border border-rule rounded-[8px] text-[13px] outline-none focus:border-accent"
              >
                <option value="CLIENT">Client</option>
                <option value="ARCHITECT">Architect / Designer</option>
                <option value="STAFF">Staff</option>
              </select>
            </div>

            <div>
              <label className="block text-[10.5px] uppercase tracking-[0.12em] text-text-dim mb-1.5">
                Client
              </label>
              <select
                name="clientId"
                className="w-full h-[36px] px-3 bg-surface-2 border border-rule rounded-[8px] text-[13px] outline-none focus:border-accent"
              >
                <option value="">— pick client —</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[10.5px] uppercase tracking-[0.12em] text-text-dim mb-1.5">
                Architect / Designer
              </label>
              <select
                name="architectId"
                className="w-full h-[36px] px-3 bg-surface-2 border border-rule rounded-[8px] text-[13px] outline-none focus:border-accent"
              >
                <option value="">— pick architect —</option>
                {architects.map((a) => (
                  <option key={a.id} value={a.id}>{a.contactName}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[10.5px] uppercase tracking-[0.12em] text-text-dim mb-1.5">
                Staff member
              </label>
              <select
                name="userId"
                className="w-full h-[36px] px-3 bg-surface-2 border border-rule rounded-[8px] text-[13px] outline-none focus:border-accent"
              >
                <option value="">— pick staff —</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[10.5px] uppercase tracking-[0.12em] text-text-dim mb-1.5">
                Due back
              </label>
              <input
                type="date"
                name="dueAt"
                defaultValue={defaultDueStr}
                required
                className="w-full h-[36px] px-3 bg-surface-2 border border-rule rounded-[8px] text-[13px] tabular outline-none focus:border-accent"
              />
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="submit"
                className="h-[36px] px-5 rounded-[8px] bg-accent text-white text-[13px] font-medium hover:bg-accent/90 transition-colors"
              >
                Issue book
              </button>
              <a href="/samples" className="h-[36px] px-4 rounded-[8px] bg-surface border border-rule text-[13px] text-text-dim hover:text-text transition-colors inline-flex items-center">
                Cancel
              </a>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
