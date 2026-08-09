// WhatsApp Cloud API webhook receiver.
//
// GET  — Meta verification handshake (hub.challenge)
// POST — Incoming messages and outbound delivery/read receipts.
//
// Security: every POST is HMAC-SHA256 verified against WHATSAPP_APP_SECRET
// before any DB write (§9, §13).
//
// Service window (§9): when a customer message arrives, we upsert the
// WhatsAppConversation and set serviceWindowExpiresAt = now + 24h. The inbox
// UI shows a live countdown so staff know how long the free reply window lasts.

import { createHmac, timingSafeEqual } from "crypto";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// ── GET: Meta verification handshake ─────────────────────────────────────────

export async function GET(req: Request): Promise<Response> {
  const url       = new URL(req.url);
  const mode      = url.searchParams.get("hub.mode");
  const token     = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  if (
    mode === "subscribe" &&
    token &&
    token === process.env.WHATSAPP_VERIFY_TOKEN &&
    challenge
  ) {
    return new Response(challenge, { status: 200 });
  }
  return new Response("Forbidden", { status: 403 });
}

// ── POST: incoming events ─────────────────────────────────────────────────────

export async function POST(req: Request): Promise<Response> {
  const rawBody = await req.text();

  // HMAC-SHA256 verification — must happen before any DB access
  const sig = req.headers.get("x-hub-signature-256") ?? "";
  if (!verifySignature(rawBody, sig)) {
    return new Response("Unauthorized", { status: 401 });
  }

  let payload: WhatsAppPayload;
  try {
    payload = JSON.parse(rawBody) as WhatsAppPayload;
  } catch {
    return new Response("Bad Request", { status: 400 });
  }

  // Resolve the single tenant's org ID
  const org = await prisma.organization.findFirst({ select: { id: true } });
  if (!org) return new Response("OK", { status: 200 }); // no org yet

  await processPayload(org.id, payload);

  return new Response("OK", { status: 200 });
}

// ── Signature verification ────────────────────────────────────────────────────

function verifySignature(body: string, header: string): boolean {
  const secret = process.env.WHATSAPP_APP_SECRET;
  if (!secret) return false; // fail closed if secret not configured

  const expected = `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;
  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(header));
  } catch {
    return false; // length mismatch → not equal
  }
}

// ── Payload processing ────────────────────────────────────────────────────────

async function processPayload(orgId: string, payload: WhatsAppPayload): Promise<void> {
  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      if (change.field !== "messages") continue;
      const val = change.value;

      // Incoming messages → open / extend 24-hour service window
      for (const msg of val.messages ?? []) {
        const mobile = val.contacts?.[0]?.wa_id ?? msg.from;
        await handleIncomingMessage(orgId, mobile);
      }

      // Status receipts → update AutomationLog delivery/read timestamps
      for (const status of val.statuses ?? []) {
        await handleStatusUpdate(orgId, status);
      }
    }
  }
}

async function handleIncomingMessage(orgId: string, mobile: string): Promise<void> {
  const now             = new Date();
  const serviceExpiry   = new Date(now.getTime() + 24 * 60 * 60 * 1_000); // +24h

  await prisma.whatsAppConversation.upsert({
    where:  { organizationId_mobile: { organizationId: orgId, mobile } },
    create: {
      organizationId:         orgId,
      mobile,
      lastMessageAt:          now,
      serviceWindowExpiresAt: serviceExpiry,
    },
    update: {
      lastMessageAt:          now,
      serviceWindowExpiresAt: serviceExpiry,
    },
  });
}

async function handleStatusUpdate(orgId: string, status: WaStatus): Promise<void> {
  const log = await prisma.automationLog.findFirst({
    where:  { organizationId: orgId, metaMessageId: status.id },
    select: { id: true },
  });
  if (!log) return;

  const ts = new Date(Number(status.timestamp) * 1_000);

  switch (status.status) {
    case "sent":
      await prisma.automationLog.update({
        where: { id: log.id },
        data:  { status: "SENT", sentAt: ts },
      });
      break;
    case "delivered":
      await prisma.automationLog.update({
        where: { id: log.id },
        data:  { status: "DELIVERED", deliveredAt: ts },
      });
      break;
    case "read":
      await prisma.automationLog.update({
        where: { id: log.id },
        data:  { status: "READ", readAt: ts },
      });
      break;
    case "failed":
      await prisma.automationLog.update({
        where: { id: log.id },
        data:  { status: "FAILED", error: status.errors?.[0]?.message ?? "Unknown error" },
      });
      break;
  }
}

// ── WhatsApp Cloud API payload types ─────────────────────────────────────────

interface WhatsAppPayload {
  object: string;
  entry?: WaEntry[];
}

interface WaEntry {
  id:      string;
  changes: WaChange[];
}

interface WaChange {
  field: string;
  value: WaValue;
}

interface WaValue {
  messaging_product: string;
  metadata?:         { display_phone_number: string; phone_number_id: string };
  contacts?:         { profile: { name: string }; wa_id: string }[];
  messages?:         WaMessage[];
  statuses?:         WaStatus[];
}

interface WaMessage {
  from:      string;
  id:        string;
  timestamp: string;
  type:      string;
}

interface WaStatus {
  id:         string;
  status:     "sent" | "delivered" | "read" | "failed";
  timestamp:  string;
  recipient_id: string;
  errors?:    { code: number; message: string }[];
}
