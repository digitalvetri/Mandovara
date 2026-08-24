"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { returnSampleByBookId } from "@/modules/catalog/sample-actions";

export function ReturnBookButton({ bookId }: { bookId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function onClick() {
    start(async () => {
      const r = await returnSampleByBookId(bookId);
      if (r.ok) router.refresh();
      else alert(r.error ?? "Could not return book");
    });
  }

  return (
    <button
      type="button"
      disabled={pending}
      onClick={onClick}
      className="h-[24px] px-2.5 rounded-[4px] text-[10.5px] font-medium bg-text-dim/12 text-text-dim hover:bg-text-dim/20 transition-colors disabled:opacity-60 whitespace-nowrap"
    >
      Return
    </button>
  );
}
