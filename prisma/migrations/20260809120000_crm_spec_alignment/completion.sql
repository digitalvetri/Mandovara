-- Completion script — run after migration.sql partial application.
-- Creates PermScope enum + 19 missing tables + foreign keys.

CREATE TYPE "PermScope" AS ENUM ('NONE', 'VIEW', 'OWN', 'FULL');

CREATE TABLE "Department" (
  "id"             TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "name"           TEXT NOT NULL,
  "headEmployeeId" TEXT,
  CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RolePermission" (
  "id"     TEXT NOT NULL,
  "roleId" TEXT NOT NULL,
  "key"    TEXT NOT NULL,
  "scope"  "PermScope" NOT NULL DEFAULT 'NONE',
  CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProjectMember" (
  "id"            TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "projectId"     TEXT NOT NULL,
  "userId"        TEXT NOT NULL,
  "roleOnProject" TEXT,
  CONSTRAINT "ProjectMember_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SiteVisit" (
  "id"              TEXT NOT NULL,
  "organizationId"  TEXT NOT NULL,
  "number"          TEXT NOT NULL,
  "projectId"       TEXT,
  "leadId"          TEXT,
  "purpose"         "VisitPurpose" NOT NULL,
  "scheduledAt"     TIMESTAMP(3) NOT NULL,
  "assignedToId"    TEXT NOT NULL,
  "status"          "VisitStatus" NOT NULL DEFAULT 'SCHEDULED',
  "startedAt"       TIMESTAMP(3),
  "completedAt"     TIMESTAMP(3),
  "checkInLat"      DECIMAL(10,7),
  "checkInLng"      DECIMAL(10,7),
  "observations"    TEXT,
  "customerNotes"   TEXT,
  "photoKeys"       TEXT[],
  "rescheduleReason" TEXT,
  "reportPdfKey"    TEXT,
  CONSTRAINT "SiteVisit_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PurchaseRequest" (
  "id"              TEXT NOT NULL,
  "organizationId"  TEXT NOT NULL,
  "number"          TEXT NOT NULL,
  "projectId"       TEXT,
  "raisedById"      TEXT NOT NULL,
  "reason"          TEXT NOT NULL,
  "neededBy"        TIMESTAMP(3),
  "status"          "RequestStatus" NOT NULL DEFAULT 'DRAFT',
  "approvedById"    TEXT,
  "approvedAt"      TIMESTAMP(3),
  "rejectionReason" TEXT,
  CONSTRAINT "PurchaseRequest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PurchaseRequestLine" (
  "id"             TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "requestId"      TEXT NOT NULL,
  "colourwayId"    TEXT,
  "freeTextItem"   TEXT,
  "quantity"       DECIMAL(12,3) NOT NULL,
  "unit"           "SellUnit" NOT NULL,
  CONSTRAINT "PurchaseRequestLine_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Payment" (
  "id"             TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "number"         TEXT NOT NULL,
  "direction"      "PayDirection" NOT NULL,
  "clientId"       TEXT,
  "vendorId"       TEXT,
  "projectId"      TEXT,
  "date"           TIMESTAMP(3) NOT NULL,
  "mode"           "PaymentMode" NOT NULL,
  "reference"      TEXT,
  "chequeStatus"   "ChequeStatus",
  "chequeDate"     TIMESTAMP(3),
  "amount"         BIGINT NOT NULL,
  "unallocated"    BIGINT NOT NULL DEFAULT 0,
  CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PaymentAllocation" (
  "id"              TEXT NOT NULL,
  "organizationId"  TEXT NOT NULL,
  "paymentId"       TEXT NOT NULL,
  "invoiceId"       TEXT,
  "purchaseOrderId" TEXT,
  "amount"          BIGINT NOT NULL,
  CONSTRAINT "PaymentAllocation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Holiday" (
  "id"             TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "date"           DATE NOT NULL,
  "name"           TEXT NOT NULL,
  CONSTRAINT "Holiday_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LeaveBalance" (
  "id"             TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "employeeId"     TEXT NOT NULL,
  "year"           INTEGER NOT NULL,
  "type"           "LeaveType" NOT NULL,
  "entitled"       DECIMAL(4,1) NOT NULL,
  "used"           DECIMAL(4,1) NOT NULL DEFAULT 0,
  CONSTRAINT "LeaveBalance_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Task" (
  "id"             TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "number"         TEXT NOT NULL,
  "title"          TEXT NOT NULL,
  "description"    TEXT,
  "projectId"      TEXT,
  "refType"        TEXT,
  "refId"          TEXT,
  "assignedToId"   TEXT NOT NULL,
  "createdById"    TEXT NOT NULL,
  "dueAt"          TIMESTAMP(3),
  "priority"       "TaskPriority" NOT NULL DEFAULT 'NORMAL',
  "status"         "TaskStatus" NOT NULL DEFAULT 'TODO',
  "completedAt"    TIMESTAMP(3),
  CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TaskComment" (
  "id"             TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "taskId"         TEXT NOT NULL,
  "authorId"       TEXT NOT NULL,
  "body"           TEXT NOT NULL,
  "fileKeys"       TEXT[],
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TaskComment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ChatChannel" (
  "id"             TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "kind"           "ChannelKind" NOT NULL,
  "name"           TEXT,
  "projectId"      TEXT,
  "departmentId"   TEXT,
  "createdById"    TEXT NOT NULL,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ChatChannel_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ChatMember" (
  "id"             TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "channelId"      TEXT NOT NULL,
  "userId"         TEXT NOT NULL,
  "lastReadAt"     TIMESTAMP(3),
  "isMuted"        BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT "ChatMember_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ChatMessage" (
  "id"             TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "channelId"      TEXT NOT NULL,
  "authorId"       TEXT NOT NULL,
  "body"           TEXT,
  "fileKeys"       TEXT[],
  "replyToId"      TEXT,
  "editedAt"       TIMESTAMP(3),
  "deletedAt"      TIMESTAMP(3),
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CalendarEvent" (
  "id"              TEXT NOT NULL,
  "organizationId"  TEXT NOT NULL,
  "kind"            "EventKind" NOT NULL,
  "title"           TEXT NOT NULL,
  "refType"         TEXT,
  "refId"           TEXT,
  "startAt"         TIMESTAMP(3) NOT NULL,
  "endAt"           TIMESTAMP(3),
  "allDay"          BOOLEAN NOT NULL DEFAULT false,
  "attendeeUserIds" TEXT[],
  "location"        TEXT,
  CONSTRAINT "CalendarEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Document" (
  "id"             TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "ownerType"      TEXT NOT NULL,
  "ownerId"        TEXT NOT NULL,
  "projectId"      TEXT,
  "leadId"         TEXT,
  "category"       TEXT NOT NULL,
  "fileKey"        TEXT NOT NULL,
  "fileName"       TEXT NOT NULL,
  "mimeType"       TEXT NOT NULL,
  "sizeBytes"      INTEGER NOT NULL,
  "uploadedById"   TEXT NOT NULL,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Notification" (
  "id"             TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "userId"         TEXT NOT NULL,
  "title"          TEXT NOT NULL,
  "body"           TEXT NOT NULL,
  "refType"        TEXT,
  "refId"          TEXT,
  "channels"       "NotifyChannel"[],
  "readAt"         TIMESTAMP(3),
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CommunicationLog" (
  "id"               TEXT NOT NULL,
  "organizationId"   TEXT NOT NULL,
  "idempotencyKey"   TEXT NOT NULL,
  "channel"          "NotifyChannel" NOT NULL,
  "templateId"       TEXT,
  "category"         "MsgCategory",
  "toMobile"         TEXT,
  "toEmail"          TEXT,
  "clientId"         TEXT,
  "leadId"           TEXT,
  "projectId"        TEXT,
  "direction"        TEXT NOT NULL DEFAULT 'OUT',
  "body"             TEXT,
  "status"           "MsgStatus" NOT NULL DEFAULT 'QUEUED',
  "providerMessageId" TEXT,
  "costPaise"        BIGINT NOT NULL DEFAULT 0,
  "error"            TEXT,
  "sentAt"           TIMESTAMP(3),
  "deliveredAt"      TIMESTAMP(3),
  "readAt"           TIMESTAMP(3),
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CommunicationLog_pkey" PRIMARY KEY ("id")
);

-- Indexes

CREATE UNIQUE INDEX "Department_organizationId_name_key" ON "Department"("organizationId", "name");
CREATE UNIQUE INDEX "Role_organizationId_name_key" ON "Role"("organizationId", "name");
CREATE UNIQUE INDEX "RolePermission_roleId_key_key" ON "RolePermission"("roleId", "key");
CREATE UNIQUE INDEX "ProjectMember_projectId_userId_key" ON "ProjectMember"("projectId", "userId");
CREATE INDEX "SiteVisit_organizationId_assignedToId_scheduledAt_idx" ON "SiteVisit"("organizationId", "assignedToId", "scheduledAt");
CREATE UNIQUE INDEX "SiteVisit_organizationId_number_key" ON "SiteVisit"("organizationId", "number");
CREATE INDEX "PurchaseRequest_organizationId_status_idx" ON "PurchaseRequest"("organizationId", "status");
CREATE UNIQUE INDEX "PurchaseRequest_organizationId_number_key" ON "PurchaseRequest"("organizationId", "number");
CREATE INDEX "Payment_organizationId_direction_date_idx" ON "Payment"("organizationId", "direction", "date");
CREATE UNIQUE INDEX "Payment_organizationId_number_key" ON "Payment"("organizationId", "number");
CREATE INDEX "PaymentAllocation_invoiceId_idx" ON "PaymentAllocation"("invoiceId");
CREATE UNIQUE INDEX "Holiday_organizationId_date_key" ON "Holiday"("organizationId", "date");
CREATE UNIQUE INDEX "LeaveBalance_employeeId_year_type_key" ON "LeaveBalance"("employeeId", "year", "type");
CREATE INDEX "Task_organizationId_assignedToId_status_idx" ON "Task"("organizationId", "assignedToId", "status");
CREATE UNIQUE INDEX "Task_organizationId_number_key" ON "Task"("organizationId", "number");
CREATE INDEX "ChatChannel_organizationId_kind_idx" ON "ChatChannel"("organizationId", "kind");
CREATE UNIQUE INDEX "ChatMember_channelId_userId_key" ON "ChatMember"("channelId", "userId");
CREATE INDEX "ChatMessage_channelId_createdAt_idx" ON "ChatMessage"("channelId", "createdAt");
CREATE INDEX "CalendarEvent_organizationId_startAt_idx" ON "CalendarEvent"("organizationId", "startAt");
CREATE INDEX "Document_organizationId_ownerType_ownerId_idx" ON "Document"("organizationId", "ownerType", "ownerId");
CREATE INDEX "Notification_organizationId_userId_readAt_idx" ON "Notification"("organizationId", "userId", "readAt");
CREATE UNIQUE INDEX "CommunicationLog_idempotencyKey_key" ON "CommunicationLog"("idempotencyKey");
CREATE INDEX "CommunicationLog_organizationId_createdAt_idx" ON "CommunicationLog"("organizationId", "createdAt");
CREATE INDEX "CommunicationLog_organizationId_clientId_idx" ON "CommunicationLog"("organizationId", "clientId");
CREATE INDEX "AuditLog_organizationId_actorId_createdAt_idx" ON "AuditLog"("organizationId", "actorId", "createdAt");

-- Foreign keys

ALTER TABLE "Department" ADD CONSTRAINT "Department_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Role" ADD CONSTRAINT "Role_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "User" ADD CONSTRAINT "User_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProjectMember" ADD CONSTRAINT "ProjectMember_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SiteVisit" ADD CONSTRAINT "SiteVisit_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PurchaseRequestLine" ADD CONSTRAINT "PurchaseRequestLine_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "PurchaseRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Allocation" ADD CONSTRAINT "Allocation_orderLineId_fkey" FOREIGN KEY ("orderLineId") REFERENCES "OrderLine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PaymentAllocation" ADD CONSTRAINT "PaymentAllocation_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TaskComment" ADD CONSTRAINT "TaskComment_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChatMember" ADD CONSTRAINT "ChatMember_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "ChatChannel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "ChatChannel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
