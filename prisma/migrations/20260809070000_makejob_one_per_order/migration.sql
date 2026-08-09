-- One make job per sales order — DB-level guard so a race between
-- two parallel createMakeJobFromOrder calls can't both pass the
-- app-level uniqueness check and stack jobs.

CREATE UNIQUE INDEX "MakeJob_salesOrderId_key" ON "MakeJob"("salesOrderId");
