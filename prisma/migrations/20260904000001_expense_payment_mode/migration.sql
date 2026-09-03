-- Record HOW an overhead expense was paid.
--
-- The expense form captured what was bought, for how much and when, but
-- never the tender. At month end the owner could see ₹40,000 of spend
-- and no way to reconcile it against the cash box, the bank statement
-- or the cheque book — which is the whole point of writing it down.
--
-- Reuses the existing PaymentMode enum (CASH · UPI · NEFT · RTGS ·
-- CHEQUE · CARD) that Receipt and Payment already use, so the accounts
-- screens can render one pill component for every money row.
--
-- Nullable on purpose: rows written before this column existed have no
-- honest answer, and inventing CASH for all of them would corrupt the
-- first reconciliation anyone runs. ProjectExpense is deliberately
-- untouched — it is an approval queue for site costs, not a tender log.

ALTER TABLE "Expense" ADD COLUMN "paymentMode" "PaymentMode";
