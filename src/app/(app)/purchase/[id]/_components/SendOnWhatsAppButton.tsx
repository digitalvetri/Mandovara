"use client";

import { formatINR } from "@/kernel/money/format";
import { formatDate } from "@/kernel/datetime";
import type { PODetail } from "@/modules/purchase/queries";

interface Props {
  po: PODetail;
}

const UNIT_SHORT: Record<string, string> = {
  METRE: "m", ROLL: "roll", SQFT: "sqft", SQM: "sqm",
  PIECE: "pc", SET: "set", BOX: "box", RUNNING_FT: "rft",
};

export function SendOnWhatsAppButton({ po }: Props) {
  const digits = po.vendorMobile.replace(/\D+/g, "");
  if (!digits) return null;

  function open() {
    const lines = po.lines.map((l, i) => {
      const unit = UNIT_SHORT[l.unit] ?? l.unit.toLowerCase();
      return `${i + 1}. ${l.colourwayCode} — ${l.orderedQty} ${unit}`;
    }).join("\n");

    const parts = [
      `Namaste ${po.vendorName.split(/\s+/)[0]},`,
      "",
      `Please supply against the following purchase order:`,
      "",
      `PO ${po.number}`,
      po.expectedAt ? `Expected by: ${formatDate(po.expectedAt)}` : "",
      "",
      lines,
      "",
      `Total: ${formatINR(po.totalValue)}`,
      "",
      "Kindly acknowledge on WhatsApp and share dispatch details.",
      "",
      "— Mandovara, Coimbatore",
    ].filter(Boolean);

    const url = `https://wa.me/${digits}?text=${encodeURIComponent(parts.join("\n"))}`;
    window.open(url, "_blank", "noopener");
  }

  return (
    <button
      type="button"
      onClick={open}
      className="h-[32px] px-4 rounded-[8px] bg-[#25D366] text-white text-[12px] font-medium hover:bg-[#1ebe57] transition-colors inline-flex items-center gap-1.5"
      aria-label={`Send PO ${po.number} on WhatsApp to ${po.vendorName}`}
    >
      Send on WhatsApp
    </button>
  );
}
