-- CreateTable: Milestone — billing-milestone tracker linked to Project
CREATE TABLE "Milestone" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "plannedDate" TIMESTAMP(3) NOT NULL,
    "actualDate" TIMESTAMP(3),
    "billingPct" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "order" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Milestone_pkey" PRIMARY KEY ("id")
);

-- CreateTable: SiteLog — daily site observation log linked to Project
CREATE TABLE "SiteLog" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "loggedAt" TIMESTAMP(3) NOT NULL,
    "summary" TEXT NOT NULL,
    "weather" TEXT,
    "manpowerCount" INTEGER,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SiteLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Milestone_projectId_idx" ON "Milestone"("projectId");

-- CreateIndex
CREATE INDEX "SiteLog_projectId_idx" ON "SiteLog"("projectId");

-- AddForeignKey
ALTER TABLE "Milestone" ADD CONSTRAINT "Milestone_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "Project"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiteLog" ADD CONSTRAINT "SiteLog_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "Project"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
