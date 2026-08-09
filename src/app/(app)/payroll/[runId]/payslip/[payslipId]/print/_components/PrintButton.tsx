"use client";

// window.print() must live in a client component — the parent
// payslip print page is a server component and RSC refuses onClick
// handlers on server-rendered buttons. Same pattern as the make cut
// sheet's PrintButton.

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="h-[32px] px-4 rounded-[6px] text-[12px] font-medium bg-accent text-white hover:bg-accent-hover"
    >
      Print
    </button>
  );
}
