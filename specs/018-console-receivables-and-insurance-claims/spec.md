# Feature Specification: Console Receivables & Insurance Claims

| Field | Value |
| --- | --- |
| Feature ID | 018 |
| Short name | console-receivables-and-insurance-claims |
| Branch | `018-console-receivables-and-insurance-claims` |
| Status | **SUPERSEDED** by RT-413 (removed in RT-421) |
| Owner | Ahmed Shaaban |
| Mode | Specify |
| Created | 2026-06-16 |
| Spec Kit phase | `/speckit specify` → `/clarify` → `/plan` → `/tasks` (this chain) |
| Owning repo | Retail-Tower-Console |
| Upstream producer | Data-Pulse-2 **035** sale-settlement-and-receivables-model (G2 **RATIFIED** 2026-06-15, PR #574 `cb4a7e5`) |
| Consumed contract | `packages/contracts/openapi/settlement/settlement.yaml` (`1.0.0-draft`) |

> **SUPERSEDED (RT-413 Option B; removed by RT-421, 2026-10-17).** Cash application,
> claims, remittance and receivable balances left Backend-Core: ERPNext owns A/R
> (Payment & Receivables baseline). `settlement.yaml` 2.0.0 (Backend-Core #779,
> RT-417) retired `consoleListReceivables`, `consoleGetReceivable`,
> `consoleSubmitClaim` and `consoleReconcileRemittance`; the receivable list,
> SubmitClaim and ReconcileRemittance screens, their routes, client wrappers, i18n
> keys and tests are deleted from the Console. This spec is kept as history only
> and MUST NOT be implemented. The surviving payer screens are spec 017.

> **Mode contract.** Specify. This spec defines the Console
> **receivable-tracking + insurance-claim review/submission/remittance-reconciliation**
> surface that consumes a **named four-operation subset** of the RATIFIED DP-2 035
> G2 contract through the generated client only. It authorizes **no application
> code**, no OpenAPI edit (DP-2 owns the contract), no migration, no new runtime
> dependency, and no new remote egress. The DP-2 035 G2 contract is RATIFIED and
> **its runtime is MERGED on DP-2 `origin/main` @ `cb44d4f`** (controller +
> services + `SettlementModule` at `app.module.ts:222` + migration `0027`,
> verified 2026-06-16; see §3). The upstream runtime is therefore **present**, not
> absent. 018 nevertheless remains a SPECIFY artifact: it is **not yet built** —
> the residual work is 018's **own** Phase-2 steps (generate the client → boundary
> test), not an upstream gap. Activation caveat: the contract is still versioned
> `1.0.0-draft` and migration `0027`'s G3 (apply on a non-prod DB) is an **open
> human review gate**. No 018 gate is marked satisfied.

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
Connector 009). DP-2 035 §12 names this slice explicitly:

> **Console 018 — receivables-and-insurance-claims**: consumes receivable
> lifecycle + claim/remittance concepts (FR-005..FR-007, FR-014, FR-017).

This feature is that consumer. The Console **accounts administrator** tracks
receivables (the money owed against a sale by a payer account), reads a single
receivable's lifecycle/balance, **submits** open receivables to a third-party
payer as a **claim**, and **reconciles** an arriving **remittance** against a
claim (recording variance). All of this is performed through the generated
DP-2 035 client; the Console owns no settlement business logic.

## 2. Scope boundary against the sibling 035 children

DP-2 035 split its Console-facing surface across **three** Console children. The
boundary between them is the source of the load-bearing op-scope discipline in
§3:

- **Console 017 — customer-and-payer-accounts**: owns payer-account CRUD
  (`consoleCreatePayerAccount`, `consoleListPayerAccounts`). Out of scope here.
- **Console 018 (this slice) — receivables-and-insurance-claims**: owns
  **receivable tracking** (read one / list the queue) + the **claim →
  remittance** cycle (submit claim / reconcile remittance). FR-005..FR-007,
  FR-014, FR-017.
- **Console 019 — settlement-reconciliation** (LAST): the cross-receivable
  reconciliation surface + **cash application** (`consoleApplyPayment`,
  FR-011/012); also needs DP-2 032 runtime wiring. Out of scope here.

`consoleApplyPayment` (cash application) **touches receivables** and is the
obvious mis-pull. It is **deliberately excluded** from 018: cash application is
FR-011/012 and belongs to 019 (the settlement action). 018 reads receivables and
runs the claim cycle; it does not apply cash.

## 3. Op-scope discipline (load-bearing)

`settlement/settlement.yaml` (`1.0.0-draft`) carries **eight** operations. The
generated client emits TypeScript types for **all eight** (the document is
generated whole — unavoidable, same posture as 007's 8-op note). The boundary
discipline is that the 018 query layer and UI **call only the four named ops**;
the boundary is asserted by a VG-style boundary test (§7).

- **CONSUMED by 018 (the four named DP-2 035 G2 ops):**
  - `consoleGetReceivable` — `GET /api/v1/settlement/receivables/{receivableRef}`
    — read one receivable's projection (outstanding balance + lifecycle state).
    Object-level authz → non-disclosing 404 (FR-005/006/007).
  - `consoleListReceivables` — `GET /api/v1/settlement/receivables`
    — tenant+store-scoped receivable queue, keyset paginated, optional
    `state` / `payer_ref` / `store_id` filter (FR-005, FR-017).
  - `consoleSubmitClaim` — `POST /api/v1/settlement/claims`
    — submit one or more open/partially-applied receivables to a third-party
    payer as a claim; transitions them to `claimed`; idempotent (FR-014).
  - `consoleReconcileRemittance` — `POST /api/v1/settlement/claims/{claimRef}/reconcile-remittance`
    — match a remittance against a claim, recording variance; idempotent
    (FR-014).

- **NOT consumed by 018 (the other four ops — reason inline):**
  - `consoleCreatePayerAccount`, `consoleListPayerAccounts` — payer-account CRUD,
    **owned by Console 017**.
  - `consoleApplyPayment` — cash application (FR-011/012), **owned by Console
    019**; excluded from 018 even though it targets a receivable.
  - `posRecordSettlementIntent` — POS-facing capture (`operatorAuthorization`),
    **owned by POS-020**; not a Console op.

### 3.1 Runtime-vs-contract gate — runtime PRESENT (load-bearing)

007 consumed three ops that were **runtime-merged** on DP-2 `main`, so 007 was
buildable. 018 is **the same posture, not the opposite**: the DP-2 035 G2
contract is **RATIFIED** and its **runtime is MERGED on DP-2 `origin/main` @
`cb44d4f`** (verified 2026-06-16) — `settlement.controller.ts` (all routes),
`receivable.service.ts`, `claim.service.ts`, `apply-payment-decision.ts`, the
DTOs, unit + integration tests, with `SettlementModule` registered in
`apps/api/src/app.module.ts:222` and migration
`packages/db/drizzle/0027_settlement_receivables.sql` authored/merged. The
runtime PRs (#576–#584) merged 2026-06-15. Therefore the four consumed ops are
**contract-present AND runtime-present**.

> **Root-cause note (do not reintroduce the prior error).** An earlier draft of
> this spec stated the runtime was "absent / no controller exists yet." That was
> **false** — it was copied from `settlement.yaml`'s stale header comment
> (~line 13), which still reads "No controller/DTO/service/migration exists yet."
> That comment was written with the contract draft (PR #574) and was **never
> updated** after the runtime landed the next day. Verify against the DP-2 source
> tree (`apps/api/src/settlement/`, `app.module.ts:222`, migration `0027`), not
> that comment.

Consequence: **018 is a SPECIFY artifact that is not yet built** — but the reason
is **018's own residual work**, not a missing upstream. The genuine remaining
gates are 018's **G-client** (generate the DP-2 035 settlement client into the
Console) and **G-boundary** (the boundary/consumption test), per §9 / §11.
Activation caveat: the contract is still `1.0.0-draft` and migration `0027`'s G3
(apply on a non-prod DB) is an **open human review gate** — so "not yet built /
not yet activated" stays honest, while the "upstream runtime absent" premise was
false. No 018 gate is satisfied (§9, §11).

## 4. User stories

- **US-1 (receivable queue)** — As a Console accounts administrator, I see the
  receivable queue scoped to my active tenant (and the stores I can access), as
  a table ordered newest-first, with each row's outstanding balance and
  lifecycle state, so I can work the collections backlog. **(P1)**
- **US-2 (filter the queue)** — I can filter the queue by receivable `state`
  (`open` / `partially_applied` / `settled` / `claimed` / `flagged`), by
  `payer_ref` (an in-scope payer account), and by `store_id`, so the queue is
  workable at volume. **(P1)**
- **US-3 (inspect one receivable)** — I can open one receivable to see its full
  projection — `receivableRef`, `saleRef`, `payerRef`, `outstandingBalance`,
  `state`, `version`, the tax-pending placeholder, and the (v1-null) ERPNext
  Payment-Entry external ref — so I can decide whether to claim it. **(P2)**
- **US-4 (submit a claim)** — I can select one or more open / partially-applied
  receivables for a third-party payer and **submit a claim**, transitioning them
  to `claimed`, behind a confirm step; the queue refreshes from the backend
  response. **(P2)**
- **US-5 (reconcile a remittance)** — When a third-party payer's remittance
  arrives, I can **reconcile** it against a claim by entering the remitted
  amount (and an optional remittance-advice reference), and I see the
  reconciliation result — `claimedAmount`, `remittedAmount`, `variance`, and
  `outcome` (`settled` / `partial` / `flagged`). **(P3)**

> **US-1/US-2 are jointly P1** (the read surface is the demonstrable MVP once 018's
> own client is generated — G-client); US-3/US-4 are P2 (inspect + the first write);
> US-5 is P3 (the most complex insurer path, mirroring DP-2 035's P3 ordering for
> claim/remittance).

## 5. Functional requirements

- **FR-018-001 (list)** — The queue surface consumes `consoleListReceivables`
  only, via the generated client; it renders the backend-scoped page exactly (no
  client-side authorization filter, Principle 7). Zero rows is a successful
  empty state. Pagination uses the opaque `nextCursor` (treated as opaque,
  `page_size` bounded ≤ 200).
- **FR-018-002 (list filters)** — The list passes through the contract query
  params (`state`, `payer_ref`, `store_id`, `cursor`, `page_size`) as typed by
  the generated operation; an out-of-scope `payer_ref` / `store_id` yields the
  contract's non-disclosing 404 (it is not synthesized client-side).
- **FR-018-003 (inspect)** — The inspect surface consumes `consoleGetReceivable`
  and renders the `Receivable` projection only (`receivableRef`, `saleRef`,
  `payerRef`, `outstandingBalance`, `state`, `version`, `taxPlaceholder`,
  `erpnextPaymentEntryRef`). Money is rendered from the exact-decimal **string**
  (no float coercion). It MUST NOT mutate the sale (`saleRef` is display-only).
- **FR-018-004 (submit claim)** — The submit-claim action consumes
  `consoleSubmitClaim` behind a confirm step, sending `payerRef` +
  `receivableRefs` (1..500, the contract bound); on success the queue
  invalidates and the affected rows reflect the `claimed` state from the
  response. Idempotency uses the contract's required `Idempotency-Key`.
- **FR-018-005 (reconcile remittance)** — The reconcile action consumes
  `consoleReconcileRemittance` against a `claimRef`, sending `remittedAmount`
  (+ optional `remittanceRef`); it renders the `ReconciliationResult`
  (`claimedAmount` / `remittedAmount` / `variance` / `outcome`). Idempotency uses
  the required `Idempotency-Key`.
- **FR-018-006 (claim rejection routes out — NG reuse)** — Claim-line **rejection
  / insurance-rejection** is **NOT** a workflow this surface defines or operates.
  Per DP-2 035 NG-1 / FR-015, rejection routes to the existing reversal surfaces
  (**DP-026 + Connector Arc A + POS-014**). The reconcile surface renders only
  the contract's `settled` / `partial` / `flagged` outcomes; it builds no
  rejection UI.
- **FR-018-007 (scope)** — Scope is read from the RF-1 `ActiveContextProvider`
  (active tenant; optional active store). 018 holds no authoritative scope and
  calls no context / membership operation.
- **FR-018-008 (auth = cookieAuth, human session)** — Every consumed op is
  authorized by the Console **`cookieAuth`** human session (httpOnly
  `dp2_session`, `DashboardAuthGuard` + `RolesGuard`). The surface MUST NOT send
  an `Authorization` / `Bearer` header and MUST NOT use the POS
  `operatorAuthorization` envelope (that is the POS-020 route only). 401/403
  semantics are owned by DP-2 028 (G10) and are not re-decided here.
- **FR-018-009 (error mapping)** — Map EXACTLY the documented per-op statuses and
  assert no undocumented status:
  - `consoleListReceivables`: 400 / 401 / 403 / 404 / 500.
  - `consoleGetReceivable`: 400 / 401 / 403 / 404 / 500.
  - `consoleSubmitClaim`: 400 / 401 / 403 / 404 / **409** / 500.
  - `consoleReconcileRemittance`: 400 / 401 / 403 / 404 / **409** / 500.
  - 404 is the **non-disclosing** safe-404 (cross-tenant / out-of-scope /
    genuinely-absent are identical, FR-022). 409 (`error.code = "conflict"`) on
    submit/reconcile is a deterministic side-effect-free refusal: stale `version`,
    claim/remittance **not in a reconcilable state**, or `idempotency_key_conflict`
    — rendered inline on the action, distinct from the 404 banner. No 422 / 429
    anywhere (the contract documents none).
- **FR-018-010 (boundary)** — Every DP-2 call goes through the generated client;
  no hand-written `fetch` / `axios` / `XMLHttpRequest`. The 018 layer calls
  **none** of the four NOT-consumed ops (§3) and no membership / context mutator.

### Key Entities *(render-side projections; field shapes owned by the DP-2 035 G2 contract)*

- **Receivable** *(read / list)* — money owed against a `saleRef` by a `payerRef`;
  carries `outstandingBalance` (exact-decimal string), lifecycle `state`,
  `version`, `taxPlaceholder` (no VAT in v1), and `erpnextPaymentEntryRef`
  (v1-null until the connector posting gate clears — display-only pointer).
- **ReceivableState** — `open` / `partially_applied` / `settled` / `claimed` /
  `flagged` (the non-reversal carve; `reversal_consumed` is **excluded** from the
  contract and from this surface, DP-2 035 §OQ-4).
- **Claim** *(submit)* — a `payerRef` + `receivableRefs[]` submitted for
  collection; status `submitted` / `acknowledged` / `reconciled`.
- **ReconciliationResult** *(reconcile)* — `claimedAmount` / `remittedAmount` /
  `variance` / `outcome` (`settled` / `partial` / `flagged`). Rejection is **not**
  an outcome here (routes to DP-026 reuse, FR-018-006).

## 6. Out of scope (hard)

- **Console 017 surface** — payer-account CRUD (`consoleCreatePayerAccount` /
  `consoleListPayerAccounts`).
- **POS-020 surface** — `posRecordSettlementIntent` (intent capture at the till).
- **Console 019 surface** — cross-receivable settlement-reconciliation and
  **cash application** (`consoleApplyPayment`).
- **No reversal / void / refund / insurance-rejection workflow** — reuses
  DP-026 + Connector Arc A + POS-014 (DP-2 035 NG-1).
- **No OpenAPI authoring/editing** — the contract is **CONSUMED**, never edited;
  DP-2 owns `settlement/settlement.yaml`.
- **No backend logic, no ERPNext call** — the Console owns no settlement business
  logic and never reaches ERPNext (architecture invariant, §1).
- **No new remote egress** — OQ-3 v1: no insurer API, no remittance-file import
  (manual adjudication entry only). Adding a Console egress target is forbidden
  by the orchestrator architecture invariant.
- **No tax / VAT logic** — `taxPlaceholder` is display-only; no allocation
  (DP-2 035 §OQ-2 / NG-4).
- **No build before 018's own residual gates clear** — G-client (generate the
  DP-2 035 client) + G-boundary; the upstream 035 runtime is already present
  (§3.1).

## 7. Non-functional / boundary (VG)

- **VG-1** — every DP-2 call goes through the generated client; no hand-written
  HTTP; no `Authorization` / `Bearer` header (cookie transport, FR-018-008).
- **VG-2** — the 018 layer calls **only** the four named ops; it calls none of
  `consoleApplyPayment` / `consoleCreatePayerAccount` / `consoleListPayerAccounts`
  / `posRecordSettlementIntent` and no membership / context mutator.
- **VG-3** — no frontend authorization: no list / action / route is branched on a
  role or `is_platform_admin` (Principle 7); the backend's scoped response is
  rendered as-is.
- **VG-4** — no new remote egress target is introduced (OQ-3 manual-only;
  architecture invariant).
- **Auth** — `cookieAuth`; a Console accounts-administrator human session
  (RF-1 shell); the settlement-by-admin/accounting-operator actor of DP-2 035 §2
  (OQ-7), **not** a cashier.

## 8. Actors / identity (aligned to DP-2 035 §2 + G10)

- **Console accounts administrator** *(principal)* — the human, authorized by the
  Console `cookieAuth` session boundary, who tracks receivables and operates the
  claim/remittance cycle. Settlement management is an **admin / accounting
  operator** action (DP-2 035 §2; OQ-7), **not** a cashier action.
- **Insurer / third-party payer** *(NOT a system user)* — modeled as a **payer
  account record** the receivable is owed by (`payerRef`); it interacts via
  claims and remittances managed here, never as a principal.
- **Corporate / credit-customer payer** *(NOT a system user)* — likewise a payer
  account record, not a principal.
- **Identity** — reuses the **DP-2 028-arc** + Console session boundary (G10);
  no new identity provider or scheme (DP-2 035 NG-7). Operator identity on the
  wire is the DP-2 `users.id` of the human session (DP-2 035 §8 / G10);
  cross-tenant access returns a safe 404.

## 9. Gate mapping (NONE satisfied)

> 018 consumes the DP-2 035 **G2** contract and carries repo-specific gates. This
> SPECIFY artifact marks **NONE of 018's own gates satisfied**. The upstream
> preconditions are met: G2 is RATIFIED **and** the DP-2 035 **runtime is merged**
> on `origin/main` @ `cb44d4f` (verified 2026-06-16). Those are upstream
> preconditions, **not** 018 gates — 018 does not re-certify them. 018's own
> residual gates (G-client, G-boundary) remain open.
>
> **Root-cause breadcrumb:** `settlement.yaml`'s header comment (~line 13) still
> reads "No controller/DTO/service/migration exists yet"; it is **stale** (never
> updated after the runtime merged) and was the source of the earlier false
> "runtime absent" claim. Trust the DP-2 source tree, not that comment.

| Gate | Meaning for 018 | Status in this artifact |
| --- | --- | --- |
| **G2 (consumed, upstream)** | DP-2 035 produces the contract 018 consumes. | **RATIFIED upstream** (2026-06-15, PR #574 `cb4a7e5`). Precondition only — **not an 018 gate**; 018 does not re-certify it. |
| **DP-2 035 runtime (upstream precondition)** | DP-2 035 contract has a live runtime (controller/service) for the 4 ops. | **PRESENT** — merged on DP-2 `origin/main` @ `cb44d4f` (controller + services + `SettlementModule` @ `app.module.ts:222` + migration `0027`), verified 2026-06-16 (§3.1). Upstream precondition, **not** an 018 gate; **not a blocker**. Activation caveat: contract is `1.0.0-draft` and migration `0027`'s G3 is an open human review gate. |
| **G-client (018, blocking)** | The DP-2 035 client is generated into the Console at a pinned codegen SHA, exposing the 4 ops. | **NOT satisfied** — not yet generated; planned in `/plan`. The real residual that gates the build (the runtime it consumes is present). |
| **G-boundary (018, blocking)** | VG-1..VG-4 asserted by a boundary test. | **NOT satisfied** — design-only; test authored in the build slice. The other real residual. |
| **G-auth (018, consumes 028/G10)** | Console human session + safe-404 isolation. | **NOT satisfied as built** — design references the 028 boundary; no code. |

**No 018 gate is marked satisfied. Nothing here is built, dispatched, or run.**

## 10. Dependencies

- **Upstream (hard):** DP-2 035 G2 contract (RATIFIED) — the source of the four
  consumed operations and all field shapes. **DP-2 035 runtime/impl** —
  **present**, merged on DP-2 `origin/main` @ `cb44d4f` (controller + services +
  `SettlementModule` @ `app.module.ts:222` + migration `0027`), verified
  2026-06-16 (§3.1). The 018 build is gated on 018's **own** residuals
  (G-client + G-boundary), not on a missing upstream. Activation caveat: contract
  `1.0.0-draft`; migration `0027` G3 = open human review gate.
- **Sibling boundary:** Console 017 (payer accounts) and Console 019
  (reconciliation + cash application) — disjoint op surfaces (§2). 018 reads
  receivables that POS-020 intent opens and 019 applies cash against; it does
  not create payers or apply cash.
- **Reuse anchors (rejection path):** DP-026 + Connector Arc A + POS-014
  (FR-018-006).
- **Console foundation:** RF-1 auth shell + `ActiveContextProvider`, the shared
  generated-client / query / error / presenter surface (DataTable / Drawer /
  ConfirmDelete / ListState / Banner), and the RF-2 typed data-layer pattern —
  all reused, no new shared primitive.
- **Identity:** DP-2 028-arc + Console session boundary (G10).

## 11. Claim ceiling / status honesty

- This is a **SPECIFY → CLARIFY → PLAN → TASKS** artifact at **Proposed / Draft**
  posture. It produces **no** code, OpenAPI, migration, generated client, or
  dispatched work.
- It marks **no 018 gate satisfied**. The upstream DP-2 035 **G2** is RATIFIED;
  that is a precondition, not an 018 gate, and 018 does not re-certify it.
- The four consumed ops are **contract-present AND runtime-present** on DP-2
  (merged @ `cb44d4f`, §3.1). 018 is nonetheless **not yet built**: the residual
  is 018's **own** work — **G-client** (generate the settlement client) +
  **G-boundary** (boundary test) — plus the activation caveat that the contract
  is `1.0.0-draft` and migration `0027`'s G3 is an open human review gate. The
  blocker is **not** a missing upstream runtime. Any reader treating 018 as
  already built/activated is reading more than this artifact claims; any reader
  treating the upstream runtime as absent is reading the stale `settlement.yaml`
  header (§3.1), not the source tree.
- No cash-application, payer-CRUD, POS-intent, reversal, ERPNext, or new-egress
  capability is claimed (§6).

## 12. Success criteria *(mandatory)*

### Measurable outcomes

- **SC-001** — A reviewer can confirm 018 consumes **exactly four** ops
  (`consoleGetReceivable`, `consoleListReceivables`, `consoleSubmitClaim`,
  `consoleReconcileRemittance`) and that the other four settlement ops are named
  as NOT-consumed with an inline reason — **4 consumed / 4 excluded**.
- **SC-002** — A reviewer can confirm in under 2 minutes that `consoleApplyPayment`
  (cash application) is **excluded** and attributed to Console 019, despite
  targeting receivables.
- **SC-003** — Each consumed op's documented status set is mapped exactly
  (submit/reconcile include 409; get/list do not) with a no-undocumented-status
  assertion and no 422/429.
- **SC-004** — A reviewer can confirm **no 018 gate is marked satisfied**, that the
  upstream posture is stated correctly — DP-2 035 G2 RATIFIED **and** runtime
  PRESENT (merged @ `cb44d4f`, §3.1) — and that 018's residual blockers are its
  own **G-client + G-boundary** (not a missing upstream runtime).
- **SC-005** — A reviewer can confirm the surface authors **zero** OpenAPI /
  migration / code, makes **no** ERPNext call, introduces **no** new egress, and
  defines **no** reversal/rejection workflow (rejection routes to DP-026 reuse).

## 13. Assumptions

- The DP-2 035 G2 contract (`settlement/settlement.yaml`, `1.0.0-draft`) is the
  authoritative, RATIFIED source of the four ops and their field shapes; this
  spec consumes it and never edits it.
- The RF-1 auth shell, `ActiveContextProvider`, shared presenters, and the
  generated-client pattern exist and are reused (no new shared primitive).
- DP-2 has implemented the 035 contract runtime (merged on `origin/main` @
  `cb44d4f`, verified 2026-06-16); 018's build phases wait only on 018's own
  G-client + G-boundary, plus the `1.0.0-draft` / migration-`0027`-G3 activation
  caveats (§3.1).
- ERPNext stays valuation / back-office; DP-2 owns operational settlement state;
  the Console never calls ERPNext (architecture invariant).
- Manual adjudication entry only in v1 — no insurer API, no remittance-file
  import, no new egress (OQ-3, §`## Clarifications`).
- Exact UI component layout, query-key design, and codegen pin are intentionally
  left to `/plan` and the build slice.

## Clarifications

> Non-critical ambiguities resolved with documented defaults (question → chosen
> default → rationale). Critical items (anything changing the consumed contract
> surface, an ownership boundary, an actor/identity decision, or a gate) would be
> escalated; **none were found** — the consumed surface, ownership split, actor,
> and gates are all pre-decided by the RATIFIED DP-2 035 contract + decision
> record. `criticalClarifications = []`.

- **CL-1 — Insurer/remittance ingestion mechanism (OQ-3 v1)** → **Manual
  adjudication entry only.** No insurer API integration and no remittance-file
  (e.g. EDI 835 / CSV) import in v1; the administrator enters the remitted amount
  manually into `consoleReconcileRemittance`. *Rationale:* the contract exposes
  only a manual `remittedAmount` field; any ingestion channel is a **new remote
  egress**, forbidden by the orchestrator architecture invariant without an
  explicit allow-list update. Non-critical: it does not change the consumed
  surface (the op is consumed either way).
- **CL-2 — boundary for `consoleApplyPayment`** → **Excluded from 018; owned by
  Console 019** (the settlement action). *Rationale:* DP-2 035 maps cash
  application to FR-011/012 and 018's task scope names exactly four ops
  (read+list+submit+reconcile), none of which is apply-payment. Receivable rows
  in 018 may show a balance reduced by 019's cash application, but 018 never
  **calls** apply-payment. Non-critical: the four-op list pre-resolves it; it
  changes no gate or actor. *(Correction 2026-06-17: the original entry
  attributed apply-payment to Console 017 — a stale guess; 017's SPECIFY artifact
  consumes only `consoleCreatePayerAccount`/`consoleListPayerAccounts`, and 019
  owns `consoleApplyPayment`. Ownership corrected to 019 across this spec.)*
- **CL-3 — Runtime availability of the consumed ops** → *(original resolution,
  superseded — kept as audit trail)* "Treat 018 as design-ahead; gate the build on
  DP-2 035 runtime," on the rationale that the contract was `1.0.0-draft` "with no
  DP-2 controller yet." **AMENDED 2026-06-16:** that resolution rested on
  `settlement.yaml`'s **stale header comment** (~line 13: "No controller/DTO/
  service/migration exists yet"), which was never updated after the runtime
  landed. Verified against DP-2 `origin/main` @ `cb44d4f`, the **035 runtime is
  PRESENT** — `settlement.controller.ts`, `receivable.service.ts`,
  `claim.service.ts`, DTOs, `SettlementModule` @ `app.module.ts:222`, migration
  `0027` (PRs #576–#584, merged 2026-06-15). The corrected residual is therefore
  018's own **G-client + G-boundary**, **not** an upstream runtime absence. The
  `1.0.0-draft` version and migration `0027`'s open-G3 human review gate remain
  the honest "not-yet-activated" caveats. Non-critical to SPECIFY (the contract
  surface is unchanged); it corrects which gate blocks the build (§9).
- **CL-4 — Claim-line rejection handling** → **Out of scope; route to DP-026 +
  Connector Arc A + POS-014.** *Rationale:* DP-2 035 NG-1 / FR-015 forbid a
  competing rejection model; the contract's `ReconciliationResult.outcome` enum is
  `settled` / `partial` / `flagged` only (no `rejected`). Non-critical: reuse is
  pre-decided upstream.
- **CL-5 — Receivable-state vocabulary** → **Render the five non-reversal states
  only (`open` / `partially_applied` / `settled` / `claimed` / `flagged`).**
  *Rationale:* `reversal_consumed` is intentionally excluded from the contract
  enum (DP-2 035 §OQ-4 carve) and lands in a later additive bump; 018 renders only
  what the contract emits. Non-critical: matches the consumed schema exactly.
- **CL-6 — Money rendering** → **Render the exact-decimal money string verbatim;
  no float parsing.** *Rationale:* DP-2 035 §III / the contract `Money` type is a
  string to avoid float drift; client-side float coercion would corrupt balances.
  Non-critical: a render convention, not a contract change.
