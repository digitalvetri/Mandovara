// The migration, against a real database.
//
// The parser tests prove the file is read correctly. This proves the
// rows actually land — and, critically, that re-uploading a corrected
// file updates clients rather than duplicating them. People WILL upload
// twice, and duplicate clients split one customer's projects across two
// records, which is very hard to unpick afterwards.

import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import * as XLSX from "xlsx";
import { prisma as db } from "@/kernel/db/client";
import { setupTwoTenants, type Tenant } from "../../kernel/fixtures";

let A: Tenant;
const ctxRef: { current: unknown } = { current: null };
vi.mock("@/lib/dev-context", () => ({ devContext: async () => ctxRef.current }));
vi.mock("next/cache", () => ({ revalidatePath: () => {}, revalidateTag: () => {} }));

const { importClientsAndProjects } = await import("@/modules/clients/import-action");

function fileFrom(sheets: Record<string, Record<string, unknown>[]>): FormData {
  const wb = XLSX.utils.book_new();
  for (const [name, rows] of Object.entries(sheets)) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), name);
  }
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
  const fd = new FormData();
  fd.append("file", new File([new Uint8Array(buf)], "books.xlsx", {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  }));
  return fd;
}

beforeAll(async () => {
  const t = await setupTwoTenants(db);
  A = t.A;
  ctxRef.current = {
    ...A.ctx,
    permissions: new Set([...A.ctx.permissions, "client.create", "project.create"]),
  };
});

beforeEach(async () => {
  await db.project.deleteMany({});
  await db.client.deleteMany({});
});

describe("importClientsAndProjects", () => {
  it("creates clients and their projects, linked correctly", async () => {
    const res = await importClientsAndProjects(fileFrom({
      Clients: [
        { "Client Code": "C-1", "Client Name": "Dr Kannan",  "Mobile No": "98430 12345", Type: "Homeowner" },
        { "Client Code": "C-2", "Client Name": "Sri Builders", "Mobile No": "9843099999", Type: "Contractor" },
      ],
      Projects: [
        { "Project Name": "Villa",  "Client Code": "C-1", Stage: "Completed", "Order Value": "6,50,000" },
        // Referenced by mobile rather than code — both must resolve.
        { "Project Name": "Office", "client_mobile": "9843099999", Stage: "Ordered", "Order Value": "2.4L" },
      ],
    }));

    expect(res.ok).toBe(true);
    expect(res.data!.clientsCreated).toBe(2);
    expect(res.data!.projectsCreated).toBe(2);
    expect(res.data!.projectsOrphaned).toBe(0);
    expect(res.data!.errors).toHaveLength(0);

    const villa = await db.project.findFirstOrThrow({
      where: { name: "Villa" }, select: { orderValue: true, stage: true, client: { select: { name: true } } },
    });
    expect(villa.client.name).toBe("Dr Kannan");
    expect(villa.orderValue).toBe(65_000_000n);   // BigInt paise, not a float
    expect(villa.stage).toBe("COMPLETED");

    const office = await db.project.findFirstOrThrow({
      where: { name: "Office" }, select: { client: { select: { name: true } }, orderValue: true },
    });
    expect(office.client.name).toBe("Sri Builders");
    expect(office.orderValue).toBe(24_000_000n);  // "2.4L"
  });

  it("re-uploading a corrected file updates, it does not duplicate", async () => {
    const first = fileFrom({
      Clients: [{ "Client Code": "C-1", "Client Name": "Dr Kanan", "Mobile No": "9843012345", Type: "Homeowner" }],
    });
    await importClientsAndProjects(first);

    // Same person, name spelled correctly, mobile written differently.
    const second = fileFrom({
      Clients: [{ "Client Code": "C-1", "Client Name": "Dr Kannan", "Mobile No": "+91 98430 12345", Type: "Architect" }],
    });
    const res = await importClientsAndProjects(second);

    expect(res.data!.clientsCreated).toBe(0);
    expect(res.data!.clientsUpdated).toBe(1);
    expect(await db.client.count()).toBe(1);

    const c = await db.client.findFirstOrThrow({ select: { name: true, type: true } });
    expect(c.name).toBe("Dr Kannan");
    expect(c.type).toBe("ARCHITECT");
  });

  it("reports an orphaned project instead of dropping it silently", async () => {
    const res = await importClientsAndProjects(fileFrom({
      Clients:  [{ "Client Name": "Someone", "Mobile No": "9843012345" }],
      Projects: [{ "Project Name": "Orphan", "Client Code": "NOPE", Stage: "Completed" }],
    }));

    expect(res.data!.projectsCreated).toBe(0);
    expect(res.data!.projectsOrphaned).toBe(1);
    expect(res.data!.errors[0]!.reason).toMatch(/no client matches/i);
  });

  it("commits the good rows even when others fail", async () => {
    const res = await importClientsAndProjects(fileFrom({
      Clients: [
        { "Client Name": "Good",    "Mobile No": "9843012345" },
        { "Client Name": "Bad",     "Mobile No": "nonsense" },
        { "Client Name": "Also OK", "Mobile No": "9843012399" },
      ],
    }));
    expect(res.data!.clientsCreated).toBe(2);
    expect(res.data!.errors).toHaveLength(1);
    expect(await db.client.count()).toBe(2);
  });

  it("keeps their own client code so staff still recognise it", async () => {
    await importClientsAndProjects(fileFrom({
      Clients: [{ "Client Code": "LEGACY-77", "Client Name": "X", "Mobile No": "9843012345" }],
    }));
    const c = await db.client.findFirstOrThrow({ select: { code: true } });
    expect(c.code).toBe("LEGACY-77");
  });
});
