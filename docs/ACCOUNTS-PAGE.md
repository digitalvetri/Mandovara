# ACCOUNTS & PAYMENTS — Page Redesign Specification

**Mandovara CRM** · DigitalVetri.AI · Version 1.0
**Primary user:** Rohit Mandovara, Owner. Not an accountant.

> Drop this at `docs/ACCOUNTS-PAGE.md`. The paste-ready prompt is in §14.

---

## 1. The problem with the current page

The page was built by someone who understands accounting, for someone who does not. It presents **data** and expects the owner to interpret it. He opens it, sees ledgers and allocations and ageing buckets, and closes it.

A money page for a business owner has exactly one job: **answer his questions in the order he asks them.** He does not think in receivables and payables. He thinks:

1. *Am I okay?*
2. *Who owes me money, and who do I chase today?*
3. *Did anything come in?*
4. *What am I spending?*
5. *Can I pay my people this month?*

Everything below follows from answering those five questions, in that order, in that language.

---

## 2. Design principles

**1 · Answer questions, never present data.**
Not "Accounts Receivable: ₹8,42,000". Instead: *"₹8,42,000 to collect — ₹2,10,000 of it is more than 60 days old."*

**2 · Every number is a door.**
Tap any figure and land on the list behind it, already filtered. No number is a dead end.

**3 · Every number carries an action.**
A report tells you outstanding is high. A tool gives you a **Send reminder** button beside the client's name. Build the tool.

**4 · Plain Tamil-English, no accounting vocabulary.**
See §3. If a word would confuse someone who has never used accounting software, it does not appear on screen.

**5 · Graphs only where a graph answers better than a number.**
Four charts on the whole page. Each answers one specific question. No chart exists for decoration — see §7.

**6 · Phone first.**
Rohit checks this before he reaches the showroom, on a phone, one-handed. The phone layout is the real design; desktop is the roomy version.

**7 · Explain itself on first use.**
Every card has a `?` giving one plain sentence. Empty states say what will appear here and why. He should never need to be taught this page.

---

## 3. Plain-language dictionary — enforce everywhere

| Never show this | Show this instead |
|---|---|
| Accounts Receivable | **To collect** |
| Accounts Payable | **To pay** |
| Outstanding / Debtors | **Money owed to you** |
| Ageing / Ageing bucket | **How long they've owed** |
| Allocation | **Which bills this payment covers** |
| Unallocated / On account | **Extra amount kept for later bills** |
| Credit note | **Amount returned to client** |
| Advance | **Money taken before work started** |
| Reconciliation | **Matching payments to bills** |
| Debit / Credit | *(never appears)* |
| Ledger | **History** |
| Overdue by 45 days | **45 days late** |

Put this mapping in a constants file so no screen drifts back to accounting language.

---

## 4. Page structure

Five tabs. The first one answers everything; the rest are where he goes when he wants detail.

```
Overview  ·  To Collect  ·  Received  ·  To Pay  ·  Spending
```

Not "Receivables / Payables / Journal". Tabs named for what he wants to do.

---

## 5. Tab 1 — Overview

### 5.1 Desktop layout

```
┌──────────────────────────────────────────────────────────────────────────┐
│  Money                                        [This month ▾]  [Export]   │
│  ─────────────────────────────────────────────────────────────────────   │
│                                                                          │
│  ┌────────────────┐ ┌────────────────┐ ┌───────────────┐ ┌────────────┐ │
│  │ TO COLLECT   ? │ │ CAME IN      ? │ │ TO PAY      ? │ │ SPENT    ? │ │
│  │                │ │                │ │               │ │            │ │
│  │  ₹8,42,000     │ │  ₹3,15,000     │ │  ₹1,90,000    │ │ ₹2,40,000  │ │
│  │                │ │                │ │               │ │            │ │
│  │ ₹2,10,000 is   │ │ ▲ 18% vs last  │ │ ₹40,000 due   │ │ ▼ 6% vs    │ │
│  │ 60+ days late  │ │ month          │ │ this week     │ │ last month │ │
│  └────────────────┘ └────────────────┘ └───────────────┘ └────────────┘ │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │  ⚡ CHASE THESE 5 TODAY                            View all 23 →   │ │
│  │────────────────────────────────────────────────────────────────────│ │
│  │  ALILA                    ₹1,80,000   72 days late                 │ │
│  │  Last spoke 12 days ago              [ WhatsApp ] [ Got paid ]     │ │
│  │────────────────────────────────────────────────────────────────────│ │
│  │  Dr Kannan — Villa        ₹  95,000   45 days late                 │ │
│  │  Promised 20 Aug ⏰                    [ WhatsApp ] [ Got paid ]    │ │
│  │────────────────────────────────────────────────────────────────────│ │
│  │  … 3 more                                                          │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
│  ┌─────────────────────────────────┐ ┌────────────────────────────────┐ │
│  │  MONEY IN vs MONEY OUT          │ │  HOW LONG THEY'VE OWED         │ │
│  │  (12 months, bars)              │ │  (stacked bar, 4 buckets)      │ │
│  └─────────────────────────────────┘ └────────────────────────────────┘ │
│                                                                          │
│  ┌─────────────────────────────────┐ ┌────────────────────────────────┐ │
│  │  WHERE THE MONEY GOES           │ │  HOW PEOPLE PAY YOU            │ │
│  │  (expense heads, ranked bars)   │ │  (UPI / Cash / Bank / Cheque)  │ │
│  └─────────────────────────────────┘ └────────────────────────────────┘ │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │  NEEDS YOUR ATTENTION                                              │ │
│  │  ● 2 cheques not yet cleared            ₹1,20,000    →             │ │
│  │  ● 3 expenses waiting for approval      ₹  18,400    →             │ │
│  │  ● 1 payment not matched to any bill    ₹  25,000    →             │ │
│  └────────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────┘
```

### 5.2 Phone layout — the real design

```
┌──────────────────────┐
│  Money    [Aug ▾]    │
│──────────────────────│
│ ┌──────────────────┐ │
│ │ TO COLLECT     ? │ │
│ │                  │ │
│ │   ₹8,42,000      │ │  ← Fraunces, large
│ │                  │ │
│ │ ₹2,10,000 is     │ │
│ │ 60+ days late    │ │
│ └──────────────────┘ │
│                      │
│ ┌────────┐┌────────┐ │
│ │CAME IN ││ SPENT  │ │
│ │₹3.15L  ││ ₹2.40L │ │
│ │▲18%    ││ ▼6%    │ │
│ └────────┘└────────┘ │
│                      │
│ ⚡ CHASE TODAY       │
│ ┌──────────────────┐ │
│ │ ALILA            │ │
│ │ ₹1,80,000        │ │
│ │ 72 days late     │ │
│ │ [WA]  [Got paid] │ │  ← both ≥56px
│ └──────────────────┘ │
│ ┌──────────────────┐ │
│ │ Dr Kannan        │ │
│ │ ₹95,000 · 45 d   │ │
│ │ ⏰ Promised 20 Aug│ │
│ │ [WA]  [Got paid] │ │
│ └──────────────────┘ │
│      View all 23 →   │
│                      │
│ [ MONEY IN vs OUT ]  │
│ [ HOW LONG OWED   ]  │
│ [ WHERE IT GOES   ]  │
│                      │
│ ⚠ NEEDS ATTENTION 3  │
└──────────────────────┘
```

**Phone rules:** *To collect* is the hero and gets a full-width card. The other three sit in a 2×2. Charts collapse to tappable cards that expand full-screen. Every action button ≥56px.

### 5.3 The four cards — exact definitions

| Card | Number | Sub-line | `?` explanation | Taps to |
|---|---|---|---|---|
| **To collect** | Σ (invoice total − allocated) where status ≠ CANCELLED | *"₹X is 60+ days late"* in `--color-fault` when > 0 | "Money your clients still owe you across all unpaid bills." | To Collect tab |
| **Came in** | Σ payments received, direction INBOUND, in period | ▲▼ vs previous period | "Money you actually received this month, including advances." | Received tab |
| **To pay** | Σ vendor bills unpaid + approved expenses unpaid | *"₹X due this week"* | "Money you owe vendors and staff expenses that are approved but not yet paid." | To Pay tab |
| **Spent** | Σ expenses + vendor payments, in period | ▲▼ vs previous period | "Everything that went out — materials, vendors, salaries, site costs." | Spending tab |

Every card: number in Fraunces, label in 11px caps, sub-line 12px. `?` opens a one-sentence tooltip. **No card shows a number without context** — a bare figure is the thing he cannot interpret.

---

## 6. The Chase List — the most valuable element on the page

This is the difference between a report and a tool. It answers *"who do I call today?"* without him working it out.

### 6.1 Ranking

```
score = outstandingAmount × daysLateWeight × contactPenalty

daysLateWeight:  0–15 days   → 0.5
                 16–30 days  → 1.0
                 31–60 days  → 2.0
                 61–90 days  → 3.5
                 90+ days    → 5.0

contactPenalty:  contacted today            → 0     (drop off the list)
                 contacted in last 2 days   → 0.3
                 contacted in last 7 days   → 0.7
                 not contacted in 7+ days   → 1.5

SUPPRESS entirely when:
  · a promise-to-pay date exists and is in the future
  · the invoice is disputed
  · the client is flagged "do not chase" by the owner
```

Show the top 5. `View all 23 →` opens the full list.

### 6.2 Promise to pay — build this, it is missing from most systems

When Rohit calls and the client says *"next Tuesday"*, he taps **Promised** and picks a date. That client drops off the chase list until then, and reappears — flagged `⏰ Promised 20 Aug` — if the date passes without payment.

Without this he chases the same person three times in a week and the list stops being trustworthy.

### 6.3 Row actions

| Action | What happens |
|---|---|
| **WhatsApp** | Sends the pre-approved reminder template with the amount, the bill number and a UPI payment link. One tap. Logs to `CommunicationLog` as a utility message. |
| **Got paid** | Opens the record-payment sheet (§8), amount pre-filled with the full outstanding |
| **Promised** | Date picker; suppresses the row until that date |
| **Call** | `tel:` link, logs the attempt |
| Row body | Opens the client's money history |

---

## 7. The four charts — each answers one question

No chart exists unless it answers better than a number would.

### 7.1 Money in vs money out — *"Am I growing?"*

Grouped vertical bars, 12 months. Green in, muted out. A thin line for net. Tap a month → that month's transactions.
**Why a chart:** trend and seasonality are invisible in a table. Mandovara's business is seasonal — festivals, wedding season, new-home handovers — and he should be able to see it.

### 7.2 How long they've owed — *"How bad is my outstanding?"*

One stacked horizontal bar, four segments:

```
 Not yet due    0–30 late    31–60 late    60+ late
├────────────┼──────────┼────────┼──────┤
  ₹4,10,000    ₹1,50,000  ₹72,000  ₹2,10,000
    green        amber     orange    red
```

Tap a segment → that bucket's invoices.
**Why a chart:** ₹8,42,000 outstanding means nothing on its own. ₹8,42,000 with a quarter of it 60+ days late means something specific and alarming.

### 7.3 Where the money goes — *"What am I spending on?"*

Ranked horizontal bars, top 8 expense heads, "Other" collapsed. **Not a pie chart** — humans cannot compare pie slices, and ranked bars are read instantly.
Toggle: this month / last 3 months / this year. Tap a bar → those expenses.

### 7.4 How people pay you — *"Am I getting paid in ways that work?"*

Four bars: UPI · Cash · Bank transfer · Cheque, by value for the period.
**Why it matters:** if cheques are 40% of collections, that is float and bounce risk. If cash is high, that is a different conversation. This one chart tells him something he probably does not currently know.

**Chart rules:** no 3D, no gradients, no animation beyond a 240ms draw-in, disabled under `prefers-reduced-motion`. Every value in Indian format. Every chart tappable through to its data. Every chart has a plain-English title, never "AR Ageing Analysis".

---

## 8. Recording a payment — three taps

The most-used action on this page. It must be faster than writing it in a book, or he will keep writing it in a book.

```
┌──────────────────────────────┐
│  Got paid from ALILA         │
│──────────────────────────────│
│  How much?                   │
│  ┌────────────────────────┐  │
│  │ ₹ 1,80,000             │  │ ← pre-filled with full outstanding
│  └────────────────────────┘  │
│         [Full] [Part]        │
│                              │
│  How?                        │
│  [ UPI ][ Cash ][ Bank ]     │  ← big buttons, not a dropdown
│  [ Cheque ][ Card ]          │
│                              │
│  Reference (optional)        │
│  ┌────────────────────────┐  │
│  └────────────────────────┘  │
│                              │
│  ── This will clear ──       │
│  ✓ Bill MDV/INV-2607-0088    │
│    ₹1,20,000                 │
│  ✓ Bill MDV/INV-2608-0102    │
│    ₹60,000                   │
│         [Change ▾]           │
│                              │
│  ┌────────────────────────┐  │
│  │      RECORD PAYMENT    │  │ ← gold, ≥56px
│  └────────────────────────┘  │
└──────────────────────────────┘
```

**Behaviour:**

- Auto-allocates **oldest bill first**, and shows exactly which bills it clears in plain words. `Change` lets him re-allocate manually.
- Extra money beyond the bills is labelled **"₹25,000 extra — kept for future bills"**, never "unallocated".
- **Cheque** reveals a cheque date and sets status `Not yet cleared`. It appears in *Needs your attention* until cleared, and if it bounces, every allocation reverses and each bill's outstanding restores exactly.
- On save: success toast with **Undo** for 8 seconds, WhatsApp receipt offered to the client, chase list refreshes.
- Allocation is stored as explicit rows. **Never subtract from a bill's balance column** — that is how the ledger and the invoice start disagreeing.

---

## 9. The other four tabs

### To Collect
Client-grouped list, sorted by chase score. Per client: name, total owed, oldest bill age, last contact, promise date. Expand → individual bills. Filters: age bucket, project, amount band. Bulk action: **send reminders to all 60+ days late** with a preview of every message before sending.

### Received
Every payment in, newest first. Columns: date, client, `amount`, how paid, reference, which bills it cleared, recorded by. Filter by date, mode, client. Export to Excel. Cheque status visible and editable inline.

### To Pay
Two groups: **Vendor bills** and **Staff expenses awaiting payment**. Each shows due date and days remaining, red when overdue. Approve-and-pay in one action where permitted.

### Spending
Expenses list plus the *where the money goes* chart. Group by head, by project, by month. **Project expenses show against their project's value**, so he can see a job running hot before it finishes. Approval queue at the top when items are pending.

---

## 10. Explain itself on first use

He should never need to be taught this page.

1. **`?` on every card and chart** — one plain sentence, no jargon. "Money your clients still owe you across all unpaid bills."
2. **A 5-step tour on first visit** — the four cards, the chase list, recording a payment. Skippable, replayable from the header, never shown twice unless asked.
3. **Empty states that teach.** Not "No data". Instead: *"No pending payments. When you raise a bill and the client hasn't paid, they'll appear here so you can follow up."*
4. **Sub-lines everywhere.** A number without context is the thing he cannot use. Every figure carries a comparison, a share, or a warning.
5. **Colour with meaning, always with a word.** Red never appears without "late" beside it. Never colour alone.

---

## 11. Permissions

| Role | Sees |
|---|---|
| **OWNER** | Everything, all tabs, all actions |
| **ACCOUNTS** | Everything except owner-only approvals |
| **SALES / DESIGNER** | Only their own clients' outstanding, and only on the client record — **not this page** |
| **Everyone else** | No access. Nav item absent, route returns 403. |

Enforce server-side. A hidden nav item is presentation, not authorisation. Write the test that proves a Store Keeper's GET returns 403.

---

## 12. Data and performance

**Queries must be pre-aggregated.** Do not compute outstanding by loading every invoice into the app.

```sql
-- materialised view, refreshed on invoice/payment mutation
CREATE MATERIALIZED VIEW client_outstanding AS
SELECT i."clientId",
       SUM(i.total - COALESCE(a.allocated,0))                    AS outstanding,
       SUM(...) FILTER (WHERE age <= 30)                         AS bucket_0_30,
       SUM(...) FILTER (WHERE age BETWEEN 31 AND 60)             AS bucket_31_60,
       SUM(...) FILTER (WHERE age BETWEEN 61 AND 90)             AS bucket_61_90,
       SUM(...) FILTER (WHERE age > 90)                          AS bucket_90_plus,
       MAX(i."dueDate")                                          AS oldest_due
FROM "Invoice" i
LEFT JOIN (SELECT "invoiceId", SUM(amount) allocated
           FROM "PaymentAllocation" GROUP BY 1) a ON a."invoiceId" = i.id
WHERE i.status <> 'CANCELLED'
GROUP BY i."clientId";
```

**Budgets:** Overview loads in **under 1.5 seconds** with 24 months of data on a mid-range Android over 4G. Charts stream in after the cards — the four numbers appear first, because those are what he came for.

---

## 13. Tests

- Outstanding matches a hand calculation on seeded data
- Ageing correct at exact boundaries — day 30, 31, 60, 61, 90, 91
- One payment settling three bills leaves the right residual, stored as allocation rows
- Bounced cheque reverses every allocation and restores each bill exactly
- Chase score suppresses a client with a future promise date, and resurfaces them after it passes
- Bulk reminder previews every message before sending, and is idempotent on retry
- A Store Keeper GET on this route returns 403
- No accounting term from §3 appears anywhere in the rendered UI (snapshot test against the banned-word list)
- Overview under 1.5s with 24 months of seed data

---

## 14. The prompt

````
Rebuild the ACCOUNTS & PAYMENTS page exactly as specified in
docs/ACCOUNTS-PAGE.md. Read CLAUDE.md and that file in full first.

WHO YOU ARE BUILDING FOR
Rohit Mandovara, the owner. He is not an accountant and does not want to
become one. He opens this on his phone before reaching the showroom and needs
five answers: am I okay · who do I chase today · did anything come in · what
am I spending · can I pay my people. Nothing else on this page matters.

The current page presents data and expects him to interpret it. He does not.
That is the defect you are fixing.

BUILD
  1. Five tabs: Overview · To Collect · Received · To Pay · Spending
  2. Four summary cards (§5.3) — every number with a plain-English sub-line
     giving it context, and a "?" with a one-sentence explanation
  3. THE CHASE LIST (§6) — top 5 clients to chase today, ranked by the
     algorithm given, with WhatsApp / Got paid / Promised actions on each row.
     This is the most important element on the page. Build it first.
  4. Promise-to-pay: record a date, suppress that client until it passes
  5. Four charts (§7), each answering one named question. Ranked bars, not
     pie charts. Every chart tappable through to its data.
  6. Record-payment sheet (§8) — three taps, auto-allocates oldest bill first,
     shows in plain words which bills it clears, "extra kept for future bills"
     never "unallocated"
  7. Cheque tracking with bounce reversal that restores every bill exactly
  8. First-run tour, "?" tooltips, teaching empty states (§10)

NON-NEGOTIABLE
  - Use the plain-language dictionary in §3. No accounting vocabulary reaches
    the screen. Put the mapping in a constants file and write a snapshot test
    that fails if a banned word appears in the rendered UI.
  - Every number is tappable through to the list behind it. No dead ends.
  - Every row carries an action. This is a tool, not a report.
  - Payment allocation stored as explicit rows. NEVER subtract from an
    invoice balance column.
  - Phone layout is the real design (§5.2). Action buttons ≥56px.
  - Sovereign tokens. One gold element per screen. All numerals Geist Mono
    with tabular-nums, Indian format ₹8,42,000.
  - Permissions server-side (§11).
  - Pre-aggregate outstanding via a materialised view (§12). Do not load every
    invoice into the app to compute a total.

BEFORE WRITING CODE, give me:
  - ASCII wireframes of the Overview at 1440px and 390px
  - The chase-score function in pseudocode
  - Your query plan for the four summary cards
I want to review those before you build.

GATE — do not report done without pasting:
  1. Test output including the banned-word snapshot test
  2. Screenshots of Overview at 1440px and 390px with realistic seed data
  3. A screen recording or step-by-step of recording a ₹1,80,000 payment that
     settles three bills and leaves a residual
  4. Measured load time for Overview with 24 months of seed data
````

---

## 15. Definition of done

- [ ] Five tabs, named for what the owner wants to do
- [ ] Four cards, each with context sub-line and `?` explanation
- [ ] Chase list ranked correctly, with WhatsApp, Got paid and Promised
- [ ] Promise-to-pay suppresses and resurfaces correctly
- [ ] Four charts, each tappable through to data
- [ ] Payment recorded in three taps, allocation shown in plain words
- [ ] Cheque bounce reverses allocations and restores bills exactly
- [ ] No banned accounting term anywhere in the UI (test enforced)
- [ ] Every number tappable, every row actionable
- [ ] Phone layout verified on a real device
- [ ] Permissions enforced server-side, proved by test
- [ ] Overview under 1.5s with 24 months of data
- [ ] First-run tour, tooltips, teaching empty states

---

## 16. The one thing to get right

If you build only one element on this page properly, build **the chase list**.

Every accounting screen in every SME product in India shows an outstanding total. None of them tells the owner *who to call this morning*. That single card — five names, five amounts, five WhatsApp buttons — is the difference between a page Rohit opens once and a page he opens every day.

And a page he opens every day is how the rest of this system gets used.
