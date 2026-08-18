// Accounts read-model shapes. Split out of queries.ts, which had grown to
// 798 lines — well past the §10 limit.

export interface AgingBucket {
  key:    "current" | "d1_30" | "d31_60" | "d61_90" | "d90p";
  label:  string;
  amount: bigint;
  count:  number;
}

export interface OutstandingInvoiceRow {
  id:           string;
  number:       string;
  date:         Date;
  dueDate:      Date;
  daysOverdue:  number;
  clientId:     string;
  clientName:   string;
  clientMobile: string;
  projectId:    string | null;
  projectName:  string | null;
  total:        bigint;
  paid:         bigint;
  outstanding:  bigint;
  status:       string;
  bucketKey:    AgingBucket["key"];
}

export interface OutstandingClientRow {
  clientId:     string;
  clientName:   string;
  clientMobile: string;
  invoiceCount: number;
  outstanding:  bigint;
  oldestDays:   number;
}

export interface RecentReceiptRow {
  id:          string;
  number:      string;
  date:        Date;
  clientName:  string;
  mode:        string;
  amount:      bigint;
  unallocated: bigint;
  /** Plain-English description of what this payment covers. */
  purpose:     string;
}

export interface PaymentModeSlice {
  mode:   string;   // CASH | UPI | NEFT | RTGS | CHEQUE | CARD
  amount: bigint;
  count:  number;
}

/** One aggregated bucket in the outflow donut. */
export interface OutflowKindSlice {
  kind:   "SALARY" | "EXPENSE" | "PROJECT_EXPENSE";
  label:  string;
  amount: bigint;
  count:  number;
}

/** One row in the recent outflow feed — unified across payslips, expenses, project expenses. */
export interface OutflowRow {
  id:     string;    // prefixed: "pay:xxx" | "exp:xxx" | "prj:xxx"
  kind:   OutflowKindSlice["kind"];
  date:   Date;
  label:  string;    // "Salary — Rajesh (Aug 2026)", "Rent — August", "Site labour — Villa Kannan"
  amount: bigint;
}

/** One month bucket in the Money-in-vs-out chart (§7.1). */
export interface MonthlyInOutPoint {
  monthKey: string;   // YYYY-MM
  label:    string;   // "Aug" or "Jan '26"
  moneyIn:  bigint;
  moneyOut: bigint;
}

/** One head in the Where-the-money-goes ranked bar chart (§7.3).
 *  Top 8 raw heads returned; the caller collapses the tail into "Other". */
export interface ExpenseHeadSlice {
  head:   string;   // "Rent", "Site labour", "Utilities" …
  amount: bigint;
  count:  number;
}

/** Attention strip counts (§5.1 / spec §10). Only surfaces if any > 0. */
export interface AttentionCounts {
  chequesPending: { count: number; amount: bigint };
  expensesPending: { count: number; amount: bigint };
  unmatchedReceipts: { count: number; amount: bigint };
}

/** The 4 KPI cards driving the /accounts Overview header (§5.3). */
export interface MoneyKpis {
  /** TO COLLECT: sum of open invoice balances across all clients. */
  toCollect:       bigint;
  /** Amount within TO COLLECT that is more than 60 days late. */
  toCollectLate60: bigint;
  /** Number of open invoices contributing to TO COLLECT. */
  toCollectCount:  number;

  /** CAME IN: sum of receipts received this month. */
  cameInThis:      bigint;
  /** CAME IN previous period, for the ▲▼ delta. */
  cameInPrev:      bigint;

  /** TO PAY: unpaid POs + approved-unpaid expenses. */
  toPay:           bigint;
  /** Amount within TO PAY due this week (7 days). */
  toPayDueWeek:    bigint;

  /** SPENT: sum of Expense + ProjectExpense + PAID Payslips this month. */
  spentThis:       bigint;
  /** SPENT previous period, for the ▲▼ delta. */
  spentPrev:       bigint;
}

export interface AccountsOverview {
  invoiced:            bigint;
  received:            bigint;
  outstanding:         bigint;
  overdue:             bigint;
  customerCredit:      bigint;
  invoiceCount:        number;
  paidCount:           number;
  overdueCount:        number;
  aging:               AgingBucket[];
  outstandingInvoices: OutstandingInvoiceRow[];
  topClients:          OutstandingClientRow[];
  recentReceipts:      RecentReceiptRow[];
  activeBucket:        AgingBucket["key"] | null;
  /** Last 12 months of payments grouped by payment mode, largest first */
  paymentModes:        PaymentModeSlice[];
  /** The 4 KPI cards for the redesigned Overview (§5.3). */
  moneyKpis:           MoneyKpis;
  /** Money-out summary for the last 12 months. */
  moneyOut: {
    /** Total across all outflow categories, in paise. */
    total:       bigint;
    /** Sum of paid payslip netPay. */
    salary:      bigint;
    /** Sum of Expense.amount. */
    expense:     bigint;
    /** Sum of ProjectExpense.amount. */
    projectExpense: bigint;
    /** Total money in over the same period (for the net line). */
    moneyIn:     bigint;
    /** True if the viewer lacks permission to see any outflow — hide the whole strip. */
    hidden:      boolean;
  };
  /** Outflow donut slices for the last 12 months, largest first. */
  outflowKinds:        OutflowKindSlice[];
  /** 12-month money-in vs money-out for the trend chart. Oldest → newest. */
  monthlyInOut:        MonthlyInOutPoint[];
  /** Top 8 expense heads over the last 12 months. Caller collapses to "Other". */
  expenseHeads:        ExpenseHeadSlice[];
  /** Attention strip counts (cheques / expenses / unmatched receipts). */
  attention:           AttentionCounts;
  /** Last 8 outflows across salary + expense + project expense, newest first. */
  recentOutflows:      OutflowRow[];
}
