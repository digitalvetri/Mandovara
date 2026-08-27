// Single source of truth for the client-facing quotation share message.
//
// Both the quotation header (SendChooserModal) and the lead page's
// "Send on WhatsApp" action render from here. Before this module existed
// the body was inline in SendChooserModal; the moment a second surface
// needed it, forking the template would have meant two different
// messages going to clients depending on which screen the operator
// happened to be on.
//
// Pure — no I/O, no React, no server imports. Safe on both sides of the
// client boundary.

export type SendChannel = "whatsapp" | "email" | "copy_link";

export interface ShareMessageInput {
  quotationId:     string;
  quotationNumber: string;
  clientName:      string;
  totalStr:        string;   // BigInt paise as string
  validUntilIso:   string;
  shareToken:      string | null;
  /** window.location.origin — omitted on the server, where links stay relative. */
  origin?:         string | null;
}

export interface ShareMessage {
  link:     string;
  /** Direct application/pdf URL — null until a share token is minted. */
  pdf:      string | null;
  body:     string;
  subject:  string;
  /** null when the client has no email on file. */
  mailHref: (email: string | null) => string | null;
  waHref:   (mobile: string) => string;
}

export function pToINR(paise: string): string {
  try {
    const r = BigInt(paise) / 100n;
    const s = r.toString();
    if (s.length <= 3) return `₹${s}`;
    const l3   = s.slice(-3);
    const rest = s.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ",");
    return `₹${rest},${l3}`;
  } catch { return "₹0"; }
}

export function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Kolkata",
  });
}

export function digitsOnly(m: string): string { return m.replace(/\D+/g, ""); }

export function shortNum(n: string): string {
  const p = n.split("/");
  return p.length >= 2 ? (p.slice(-1)[0] ?? n) : n;
}

export function shareLink(
  quotationId: string,
  shareToken: string | null,
  origin?: string | null,
): string {
  const path = shareToken ? `/q/${shareToken}` : `/quotations/${quotationId}`;
  return origin ? `${origin}${path}` : path;
}

/**
 * Direct link to the rendered PDF.
 *
 * This is what goes in the WhatsApp message (2026-08-27, owner
 * instruction: "the client should receive a PDF, not a link to a page").
 *
 * A wa.me deep link is a URL scheme — it carries text and nothing else,
 * so a true file attachment is impossible without the WhatsApp Cloud API
 * and a Meta-verified INR-billed WABA. What IS possible, and what this
 * does, is hand the client a URL that resolves straight to
 * application/pdf: one tap and their phone opens it in a PDF viewer,
 * ready to save or forward. No page, no buttons, no explanation needed.
 */
export function pdfLink(shareToken: string | null, origin?: string | null): string | null {
  if (!shareToken) return null;
  const path = `/q/${shareToken}/pdf`;
  return origin ? `${origin}${path}` : path;
}

export function buildShareMessage(input: ShareMessageInput): ShareMessage {
  const link  = shareLink(input.quotationId, input.shareToken, input.origin);
  const pdf   = pdfLink(input.shareToken, input.origin);
  const num   = shortNum(input.quotationNumber);
  const total = pToINR(input.totalStr);
  const valid = fmtDate(input.validUntilIso);

  // The PDF is the primary link — that is the document the client wants
  // and the one they will forward to their architect or spouse. The
  // second link is only for accepting, and is labelled so it is obvious
  // which does what. When no token has been minted yet there is no PDF
  // to point at, so the message falls back to the page alone rather than
  // showing a dead line.
  const body = pdf
    ? `Namaste ${input.clientName},\n\n` +
      `Your quotation ${num} is ready. Tap to open the PDF:\n\n` +
      `${pdf}\n\n` +
      `  Total: ${total}\n` +
      `  Valid until: ${valid}\n\n` +
      `To accept it or ask for changes: ${link}\n\n` +
      `— Team Mandovara\n+91 89404 30051 · mandovara.com`
    : `Namaste ${input.clientName},\n\n` +
      `Please find our quotation ${num} at the link below.\n\n` +
      `  Total: ${total}\n` +
      `  Valid until: ${valid}\n\n` +
      `${link}\n\n` +
      `You can accept it or request changes directly on that page.\n\n` +
      `— Team Mandovara\n+91 89404 30051 · mandovara.com`;

  const subject = `Quotation ${num} from Mandovara`;

  return {
    link,
    pdf,
    body,
    subject,
    mailHref: (email) =>
      email
        ? `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
        : null,
    waHref: (mobile) =>
      `https://wa.me/${digitsOnly(mobile)}?text=${encodeURIComponent(body)}`,
  };
}
