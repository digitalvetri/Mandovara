"use client";

// One button, two actions: download the invoice PDF, then open a
// WhatsApp chat with the client. The owner drags the just-downloaded
// PDF into WhatsApp Web. Real Meta-media-endpoint attachment needs
// full WABA setup (see spec §13); this is the workaround until then.
//
// No "Namaste …" pre-filled body — the client already knows who's
// sending; the PDF is the message.

import { useState } from "react";
import { MessageCircle, Loader2, CheckCircle2 } from "lucide-react";

interface Props {
  invoiceId:     string;
  invoiceNumber: string;
  clientMobile:  string;
}

export function SendInvoiceOnWhatsAppButton({ invoiceId, invoiceNumber, clientMobile }: Props) {
  const [phase, setPhase] = useState<"idle" | "downloading" | "opened">("idle");

  async function handleClick() {
    setPhase("downloading");
    try {
      // 1. Fetch the PDF and trigger a download via an object URL, so the
      //    file lands in the owner's default downloads folder ready to
      //    drag into WhatsApp Web.
      const res = await fetch(`/api/invoicing/${invoiceId}/pdf`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${invoiceNumber.replace(/[/\\]/g, "_")}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      // Revoke on the next tick so the browser has a chance to grab the blob.
      setTimeout(() => URL.revokeObjectURL(url), 1000);

      // 2. Open WhatsApp chat with a minimal caption — no "Namaste"
      //    templated message; the PDF speaks for itself.
      const digits = clientMobile.replace(/\D/g, "");
      const waNum  = digits.startsWith("91") ? digits : `91${digits}`;
      const caption = encodeURIComponent(`Invoice ${invoiceNumber} — please find the PDF attached.`);
      window.open(`https://wa.me/${waNum}?text=${caption}`, "_blank", "noopener,noreferrer");

      setPhase("opened");
      setTimeout(() => setPhase("idle"), 4000);
    } catch (err) {
      console.error("SendInvoiceOnWhatsApp failed:", err);
      setPhase("idle");
      alert("Could not download the invoice PDF. Try the Download PDF button, then attach manually.");
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={phase === "downloading"}
      className="flex items-center gap-1.5 h-8 px-3 rounded-md bg-[#25D366] text-white text-[12px] font-medium hover:bg-[#1ebe57] disabled:opacity-70 transition-colors"
      title="Downloads the invoice PDF, then opens WhatsApp — drag the file into the chat"
    >
      {phase === "downloading" ? (
        <><Loader2 size={13} className="animate-spin" /> Preparing PDF…</>
      ) : phase === "opened" ? (
        <><CheckCircle2 size={13} /> Drag PDF into chat</>
      ) : (
        <><MessageCircle size={13} strokeWidth={1.75} /> Send on WhatsApp</>
      )}
    </button>
  );
}
