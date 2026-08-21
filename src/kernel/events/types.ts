// Domain events. Twelve Rules #5:
//
//   "Every mutation emits a domain event. Follow-up rules, WhatsApp
//    triggers, notifications and dashboards subscribe. Nothing hardcodes
//    a side effect."
//
// This file is the ONE union of every event a module may emit. Modules
// import EventOf<T> and DomainEvent from here; automation rules
// (Session 13) and WhatsApp handlers (Session 20) subscribe by type.
//
// New event types are added here first, then to the union at the bottom.

import type { Paise } from "@/kernel/money/paise";

// ── Base ────────────────────────────────────────────────────
export interface EventBase {
  readonly type: string;
  readonly orgId: string;
  readonly actorId: string;
  readonly occurredAt: Date;
}

// ── Sales / quotations ──────────────────────────────────────
export interface QuotationCreatedEvent extends EventBase {
  type: "quotation.created";
  quotationId: string;
  clientId: string;
  total: Paise;
}
export interface QuotationSentEvent extends EventBase {
  type: "quotation.sent";
  quotationId: string;
  clientId: string;
  channel: "whatsapp" | "email";
}
export interface QuotationAcceptedEvent extends EventBase {
  type: "quotation.accepted";
  quotationId: string;
  clientId: string;
}
export interface QuotationExpiredEvent extends EventBase {
  type: "quotation.expired";
  quotationId: string;
}

// ── Orders / dispatch ───────────────────────────────────────
export interface OrderConfirmedEvent extends EventBase {
  type: "order.confirmed";
  orderId: string;
  clientId: string;
  total: Paise;
}
// ── Invoicing / accounts ────────────────────────────────────
export interface InvoiceCreatedEvent extends EventBase {
  type: "invoice.created";
  invoiceId: string;
  clientId: string;
  amount: Paise;
}
export interface InvoiceCancelledEvent extends EventBase {
  type: "invoice.cancelled";
  invoiceId: string;
  clientId: string;
  reason: string;
}
export interface PaymentOverdueEvent extends EventBase {
  type: "payment.overdue";
  invoiceId: string;
  clientId: string;
  daysOverdue: number;
}
export interface ReceiptRecordedEvent extends EventBase {
  type: "receipt.recorded";
  receiptId: string;
  clientId: string;
  amount: Paise;
}

// ── Inventory ───────────────────────────────────────────────
export interface StockBelowReorderEvent extends EventBase {
  type: "stock.belowReorder";
  productId: string;
  warehouseId: string;
  currentQty: string;   // Decimal-as-string; consumers parse as needed
  reorderLevel: string;
}
export interface StockAdjustmentPostedEvent extends EventBase {
  type: "stock.adjustment.posted";
  adjustmentId: string;
  productId: string;
  qtyDelta: string;
  reason: string;
}
export interface GrnPostedEvent extends EventBase {
  type: "grn.posted";
  grnId: string;
  vendorId: string;
  totalValue: Paise;
}

// ── Procurement ─────────────────────────────────────────────
export interface PurchaseOrderIssuedEvent extends EventBase {
  type: "po.issued";
  purchaseOrderId: string;
  vendorId: string;
  total: Paise;
}

// ── Approvals ───────────────────────────────────────────────
export interface ApprovalRequestedEvent extends EventBase {
  type: "approval.requested";
  approvalId: string;
  entityType: string;
  entityId: string;
  approverId: string | null;
}
export interface ApprovalDecidedEvent extends EventBase {
  type: "approval.decided";
  approvalId: string;
  entityType: string;
  entityId: string;
  decision: "APPROVED" | "REJECTED";
  approverId: string;
}

// ── People ──────────────────────────────────────────────────
export interface AttendancePunchedEvent extends EventBase {
  type: "attendance.punched";
  employeeId: string;
  status: string;
}
export interface PayrollFinalizedEvent extends EventBase {
  type: "payroll.finalized";
  payrollRunId: string;
  month: number;
  year: number;
  totalPayable: Paise;
}

// ── Sales / leads ───────────────────────────────────────────
export interface LeadCreatedEvent extends EventBase {
  type: "lead.created";
  leadId: string;
  source: string;
  mobile: string;
}
export interface LeadStatusChangedEvent extends EventBase {
  type: "lead.statusChanged";
  leadId: string;
  from: string;
  to: string;
  lostReason?: string;
}
export interface LeadConvertedEvent extends EventBase {
  type: "lead.converted";
  leadId: string;
  clientId: string;
}

// ── Customers / clients ─────────────────────────────────────
export interface ClientCreatedEvent extends EventBase {
  type: "client.created";
  clientId: string;
  clientType: string;
}
export interface ClientStatusChangedEvent extends EventBase {
  type: "client.statusChanged";
  clientId: string;
  from: string;
  to: string;
  reason?: string;
}

// ── Site visits / measurement / milestones ──────────────────
// The measurement.approved handler ticks the MEASUREMENT milestone AND
// advances the project stage to QUOTATION — see kernel/milestones/listeners.
export interface SiteVisitCompletedEvent extends EventBase {
  type: "siteVisit.completed";
  siteVisitId: string;
  projectId: string;
}
export interface MeasurementSubmittedEvent extends EventBase {
  type: "measurement.submitted";
  measurementId: string;
  projectId: string;
}
export interface MeasurementApprovedEvent extends EventBase {
  type: "measurement.approved";
  measurementId: string;
  projectId: string;
}
// Advance.received carries both the received amount and the required
// threshold — the ADVANCE milestone auto-completes only when total received
// >= required. Partial payments don't tick.
export interface AdvanceReceivedEvent extends EventBase {
  type: "advance.received";
  advanceId: string;
  projectId: string;
  amountReceived: Paise;
  totalReceivedForProject: Paise;
  advanceRequired: Paise;
}
// Grn.received announces material arriving for a specific project family;
// the FABRIC_INWARD / ROLL_INWARD / MATERIAL_INWARD milestones subscribe.
export interface GrnReceivedEvent extends EventBase {
  type: "grn.received";
  grnId: string;
  projectId: string;
  families: readonly string[];
}
export interface AllocationCompleteEvent extends EventBase {
  type: "allocation.complete";
  orderId: string;
  projectId: string;
}
export interface MakeJobQcPassedEvent extends EventBase {
  type: "makeJob.qcPassed";
  makeJobId: string;
  projectId: string;
}
// ── The union ───────────────────────────────────────────────
export type DomainEvent =
  | QuotationCreatedEvent | QuotationSentEvent | QuotationAcceptedEvent | QuotationExpiredEvent
  | OrderConfirmedEvent
  | InvoiceCreatedEvent   | InvoiceCancelledEvent | PaymentOverdueEvent | ReceiptRecordedEvent
  | StockBelowReorderEvent | StockAdjustmentPostedEvent | GrnPostedEvent
  | PurchaseOrderIssuedEvent
  | ApprovalRequestedEvent | ApprovalDecidedEvent
  | AttendancePunchedEvent | PayrollFinalizedEvent
  | LeadCreatedEvent | LeadStatusChangedEvent | LeadConvertedEvent
  | ClientCreatedEvent | ClientStatusChangedEvent
  | SiteVisitCompletedEvent | MeasurementSubmittedEvent | MeasurementApprovedEvent
  | AdvanceReceivedEvent | GrnReceivedEvent | AllocationCompleteEvent
  | MakeJobQcPassedEvent;

export type DomainEventType = DomainEvent["type"];

/** Given a type literal, narrow to just that event's payload. */
export type EventOf<T extends DomainEventType> = Extract<DomainEvent, { type: T }>;
