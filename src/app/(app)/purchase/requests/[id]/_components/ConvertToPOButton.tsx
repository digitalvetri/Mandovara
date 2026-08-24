import Link from "next/link";
import type { Route } from "next";

export function ConvertToPOButton({ requestId }: { requestId: string }) {
  return (
    <Link
      href={`/purchase/new?requestId=${requestId}` as Route}
      className="h-[32px] px-4 rounded-[8px] bg-accent text-white text-[12px] font-medium hover:bg-accent/90 transition-colors inline-flex items-center"
    >
      Convert to PO
    </Link>
  );
}
