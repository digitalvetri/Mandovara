// Spec for the purchase/vendor module — first generated module (W8 gate).
// Covers: Vendor entity only.
// Hand-coded additions needed after generation:
//   • purchase-request create/approve workflow (approval engine)
//   • PurchaseOrder + POLine (multi-entity transaction)
//   • GRN + GRNLine with dye-lot capture and StockMove append
//   • Vendor rating and lead-time on PO/GRN creation

import type { ModuleSpec } from "../types";

// Note: generates to src/modules/vendor-scaffold/ — a clean demo directory.
// When implementing the real Vendors module (W8-11), point to "vendors" and
// hand-code the dye-lot, GRN and purchase-request logic on top.
export const vendorModuleSpec: ModuleSpec = {
  moduleName: "vendor-scaffold",
  entities: [
    {
      name: "Vendor",
      dbName: "vendor",
      createPermission: "vendor.create",
      updatePermission: "vendor.update",
      revalidatePath: "/purchase",
      orderByField: "name",
      fields: [
        { name: "code", zod: "z.string().min(1).max(60)" },
        { name: "name", zod: "z.string().min(1).max(120)" },
        {
          name: "gstin",
          zod: "z.string().max(15)",
          optional: true,
          nullable: true,
        },
        { name: "mobile", zod: "z.string().min(10).max(15)" },
        {
          name: "email",
          zod: "z.string().email()",
          optional: true,
          nullable: true,
        },
        {
          // JSON nullable fields need Prisma.JsonNull for explicit null;
          // the generator uses optional-only to avoid the InputJsonValue constraint.
          name: "address",
          zod: "z.record(z.string(), z.unknown())",
          optional: true,
        },
        {
          name: "paymentTermsDays",
          zod: "z.number().int().min(0).max(365)",
          defaultValue: "30",
        },
        {
          name: "leadTimeDays",
          zod: "z.number().int().min(0).max(365)",
          defaultValue: "14",
        },
        {
          name: "brandIds",
          zod: "z.array(z.string())",
          defaultValue: "[]",
        },
        {
          name: "rating",
          zod: "z.number().int().min(1).max(5)",
          optional: true,
          nullable: true,
        },
      ],
    },
  ],
};
