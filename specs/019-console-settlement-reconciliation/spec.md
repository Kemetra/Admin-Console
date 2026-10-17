# Feature Specification: Console Settlement Reconciliation

| Field | Value |
| --- | --- |
| Feature ID | 019 |
| Short name | console-settlement-reconciliation |
| Branch | `019-console-settlement-reconciliation` |
| Status | **SUPERSEDED** by RT-413 (removed in RT-421) |
| Owner | Ahmed Shaaban |
| Mode | Specify (residual blockers: 019 G-client/G-boundary + DP-2 032 G7) |
| Created | 2026-06-16 |
| Spec Kit phase | `/speckit specify` → `/clarify` → `/plan` → `/tasks` (this chain) |
| Owning repo | Retail-Tower-Console |
| Upstream producer | Data-Pulse-2 **035** sale-settlement-and-receivables-model (G2 **RATIFIED** 2026-06-15, PR #574 `cb4a7e5`) |
| Consumed contract | `packages/contracts/openapi/settlement/settlement.yaml` (`1.0.0-draft`) |
| Extra upstream | Data-Pulse-2 **032** sale-sync-ops runtime wiring (G7) — `packages/contracts/openapi/sale-sync-ops/sale-sync-ops.yaml` (`1.0.0-draft`) |

> **SUPERSEDED (RT-413 Option B; removed by RT-421, 2026-10-17).** Cash application
> (ApplyPayment) left Backend-Core: ERPNext owns cash application and A/R.
> `settlement.yaml` 2.0.0 (Backend-Core #779, RT-417) retired `consoleApplyPayment`;
> the ApplyPayment screen, its client wrapper, i18n keys and tests are deleted from
> the Console. This spec is kept as history only and MUST NOT be implemented.

> **Mode contract.** Specify. This spec defines the Console
> **settlement-reconciliation** surface — the **LAST** of the five DP-2 035
> children — that consumes a **named subset** of the RATIFIED DP-2 035 G2 contract
> **plus** the DP-2 032 sale-sync-ops **repair/retry** op, through the generated
> client only. It authorizes **no application code**, no OpenAPI edit (DP-2 owns
> both contracts), no migration, no new runtime dependency, and no new remote
> egress. The DP-2 035 G2 contract is RATIFIED and its **runtime is MERGED on
> DP-2 `origin/main` @ `cb44d4f`** (controller + services + `SettlementModule` +
> migration 0027, verified 2026-06-16) — so the apply-payment + receivable-read
> ops 019 consumes ARE backed by a live runtime. It is **not yet activated** (the
> contract is still `1.0.0-draft` and migration 0027's G3 apply/rollback is an open
> human gate), and the DP-2 032 **end-to-end posting-retry (G7) wiring is
> unverified** — so this surface remains **not buildable end-to-end** until 019's
> own **G-client** (generate the DP-2 clients) and **G-boundary** (boundary test)
> are done AND the DP-2 032 posting-retry path is confirmed wired end-to-end
> (G-runtime-032/G7) (see §3). No 019 gate is marked satisfied.

---

## 1. Background and why

Retail-Tower-Console is the admin web frontend in the Retail Tower split
(Data-Pulse-2 backend / POS-Pulse terminal / Retail-Tower-Console admin /
Retail-Tower-ERPNext-Connector). The architecture invariant is non-negotiable:
the Console reaches business data **only** through Data-Pulse-2 contracts and
**never** calls ERPNext.

```
POS-Pulse  ─┐
            ├─►  Data-Pulse-2  ─►  Retail-Tower-ERPNext-Connector  ─►  ERPNext/Frappe
Console    ─┘   (contract boundary)
```

DP-2 **035** (sale-settlement-and-receivables-model) is the **parent producer**
of the settlement work package. It defines who owes, how much, against which
sale, in what state, and how payments are applied and claims reconciled. Its
**G2 contract is RATIFIED** (2026-06-15) — the OpenAPI surface
`settlement/settlement.yaml` is authored, merged, and owner-approved, which is
the event that **unblocks the five children** (POS 020, Console 017/018/019,
Connector 009). DP-2 035 §12 names this slice explicitly, and as the LAST child:

> **Console 019 — settlement-reconciliation** (LAST): consumes reconciliation
> concepts; **also needs DP-2 032 runtime wiring** before it can run end-to-end.

This feature is that consumer. The Console **accounts / accounting administrator**
works the settlement floor: it **reads** the receivable queue and a single
receivable's reconciled projection (balance + lifecycle state), takes the
**settlement action** of applying a payment / cash against a receivable
(`consoleApplyPayment` — the DP-2-owned operational truth, 7-C), and issues a
**posting retry** for a sale whose downstream sync to ERPNext was classified as
needing repair (`consoleRepairSaleSync`, the DP-2 032 sale-sync-ops
server-mediated repair/retry). All of this is performed through the generated
DP-2 clients; the Console owns no settlement business logic and never calls
ERPNext.

## 2. Scope boundary against the sibling 035 children

DP-2 035 split its Console-facing surface across **three** Console children. 019
is the LAST and closes the loop (apply-payment + posting retry). The boundary
between them is the source of the load-bearing op-scope discipline in §3:

- **Console 017 — customer-and-payer-accounts**: owns payer-account CRUD
  (`consoleCreatePayerAccount`, `consoleListPayerAccounts`). Out of scope here.
- **Console 018 — receivables-and-insurance-claims**: owns the **claim →
  remittance** cycle write ops (`consoleSubmitClaim`, `consoleReconcileRemittance`)
  plus receivable **reads**. Out of scope here for the *writes*; the receivable
  **reads** (`consoleGetReceivable`, `consoleListReceivables`) are **shared** read
  projections, not a boundary breach (§3.2).
- **Console 019 (this slice) — settlement-reconciliation** (LAST): owns the
  **cash-application settlement action** (`consoleApplyPayment`, FR-011/012) and
  the **posting retry** (`consoleRepairSaleSync`, DP-2 032). It reads receivables
  to drive both. It also **needs DP-2 032 runtime wiring** before it can run
  end-to-end (G7, §3.1).

### 2.1 The apply-payment ownership correction (load-bearing)

The sibling 018 spec's prose **guessed** that cash application (`consoleApplyPayment`)
lands in Console 017. But 017's own SPECIFY artifact consumes **exactly two** ops
(`consoleCreatePayerAccount`, `consoleListPayerAccounts`) and explicitly does **not**
consume `consoleApplyPayment`. The op was therefore effectively **unassigned** in
the neighbor corpus. This dispatch assigns the **cash-application settlement
action** to **Console 019** (settlement actions + retry). Ownership stays clean:
every write op in `settlement.yaml` has exactly one owning child (see §3 table),
and the only sibling overlap is receivable *reads*, which is permitted. This is
recorded as a flagged-but-resolved ownership clarification (`## Clarifications`
CL-2 + `criticalClarifications`); adopting the dispatch makes 018's apply-payment
prose stale, which the dispatcher should know.

## 3. Op-scope discipline (load-bearing)

This surface consumes ops from **two** DP-2 contracts via the **generated client
only**. The generated client emits TypeScript types for all ops in each document
(generated whole — unavoidable, same posture as 007 / 018); the boundary
discipline is that the 019 query layer and UI **call only the named ops**;
the boundary is asserted by a VG-style boundary test (§7).

### 3.1 Consumed surface — DP-2 035 G2 (`settlement/settlement.yaml`)

- **CONSUMED by 019 (settlement-reconciliation):**
  - `consoleApplyPayment` — `POST /api/v1/settlement/receivables/{receivableRef}/apply-payment`
    — the **DP-2-owned cash-application settlement action** (7-C). Reduces a
    receivable's outstanding balance; a clearing application transitions it to
    `settled`, a partial one to `partially_applied`. Requires `Idempotency-Key`
    **and** the receivable's last-observed `version` in the body (optimistic
    concurrency). Idempotent — replay never double-reduces (FR-012/020, G5).
    The ERPNext Payment Entry is a downstream valuation projection referenced by
    `Receivable.erpnextPaymentEntryRef`; this op does **not** post to ERPNext
    (connector-owned, gated behind 011-DR-POSTING-R1).
  - `consoleGetReceivable` — `GET /api/v1/settlement/receivables/{receivableRef}`
    — read one receivable's projection (outstanding balance + lifecycle state) to
    drive the settlement action. **Shared read** with 018 (§3.2). Object-level
    authz → non-disclosing 404 (FR-005/006/007).
  - `consoleListReceivables` — `GET /api/v1/settlement/receivables`
    — tenant+store-scoped receivable queue, keyset paginated, optional
    `state` / `payer_ref` / `store_id` filter, to find receivables to settle.
    **Shared read** with 018 (§3.2). FR-005, FR-017.

- **NOT consumed by 019 (reason inline):**
  - `consoleCreatePayerAccount`, `consoleListPayerAccounts` — payer-account CRUD,
    **owned by Console 017**.
  - `consoleSubmitClaim`, `consoleReconcileRemittance` — the claim → remittance
    **write** cycle, **owned by Console 018**. 019 must not re-consume these
    writes (that would be a double-claim of an 018-owned surface).
  - `posRecordSettlementIntent` — POS-facing capture (`operatorAuthorization`),
    **owned by POS-020**; not a Console op.

### 3.2 Shared receivable reads are not a boundary breach

`consoleGetReceivable` and `consoleListReceivables` are **read** projections and
are consumed by both 018 and 019. A write op needs exactly one owning child; read
projections may be shared. 019 reads receivables to choose which to apply a
payment against and which sale to repair; 018 reads them to drive the claim cycle.
No state is co-owned: every **write** (apply-payment in 019; submit-claim /
reconcile-remittance in 018; payer CRUD in 017; settlement-intent in POS-020) has
exactly one owner. The boundary test (§7, VG-2) asserts 019 calls **none** of the
018/017/POS write ops.

### 3.3 Consumed surface — DP-2 032 sale-sync-ops (`sale-sync-ops.yaml`) — posting retry

- **CONSUMED by 019 (posting retry):**
  - `consoleRepairSaleSync` — `POST /api/v1/catalog/sale-sync-ops/sales/{saleRef}/repair`
    — the **server-mediated repair/retry** of a DP-2-classified
    `failed-needs-repair` sale sync (the "posting retry"). Acts only on a sale in
    a repairable (`failed-needs-repair`, open) state; performs **no sale-fact
    rewrite** (only the SaaS-owned sync-status + deadletter resolution are
    touched). Requires `Idempotency-Key` (no request body — path + idempotency
    only). Idempotent — replay replays the stored response. There is **no
    POS-local override path**; repair authority is Console-mediated only. Returns
    the updated `SaleSyncStatus` projection. An item not in a repairable state
    returns `409 repair_conflict` (deterministic, no side effect).

> **Read note.** Driving the retry surface conceptually benefits from the 032
> read ops (`consoleGetSaleSyncStatus` / `consoleListNeedsRepair` /
> `consoleGetSaleAuditTimeline`). Whether 019 surfaces the needs-repair **queue**
> itself or links from an existing 032 monitoring surface is a **non-critical**
> presentation decision deferred to `/plan` (CL-5); 019's load-bearing consumed
> **write** from 032 is `consoleRepairSaleSync` only.

### 3.4 Runtime-vs-contract gate — the residual blockers (load-bearing)

018 carried one blocking runtime gate (DP-2 035 impl absent). For 019 the 035
runtime is **present**, so 019's residual blockers are its **own** build steps
(`G-client` / `G-boundary`) **plus** the genuine DP-2 032 posting-retry gate
(`G-runtime-032` / G7):

1. **DP-2 035 runtime — PRESENT (not a blocker).** The DP-2 035 G2 contract is
   **RATIFIED** and its **runtime is MERGED on DP-2 `origin/main` @ `cb44d4f`**
   (verified 2026-06-16): `settlement.controller.ts` (all eight routes incl.
   `consoleApplyPayment` + the receivable reads), `receivable.service.ts`,
   `claim.service.ts`, `apply-payment-decision.ts`, DTOs and tests, with
   `SettlementModule` registered at `app.module.ts:222` and migration
   `0027_settlement_receivables.sql` authored/merged (runtime PRs #576–#584,
   2026-06-15). So `consoleApplyPayment` and the two receivable reads are
   **contract-present AND runtime-backed**. The surface is **not yet activated**
   only because the contract is still `1.0.0-draft` and migration 0027's G3
   (apply/rollback on a non-prod DB) is an **open human review gate** (per the
   migration header) — schema exists; G3 is a human gate, **not** a missing
   runtime. (Root cause of the earlier "035 impl absent" claim: `settlement.yaml`'s
   header comment, ~line 13, still says "No controller/DTO/service/migration exists
   yet" — stale since the contract draft PR #574, never updated after the runtime
   landed; see CL-9.) 019's real residual for the 035 ops is therefore its **own**
   `G-client` (generate the settlement client) + `G-boundary` (boundary test), **not**
   a missing 035 runtime.
2. **G-runtime-032 / G7 (032 end-to-end posting-retry wiring — UNVERIFIED ⇒
   treated as blocker).** The DP-2 032 sale-sync-ops contract is `1.0.0-draft`. A
   `consoleRepairSaleSync` controller route **is present on DP-2 `main`** (verified:
   `SaleSyncOpsController`, `POST /api/v1/catalog/sale-sync-ops/sales/{saleRef}/repair`,
   `@Roles("owner","tenant_admin")`) — so the runtime is **not flatly absent**. But
   per the dispatch, 019 "also needs DP-2 032 runtime wiring" (G7), and the
   **end-to-end posting-retry path is not self-certified by 019**. Per the
   orchestrator gate rule (uncertain ⇒ blocker), G7 is **treated as a blocker** —
   confirmed at build time before codegen. This is the extra dependency that
   distinguishes 019 from every other 035 child.

Consequence: **019 is still a SPECIFY artifact, not an end-to-end-buildable slice
today** — but for the **honest** reason: the 035 runtime is **present**, so what
remains is 019's own `G-client` / `G-boundary` work **plus** the genuine 032
posting-retry gate (`G-runtime-032` / G7). 019 is therefore correctly **not
auto-dispatchable** — not because the 035 runtime is absent (it is not), but
because 019 has not yet generated its client / written its boundary test and the
032 posting-retry path is not confirmed wired end-to-end. No 019 gate is satisfied
(§9, §11).

## 4. User scenarios & testing *(mandatory)*

### User Story 1 — Receivable queue to settle (Priority: P1)

As a Console accounts administrator, I see the receivable queue scoped to my
active tenant (and the stores I can access), newest-first, with each row's
outstanding balance and lifecycle state, so I can find receivables to settle.

**Why this priority**: The read surface is the demonstrable MVP — the DP-2 035
runtime now exists (@ `cb44d4f`), so it is reachable once 019 generates its client
(`G-client`); the whole settlement floor starts from being able to see what is owed.

**Independent Test**: Reviewable by confirming the queue consumes only
`consoleListReceivables`, renders the backend-scoped page as-is (no client-side
authz filter), treats `nextCursor` as opaque, and shows a successful empty state
for zero rows.

**Acceptance Scenarios**:

1. **Given** an active tenant/store scope, **When** the queue loads, **Then** it
   renders the backend page of receivables newest-first with each row's
   `outstandingBalance` and `state`, and a successful empty state when zero rows.
2. **Given** a page with a `nextCursor`, **When** the next page is requested,
   **Then** the opaque cursor is passed through unmodified and `page_size` is
   bounded ≤ 200.

---

### User Story 2 — Filter the queue (Priority: P1)

I can filter the queue by receivable `state` (`open` / `partially_applied` /
`settled` / `claimed` / `flagged`), by `payer_ref`, and by `store_id`, so the
floor is workable at volume.

**Why this priority**: Jointly P1 with US-1 — an unfilterable queue is not workable
at real receivable volume.

**Independent Test**: Reviewable by confirming the filters pass through the
contract query params as typed by the generated op, and that an out-of-scope
`payer_ref` / `store_id` yields the contract's non-disclosing 404 (not synthesized
client-side).

**Acceptance Scenarios**:

1. **Given** the queue, **When** a `state` / `payer_ref` / `store_id` filter is
   applied, **Then** the contract query params are passed through and the list
   re-keys to the filtered backend page.
2. **Given** an out-of-scope `payer_ref`, **When** the filter is applied, **Then**
   the contract's non-disclosing 404 is surfaced (no client-side enumeration).

---

### User Story 3 — Inspect one receivable (Priority: P2)

I can open one receivable to see its full reconciled projection —
`receivableRef`, `saleRef`, `payerRef`, `outstandingBalance`, `state`, `version`,
the tax-pending placeholder, and the (v1-null) ERPNext Payment-Entry external ref
— so I can decide how much to apply.

**Why this priority**: Inspect precedes the first write; I must read the projection
(including `version`) before applying a payment.

**Independent Test**: Reviewable by confirming the inspect surface consumes
`consoleGetReceivable`, renders the `Receivable` projection only, renders money
from the exact-decimal string (no float coercion), and never mutates the sale.

**Acceptance Scenarios**:

1. **Given** a receivable in scope, **When** it is opened, **Then** the full
   `Receivable` projection renders (money as exact-decimal string), with `saleRef`
   display-only.
2. **Given** a receivable out of scope, **When** it is opened, **Then** the
   contract's non-disclosing 404 is surfaced.

---

### User Story 4 — Apply a payment (settlement action) (Priority: P2)

I can apply a payment / cash (full or partial) against an open / partially-applied
receivable behind a confirm step, sending the `amount` and the receivable
`version` I last observed; on success the receivable advances
(`partially_applied` / `settled`) and the queue refreshes from the backend
response.

**Why this priority**: This is the core settlement action 019 owns — the
DP-2-owned cash-application operational truth (7-C).

**Independent Test**: Reviewable by walking a receivable through partial then
clearing application, confirming over-application and stale `version` both yield
the contract's inline `409`, and that `Idempotency-Key` is sent.

**Acceptance Scenarios**:

1. **Given** an open receivable, **When** a partial payment is applied, **Then**
   `consoleApplyPayment` is called with `amount` + `version` + `Idempotency-Key`,
   the receivable transitions to `partially_applied`, and the queue invalidates.
2. **Given** an open receivable, **When** a clearing payment is applied, **Then**
   it transitions to `settled`.
3. **Given** an amount greater than the outstanding balance, **When** applied,
   **Then** the contract's `409 conflict` (over-application) renders inline — no
   silent truncation; a stale `version` likewise renders `409` inline.

---

### User Story 5 — Posting retry (Priority: P3)

For a sale whose downstream sync to ERPNext was classified `failed-needs-repair`,
I can issue a **server-mediated posting retry** behind a confirm step; on success
I see the updated sync-status projection.

**Why this priority**: The most coupled path — it needs the DP-2 032 sale-sync-ops
runtime wiring (the extra 019 dependency), so it is last.

**Independent Test**: Reviewable by confirming the action consumes
`consoleRepairSaleSync` against a `saleRef` with `Idempotency-Key` and no body,
renders the returned `SaleSyncStatus`, and that a non-repairable sale yields the
contract's inline `409 repair_conflict`.

**Acceptance Scenarios**:

1. **Given** a sale in `failed-needs-repair` state, **When** a posting retry is
   confirmed, **Then** `consoleRepairSaleSync` is called (path + `Idempotency-Key`,
   no body) and the updated `SaleSyncStatus` renders; no sale-fact is rewritten.
2. **Given** a sale not in a repairable state, **When** retry is attempted,
   **Then** the contract's `409 repair_conflict` renders inline, no side effect.

---

### Edge Cases

- **Over-application of cash** — `amount` > outstanding balance is the contract's
  deterministic `409 conflict`, surfaced inline, never silent truncation (DP-2 035
  §4 edge case).
- **Stale optimistic-concurrency version** — applying against a `version` the
  backend has moved past is `409`; the surface re-reads the receivable and
  re-prompts, never blind-retries (CL-6).
- **Replay / duplicate apply-payment or retry** — the same `Idempotency-Key`
  replays the stored response; the balance is not double-reduced and the retry is
  not double-issued (G5).
- **Posting retry on a non-repairable sale** — a sale not in `failed-needs-repair`
  (open) state is `409 repair_conflict`, deterministic, no side effect.
- **Cross-tenant / out-of-scope ref** — an out-of-scope `receivableRef` / `saleRef`
  / `payer_ref` / `store_id` returns the non-disclosing safe-404 (identical for
  cross-tenant, out-of-scope, genuinely-absent).
- **No reversal here** — a receivable whose underlying sale was reversed via DP-026
  is not handled by a new workflow; reversal reuses DP-026 + Connector Arc A +
  POS-014 (NG-1).

## 5. Requirements *(mandatory)*

### Functional Requirements

- **FR-019-001 (list)** — The queue surface consumes `consoleListReceivables` only,
  via the generated client; it renders the backend-scoped page exactly (no
  client-side authorization filter, Principle 7). Zero rows is a successful empty
  state. Pagination uses the opaque `nextCursor` (treated as opaque, `page_size`
  bounded ≤ 200).
- **FR-019-002 (list filters)** — The list passes through the contract query
  params (`state`, `payer_ref`, `store_id`, `cursor`, `page_size`) as typed by the
  generated operation; an out-of-scope `payer_ref` / `store_id` yields the
  contract's non-disclosing 404 (it is not synthesized client-side).
- **FR-019-003 (inspect)** — The inspect surface consumes `consoleGetReceivable`
  and renders the `Receivable` projection only (`receivableRef`, `saleRef`,
  `payerRef`, `outstandingBalance`, `state`, `version`, `taxPlaceholder`,
  `erpnextPaymentEntryRef`). Money is rendered from the exact-decimal **string**
  (no float coercion). It MUST NOT mutate the sale (`saleRef` is display-only).
- **FR-019-004 (apply payment — settlement action)** — The apply-payment action
  consumes `consoleApplyPayment` behind a confirm step, sending `amount` +
  `version` (the receivable's last-observed optimistic-concurrency version, the
  contract requirement) against a `receivableRef`; on success the receivable
  projection is rendered with its advanced state and the queue invalidates.
  Idempotency uses the contract's required `Idempotency-Key`. **Over-application**
  (`amount` > outstanding balance) is the contract's deterministic `409 conflict`
  — surfaced inline, never silent truncation. A **stale `version`** is also `409`.
- **FR-019-005 (posting retry)** — The posting-retry action consumes
  `consoleRepairSaleSync` (DP-2 032) behind a confirm step against a `saleRef`,
  with the required `Idempotency-Key` and **no request body**; on success it
  renders the updated `SaleSyncStatus` projection. A sale not in a repairable
  (`failed-needs-repair`, open) state is the contract's `409 repair_conflict`,
  surfaced inline. The action performs **no sale-fact rewrite** and exposes **no
  POS-local override** (repair is Console-mediated only).
- **FR-019-006 (no reversal / rejection workflow — NG reuse)** — 019 defines or
  operates **no** reversal / void / refund / insurance-rejection workflow. Per
  DP-2 035 NG-1 / FR-015 those reuse the existing surfaces (**DP-026 + Connector
  Arc A + POS-014**). Apply-payment advances the non-reversal lifecycle only;
  posting retry re-queues a needs-repair sync, it does not reverse a sale.
- **FR-019-007 (scope)** — Scope is read from the RF-1 `ActiveContextProvider`
  (active tenant; optional active store). 019 holds no authoritative scope and
  calls no context / membership operation.
- **FR-019-008 (auth = cookieAuth, human session)** — Every consumed op (both 035
  and 032) is authorized by the Console **`cookieAuth`** human session (httpOnly
  `dp2_session`, `DashboardAuthGuard` + `RolesGuard`). The surface MUST NOT send
  an `Authorization` / `Bearer` header and MUST NOT use the POS
  `operatorAuthorization` envelope (that is the POS-020 route only). 401/403
  semantics are owned by DP-2 028 (G10) and are not re-decided here.
- **FR-019-009 (error mapping)** — Map EXACTLY the documented per-op statuses and
  assert no undocumented status:
  - `consoleListReceivables`: 400 / 401 / 403 / 404 / 500.
  - `consoleGetReceivable`: 400 / 401 / 403 / 404 / 500.
  - `consoleApplyPayment`: 400 / 401 / 403 / 404 / **409** / 500.
  - `consoleRepairSaleSync`: 400 / 401 / 403 / 404 / **409** / 500.
  - 404 is the **non-disclosing** safe-404 (cross-tenant / out-of-scope /
    genuinely-absent are identical, FR-022). 409 (`error.code = "conflict"` /
    `repair_conflict`) on apply-payment / repair is a deterministic side-effect-free
    refusal: stale `version`, **over-application** (apply-payment), or
    not-in-repairable-state (repair), or `idempotency_key_conflict` — rendered
    inline on the action, distinct from the 404 banner. No 422 / 429 anywhere
    (both contracts document none).
- **FR-019-010 (boundary)** — Every DP-2 call goes through the generated client(s);
  no hand-written `fetch` / `axios` / `XMLHttpRequest`. The 019 layer calls **none**
  of the NOT-consumed settlement write ops (`consoleSubmitClaim`,
  `consoleReconcileRemittance` → 018; `consoleCreatePayerAccount`,
  `consoleListPayerAccounts` → 017; `posRecordSettlementIntent` → POS-020) and no
  membership / context mutator.

### Key Entities *(render-side projections; field shapes owned by the DP-2 035 / 032 contracts)*

- **Receivable** *(read / list / apply-payment result)* — money owed against a
  `saleRef` by a `payerRef`; carries `outstandingBalance` (exact-decimal string),
  lifecycle `state`, `version` (optimistic concurrency, sent on apply-payment),
  `taxPlaceholder` (no VAT in v1), and `erpnextPaymentEntryRef` (v1-null until the
  connector posting gate clears — display-only pointer).
- **ReceivableState** — `open` / `partially_applied` / `settled` / `claimed` /
  `flagged` (the non-reversal carve; `reversal_consumed` is **excluded** from the
  contract and from this surface, DP-2 035 §OQ-4).
- **PaymentApplicationCreate** *(apply-payment request)* — `amount` (exact-decimal
  string) + `version` (last-observed) + optional `note`; the DP-2-owned cash
  application (7-C).
- **SaleSyncStatus** *(posting-retry result, DP-2 032)* — the sale's sync-status
  projection (`captured` / `synced` / `failed-retryable` / `failed-needs-repair`)
  returned by `consoleRepairSaleSync`. Field shapes owned by the DP-2 032
  sale-sync-ops contract.

## 6. Out of scope (hard)

- **Console 017 surface** — payer-account CRUD (`consoleCreatePayerAccount` /
  `consoleListPayerAccounts`).
- **Console 018 surface** — the claim → remittance write cycle
  (`consoleSubmitClaim` / `consoleReconcileRemittance`). 019 shares only the
  receivable **reads** with 018, never its writes.
- **POS-020 surface** — `posRecordSettlementIntent` (intent capture at the till).
- **No reversal / void / refund / insurance-rejection workflow** — reuses
  DP-026 + Connector Arc A + POS-014 (DP-2 035 NG-1). Posting retry re-queues a
  needs-repair sync; it is not a reversal.
- **No OpenAPI authoring/editing** — both contracts are **CONSUMED**, never edited;
  DP-2 owns `settlement/settlement.yaml` **and** `sale-sync-ops/sale-sync-ops.yaml`.
- **No backend logic, no ERPNext call** — the Console owns no settlement / sync
  business logic and never reaches ERPNext (architecture invariant, §1). The
  posting retry is server-mediated by DP-2; the Console only issues it.
- **No POS-local repair override** — repair authority is Console-mediated only
  (DP-2 032 §13 item 3); 019 builds no terminal-side repair path.
- **No new remote egress** — adding a Console egress target is forbidden by the
  orchestrator architecture invariant.
- **No tax / VAT logic** — `taxPlaceholder` is display-only; no allocation
  (DP-2 035 §OQ-2 / NG-4).
- **No end-to-end build before 019's own `G-client` / `G-boundary` are done AND the
  DP-2 032 sync-ops end-to-end posting-retry (G7) wiring is confirmed** (§3.4). The
  DP-2 035 runtime is already present @ `cb44d4f` (not a blocker).

## 7. Non-functional / boundary (VG)

- **VG-1** — every DP-2 call (035 and 032) goes through the generated client(s);
  no hand-written HTTP; no `Authorization` / `Bearer` header (cookie transport,
  FR-019-008).
- **VG-2** — the 019 layer calls **only** the named ops (`consoleApplyPayment`,
  `consoleGetReceivable`, `consoleListReceivables`, `consoleRepairSaleSync`); it
  calls **none** of `consoleSubmitClaim` / `consoleReconcileRemittance` (018) /
  `consoleCreatePayerAccount` / `consoleListPayerAccounts` (017) /
  `posRecordSettlementIntent` (POS-020) and no membership / context mutator.
- **VG-3** — no frontend authorization: no list / action / route is branched on a
  role or `is_platform_admin` (Principle 7); the backend's scoped response is
  rendered as-is.
- **VG-4** — no new remote egress target is introduced (architecture invariant).
- **Auth** — `cookieAuth`; a Console accounts/accounting-administrator human
  session (RF-1 shell); the settlement-by-admin/accounting-operator actor of DP-2
  035 §2 (OQ-7), **not** a cashier.

## 8. Actors / identity (aligned to DP-2 035 §2 + G10)

- **Console accounts / accounting administrator** *(principal)* — the human,
  authorized by the Console `cookieAuth` session boundary, who works the
  settlement floor: applies payments against receivables and issues posting
  retries. Settlement management is an **admin / accounting operator** action
  (DP-2 035 §2; OQ-7), **not** a cashier action.
- **Insurer / third-party payer** *(NOT a system user)* — modeled as a **payer
  account record** the receivable is owed by (`payerRef`); it is the payer behind a
  receivable 019 may settle, never a principal.
- **Corporate / credit-customer payer** *(NOT a system user)* — likewise a payer
  account record, not a principal.
- **Identity** — reuses the **DP-2 028-arc** + Console session boundary (G10); no
  new identity provider or scheme (DP-2 035 NG-7). Operator identity on the wire is
  the DP-2 `users.id` of the human session (DP-2 035 §8 / G10); cross-tenant access
  returns a safe 404.

## 9. Gate mapping (NONE satisfied)

> 019 consumes the DP-2 035 **G2** contract plus the DP-2 032 sale-sync-ops op, and
> carries repo-specific gates. This SPECIFY artifact marks **NONE satisfied**. G2
> being RATIFIED **upstream** is the precondition that lets 019 be specified — it is
> not an 019 gate.

| Gate | Meaning for 019 | Status in this artifact |
| --- | --- | --- |
| **G2 (consumed, upstream)** | DP-2 035 produces the contract 019 consumes. | **RATIFIED upstream** (2026-06-15, PR #574 `cb4a7e5`). Precondition only — **not an 019 gate**; 019 does not re-certify it. |
| **DP-2 035 runtime (upstream, PRESENT — not an 019 blocker)** | DP-2 035 contract has a live runtime (controller/service) for apply-payment + receivable reads. | **PRESENT** — runtime MERGED on DP-2 `origin/main` @ `cb44d4f` (`settlement.controller.ts` + services + `SettlementModule`@`app.module.ts:222` + migration 0027, verified 2026-06-16, PRs #576–#584). **Not activated** (contract `1.0.0-draft`; migration 0027 G3 is an open human gate) and **not** an 019 gate. The earlier "035 runtime absent" claim traced to a stale `settlement.yaml` header comment (CL-9); 019's residual for these ops is its own **G-client/G-boundary** below. |
| **G-runtime-032 / G7 (019, blocking — the EXTRA 019 gate)** | DP-2 032 posting-retry path is **wired end-to-end** so `consoleRepairSaleSync` runs. | **NOT satisfied (UNVERIFIED ⇒ blocker)** — the `consoleRepairSaleSync` controller route is present on DP-2 `main` (verified), but the end-to-end G7 wiring is not self-certified by 019; per the gate rule (uncertain ⇒ blocker) it blocks the posting-retry build (§3.4). The extra dependency distinguishing 019 from every other 035 child. |
| **G-client (019)** | The DP-2 035 + 032 clients are generated into the Console at pinned codegen SHAs, exposing the four ops. | **NOT satisfied** — not yet generated; planned in `/plan`. |
| **G-boundary (019)** | VG-1..VG-4 asserted by a boundary test. | **NOT satisfied** — design-only; test authored in the build slice. |
| **G-auth (019, consumes 028/G10)** | Console human session + safe-404 isolation. | **NOT satisfied as built** — design references the 028 boundary; no code. |

**No 019 gate is marked satisfied. Nothing here is built, dispatched, or run.**

## 10. Dependencies

- **Upstream (hard, contract):** DP-2 035 G2 contract (RATIFIED) — the source of
  `consoleApplyPayment` + the two receivable reads and all field shapes.
- **Upstream (hard, runtime):** **DP-2 035 runtime/impl** — **PRESENT**: merged on
  DP-2 `origin/main` @ `cb44d4f` (controller + services + `SettlementModule` +
  migration 0027, verified 2026-06-16); **not an 019 blocker** (not yet activated:
  contract `1.0.0-draft` + migration 0027 G3 human gate open). 019's residual for
  the apply-payment + read build is its own **G-client/G-boundary**. **DP-2 032
  sale-sync-ops end-to-end posting-retry wiring (`G-runtime-032` / G7)** — the
  `consoleRepairSaleSync` controller is present on DP-2 `main` (verified), but the
  end-to-end G7 wiring is **unverified ⇒ treated as a blocker** (gate rule); gates
  the posting-retry build (§3.4). 019 is the **only** 035 child carrying this second
  runtime gate.
- **Sibling boundary:** Console 017 (payer CRUD) and Console 018 (claim/remittance
  writes) — disjoint **write** surfaces; 019 shares only receivable **reads** with
  018 (§3.2).
- **Reuse anchors (reversal/rejection path):** DP-026 + Connector Arc A + POS-014
  (FR-019-006).
- **Console foundation:** RF-1 auth shell + `ActiveContextProvider`, the shared
  generated-client / query / error / presenter surface (DataTable / Drawer /
  ConfirmDelete / ListState / Banner), and the RF-2 typed data-layer pattern —
  all reused, no new shared primitive.
- **Identity:** DP-2 028-arc + Console session boundary (G10).

## 11. Claim ceiling / status honesty

- This is a **SPECIFY → CLARIFY → PLAN → TASKS** artifact at **Proposed / Draft**
  posture. It produces **no** code, OpenAPI, migration, generated client, or
  dispatched work.
- It marks **no 019 gate satisfied**. The upstream DP-2 035 **G2** is RATIFIED;
  that is a precondition, not an 019 gate, and 019 does not re-certify it.
- The consumed 035 ops are **contract-present AND runtime-backed**: the DP-2 035
  runtime is **merged on `origin/main` @ `cb44d4f`** (verified 2026-06-16). 019's
  residual blockers are therefore its **own** `G-client` / `G-boundary` work **plus
  one** genuine runtime gate — the 032 posting-retry path's **end-to-end G7 wiring,
  unverified ⇒ treated as a blocker** (the `consoleRepairSaleSync` controller is
  present on DP-2 `main`, but 019 does not self-certify the end-to-end path). 019 is
  **not buildable end-to-end** until those clear. (The 035 ops are also **not yet
  activated** — contract `1.0.0-draft`, migration 0027 G3 human gate open — but that
  is an activation caveat, not a missing runtime.) Any reader treating 019 as
  end-to-end-buildable today is reading more than this artifact claims.
- `consoleApplyPayment` ownership: 019 adopts cash application per this dispatch
  (the neighbor corpus left it effectively unassigned — §2.1). This is a
  flagged-but-resolved ownership clarification, not a re-decision of the contract.
- No payer-CRUD, claim/remittance-write, POS-intent, reversal, ERPNext, or
  new-egress capability is claimed (§6).

## 12. Success criteria *(mandatory)*

### Measurable outcomes

- **SC-001** — A reviewer can confirm 019 consumes **exactly** `consoleApplyPayment`
  + the two receivable reads from DP-2 035, **plus** `consoleRepairSaleSync` from
  DP-2 032, and that the other settlement ops are named as NOT-consumed with an
  inline reason — **4 consumed across two contracts**.
- **SC-002** — A reviewer can confirm in under 2 minutes that `consoleApplyPayment`
  is **owned by 019** (settlement action), that the neighbor 018 prose attributing
  it to 017 is stale (017 never consumed it), and that 019 shares only receivable
  **reads** with 018 (no write double-claim).
- **SC-003** — Each consumed op's documented status set is mapped exactly
  (apply-payment / repair include 409; the two reads do not) with a
  no-undocumented-status assertion and no 422/429.
- **SC-004** — A reviewer can confirm **no 019 gate is marked satisfied**, that the
  DP-2 035 runtime is **present** @ `cb44d4f` (so 019's residual for the 035 ops is
  its own `G-client` / `G-boundary`), and that **one** blocking runtime gate is
  explicit (`G-runtime-032`/G7) — the extra dependency that distinguishes 019 as the
  LAST child.
- **SC-005** — A reviewer can confirm the surface authors **zero** OpenAPI /
  migration / code, makes **no** ERPNext call, introduces **no** new egress, defines
  **no** reversal/rejection workflow, and exposes **no** POS-local repair override.

## 13. Assumptions

- The DP-2 035 G2 contract (`settlement/settlement.yaml`, `1.0.0-draft`) and the
  DP-2 032 sale-sync-ops contract (`sale-sync-ops/sale-sync-ops.yaml`,
  `1.0.0-draft`) are the authoritative sources of the four consumed ops and their
  field shapes; this spec consumes them and never edits them.
- The RF-1 auth shell, `ActiveContextProvider`, shared presenters, and the
  generated-client pattern exist and are reused (no new shared primitive).
- DP-2 has already implemented the 035 contract runtime (merged on `origin/main` @
  `cb44d4f`); it remains to wire the 032 sale-sync-ops end-to-end posting-retry path
  (G7) on a separately-gated slice. 019's build phases wait on its **own** `G-client`
  / `G-boundary` plus that **032** wiring — not on a 035 runtime (§3.4).
- ERPNext stays valuation / back-office; DP-2 owns operational settlement state and
  mediates sync repair; the Console never calls ERPNext (architecture invariant).
- The posting retry is the DP-2 032 `consoleRepairSaleSync` op; "retry" is **not** a
  settlement-contract op — it is the sale-sync-ops repair path (CL-1 / CL-3).
- Exact UI component layout, query-key design, codegen pins, and whether 019
  surfaces the needs-repair queue itself vs links from 032 monitoring are
  intentionally left to `/plan` and the build slice.

## Clarifications

> **CLARIFY pass — 2026-06-16.** Non-critical ambiguities resolved with documented
> defaults (question → chosen default → rationale). Critical items (anything
> changing the consumed contract surface, an ownership boundary, an actor/identity
> decision, or a gate) are flagged `[CRITICAL]` and also reported to the dispatcher
> via `criticalClarifications`. They do **not** block — the best provisional default
> is taken.

- **CL-1 — Posting-retry op identity** → **`consoleRepairSaleSync` (DP-2 032
  sale-sync-ops).** *Rationale:* the settlement contract (`settlement.yaml`) has
  **no** retry/repair op (verified against all eight ops); the dispatch frames 032
  as "sync-ops runtime wiring." The real op is the 032 server-mediated
  repair/retry. Non-critical to SPECIFY: it names a real, contract-present op
  rather than inventing one; it does set the 032 posting-retry runtime gate
  (`G-runtime-032` / G7, §3.4 / §9).
- **CL-2 — `consoleApplyPayment` ownership** `[CRITICAL]` → **Owned by Console 019
  (settlement action); adopt the dispatch.** *Rationale:* the neighbor 018 prose
  guessed apply-payment lands in 017, but 017's SPECIFY artifact consumes only the
  two payer-CRUD ops and explicitly excludes apply-payment — so the op was
  effectively unassigned. This dispatch assigns the cash-application settlement
  action to 019. Adopting it keeps every settlement **write** single-owned and
  makes 018's apply-payment prose stale. **Flagged CRITICAL** because it is an
  ownership-boundary item where the neighbor corpus is internally inconsistent;
  resolved here with the dispatch's default — it does not block.
- **CL-3 — "Retry" vs the settlement contract** → **Posting retry is the 032
  sync-ops repair, not a settlement op.** *Rationale:* keeps the 035 consumed set
  to apply-payment + reads only; the retry capability is a distinct contract.
  Non-critical: it partitions the two consumed contracts cleanly.
- **CL-4 — Shared receivable reads with 018** → **Permitted; reads are shareable,
  only writes are single-owned.** *Rationale:* 019 needs `consoleGetReceivable` /
  `consoleListReceivables` to drive apply-payment and to find sales to repair; 018
  uses the same reads for the claim cycle. No co-owned write. Non-critical: it does
  not change any write ownership or gate.
- **CL-5 — Needs-repair queue surfacing** → **Deferred to `/plan`; 019's
  load-bearing 032 consumed write is `consoleRepairSaleSync` only.** *Rationale:*
  whether 019 renders the needs-repair queue (via 032 read ops) or links from an
  existing 032 monitoring surface is a presentation choice; the retry **write** is
  fixed either way. Non-critical: it touches no write ownership, actor, or gate.
- **CL-6 — apply-payment optimistic concurrency** → **Send the receivable's
  last-observed `version` in the apply-payment body; a stale version is the
  contract's 409.** *Rationale:* `PaymentApplicationCreate` requires `version`; the
  surface must carry it and surface the 409 inline (over-application is also 409).
  Non-critical: it matches the consumed schema exactly.
- **CL-7 — Money rendering** → **Render the exact-decimal money string verbatim; no
  float parsing.** *Rationale:* DP-2 035 §III / the `Money` type is a string to
  avoid float drift; client-side float coercion would corrupt balances.
  Non-critical: a render convention, not a contract change.
- **CL-8 — DP-2 032 status provenance** → **`consoleRepairSaleSync` controller is
  present on DP-2 `main` (verified: `SaleSyncOpsController`,
  `POST /api/v1/catalog/sale-sync-ops/sales/{saleRef}/repair`,
  `@Roles("owner","tenant_admin")`); the 032 contract is `1.0.0-draft`,
  ratification status per DP-2 and not certified here; the end-to-end G7
  posting-retry wiring is unverified ⇒ treated as a blocker per the gate rule.**
  *Rationale:* status honesty — 019 must not assert the 032 runtime is "absent"
  (the controller exists) nor that 032 is "RATIFIED" (unverified). Non-critical: it
  does not change the consumed surface, ownership, actor, or *whether* G7 blocks —
  only the stated reason for the block (uncertain ⇒ blocker, not absence).
- **CL-9 — DP-2 035 runtime presence (corrects an earlier "035 runtime absent"
  reading)** → **The DP-2 035 settlement runtime is MERGED on DP-2 `origin/main` @
  `cb44d4f` (verified 2026-06-16): `settlement.controller.ts` (incl.
  `consoleApplyPayment` + receivable reads), `receivable.service.ts`,
  `claim.service.ts`, `apply-payment-decision.ts`, DTOs/tests, `SettlementModule`
  @`app.module.ts:222`, migration `0027_settlement_receivables.sql` (runtime PRs
  #576–#584). So the 035 ops 019 consumes are runtime-backed; the 035 runtime is
  NOT a blocker.** *Rationale / root cause:* an earlier reading asserted the 035
  runtime was "absent" / "no controller/DTO/service/migration exists yet." That came
  from the **stale `settlement.yaml` header comment** (~line 13), written with the
  contract draft PR #574 and never updated after the runtime landed; the source tree
  is authoritative. The honest residual is 019's own `G-client` / `G-boundary` plus
  the genuine `G-runtime-032` / G7. The 035 ops remain **not yet activated**
  (contract `1.0.0-draft`; migration 0027 G3 is an open human review gate per the
  migration header) — an activation caveat, not a missing runtime. Non-critical: it
  corrects the *reason* the 035 side is not yet end-to-end-buildable; it changes no
  consumed surface, ownership, actor, or the *fact* that no 019 gate is satisfied.
