import { Topbar } from "@/components/layout/Topbar";
import { devContext } from "@/lib/dev-context";
import { scoped } from "@/kernel/db/scoped";
import { EstimateBuilder } from "./_components/EstimateBuilder";

export const dynamic = "force-dynamic";

export default async function EstimatePage() {
  const ctx = await devContext();
  const db  = scoped(ctx);
  const branches = await db.branch.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } });

  return (
    <>
      <Topbar
        title="Quick estimate"
        eyebrow="Write a formal price without picking anything from the catalogue"
      />
      <p className="text-[12.5px] text-text-muted max-w-[72ch] mb-5">
        For a website or phone enquiry, when you want to send a price today.
        Describe each item in your own words and set a rate — no product,
        project or measurement needed. It prints as an <strong>Estimate</strong>,
        so the client can tell it apart from a measured quotation, and you can
        turn it into a full quotation once you have been to site.
      </p>
      <EstimateBuilder branches={branches} />
    </>
  );
}
