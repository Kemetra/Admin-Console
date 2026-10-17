# Feature Specification: Console — Customer & Payer Accounts

| Field | Value |
| --- | --- |
| Feature ID | 017 |
| Short name | console-customer-and-payer-accounts |
| Branch | `017-console-customer-and-payer-accounts` |
| Status | **Proposed / Draft** |
| Owner | Ahmed Shaaban |
| Mode | Planning-only (SPECIFY → CLARIFY → PLAN → TASKS) |
| Created | 2026-06-16 |
| Spec Kit phase | `/speckit-specify` (this document) |
| Owning repo | Retail-Tower-Console (admin SPA) |
| Upstream producer | [Data-Pulse-2 `035-sale-settlement-and-receivables-model`](https://github.com/ahmed-shaaban-94/Data-Pulse-2/tree/main/specs/035-sale-settlement-and-receivables-model) |

> **Amended by RT-421 (2026-10-17) — settlement.yaml 2.0.0 (RT-417) and the RT-418 runtime.**
> The payer screens now call the two implemented routes (`consoleCreatePayerAccount`,
> `consoleListPayerAccounts`). Changes to this spec:
>
> - **`creditTerms` is removed** (FR-004 retired): ERPNext owns payment terms and credit
>   limits, and the create body is strict (`additionalProperties: false`), so a client that
>   sent it would get a 400. No credit-terms field exists in the form.
> - **`externalRef` is the payer's ERPNext Customer link** (labelled so in en/ar; blank is
>   sent as `null`, never as whitespace, which the contract rejects with a 400). Null means
>   "not linked yet"; the Console never resolves or calls ERPNext (Backend-Core is the
>   boundary, the Connector the only adapter).
> - **Scope.** Create offers "Whole tenant" (`storeId: null`) or one of the caller's stores;
>   the list shows each payer's scope. An out-of-scope store is a non-disclosing 404.
> - **Idempotent create.** The `Idempotency-Key` identifies the payer being created: a retry of
>   the same body reuses its key; a different body or a key conflict mints a new one.
> - **Keyset paging.** A page can be empty while `nextCursor` is non-null; "no more" is a
>   null cursor. The list offers "Load more" and keeps rows already fetched on a failure.
> - **Errors never disclose.** 400, 401, 404, 422 (not in the contract, handled the same
>   as a validation failure), 403 and 5xx show catalog copy and the request id only.
> - **Roles.** Owner and tenant_admin only (both routes are `@Roles("owner", "tenant_admin")`):
>   the nav entry (`ROLE_NAV`) and the page gate mirror the API.
> - The 018/019 screens that shared the settlement contract are superseded (RT-413).

> **Mode contract**: Planning-only. This spec specifies the Console
> customer-and-payer-accounts surface — the **first** of the settlement
> work-package's Console children (DP-2 035 §12). It must NOT be used to justify
> any implementation, component file, route file, generated-client regeneration,
> mock server, CI change, OpenAPI YAML, migration, or commit beyond this spec
> document and its companion planning artifacts (`plan.md`, `tasks.md`,
> `contracts/*.md`, `data-model.md`, `research.md`). This spec authorizes **no UI
> code**. Implementation is gated by the foundation spec's FR-008 five-gate rule
> and the constitution (`.specify/memory/constitution.md`).

---

## 1. Background and why

Retail-Tower-Console is the admin web frontend in the five-repo Retail Tower split
(Data-Pulse-2 backend / POS-Pulse terminal / Retail-Tower-ERPNext-Connector /
Retail-Tower-Console admin / Retail-Tower-Orchestrator). The console integrates
with the backend **only** through Data-Pulse-2's pinned OpenAPI contracts and the
**generated client** produced from them — never by calling ERPNext, Frappe, or any
backend internal directly, and never by holding settlement business logic of its
own.

Data-Pulse-2 has authored the settlement work-package's parent producer spec
(**DP-2 035** — sale-settlement-and-receivables-model) and **ratified the G2
contract** that the five children consume (`settlement.yaml`). DP-2 035 §12 names
this slice explicitly:

> **Console 017 — customer-and-payer-accounts**: consumes the payer-account model
> (FR-001..FR-004, FR-017).

This spec is that child. It covers the **payer-account management surface only** —
creating and listing the customer / corporate / third-party-payer accounts that the
rest of the settlement lifecycle is owed against. The receivable / cash-application
half (Console 018) and the settlement-reconciliation half (Console 019) are
**separate, later** children and are explicitly out of scope here (§3 Non-Goals).

### Why now

- **Upstream gate G2 is RATIFIED.** Per DP-2 035 §10 (Gate Mapping) the settlement
  contract `settlement.yaml` is authored, merged (PR #574, commit `cb4a7e5`), and
  owner-approved; the five children are **UNBLOCKED**. This is the dependency
  precondition for 017 to be planned at all. (Reported as a verified upstream fact —
  it does **not** flip any Console 017 gate; see §10.)
- The payer-account surface is the **narrowest, foundational** settlement child:
  receivables, claims, and reconciliation (018/019) are all owed *against a payer
  account*, so creating and listing those accounts is the natural first slice.
- 017 attaches to the already-merged Console foundation (RF-1 auth shell, the
  active-context provider, and the gated `Management` nav family); it introduces no
  new session-lifecycle behavior.

---

## 2. Actors

Aligned to **DP-2 035 §2** (Actors). 017 touches only the Console-human surface.

| Actor | Role in 017 |
|-------|-------------|
| **Console accounts / accounting administrator** | The 017 operator. Creates and lists payer accounts (credit customers, corporate accounts, insurers) within the active tenant, via the generated DP-2 client. Authorized by the **Console human session boundary** (`cookieAuth` — the httpOnly `dp2_session`, `DashboardAuthGuard` + `RolesGuard`). |
| **Cashier / POS operator** | **NOT a 017 actor.** Settlement-account management is an admin/accounting Console function, never a till function. Cashiers capture settlement *intent* at the POS (DP-2 035 FR-016, `posRecordSettlementIntent`, `operatorAuthorization`) — a separate surface in POS-020, not here. (See OQ-7 / Clarifications.) |
| **Insurer / third-party payer (external party)** | **NOT a system user / NOT an auth principal.** Per DP-2 035 §2, an insurer is "not a system user… modeled as a **payer account** the receivable is owed by." 017 manages the *account record* that represents this party. (See Clarifications OQ-1.) |
| **Corporate / account customer (external party)** | Likewise an external party modeled as a **payer account** record, invoiced and collected on terms — not a console login. |
| **Data-Pulse-2 backend** | Authority. Owns payer-account state, tenant isolation, idempotency, audit, optimistic-concurrency `version`, and the G2 contract 017 consumes. 017 holds **none** of this state. |

---

## 3. Scope, Consumed Contract, and Ownership Boundary

### 3.1 Consumed contract surface (DP-2 035 G2 — `settlement.yaml`)

017 consumes **exactly two** ratified operations from the settlement contract — the
payer-account create/list pair — via the **generated DP-2 client only**:

| operationId | Method / path | Auth | Request / response schema | Maps to DP-2 035 FR |
|-------------|---------------|------|---------------------------|---------------------|
| `consoleCreatePayerAccount` | `POST /api/v1/settlement/payer-accounts` | `cookieAuth` | `PayerAccountCreate` → `PayerAccount` (201); idempotent on `Idempotency-Key` | FR-001 / FR-002 / FR-004 |
| `consoleListPayerAccounts` | `GET /api/v1/settlement/payer-accounts` | `cookieAuth` | query (`category`, `cursor`, `page_size`) → `PayerAccountPage` (200) | FR-001 / FR-002 / FR-017 |

**Schemas consumed (names and shapes owned by DP-2; reproduced read-only):**

- `PayerCategory` — enum `credit_customer | corporate | insurer` (DP-2 035 FR-002;
  v1 set, extensible upstream).
- `PayerAccountCreate` — `{ category (required), displayName (required, 1..200),
  externalRef?, creditTerms? (opaque object/null placeholder, FR-004), storeId?
  (uuid/null; null = tenant-wide) }`. `tenant_id` + actor are **server-resolved**
  and MUST NOT be sent by Console.
- `PayerAccount` (wire projection) — `{ payerRef (uuid), category, displayName,
  externalRef?, status (active|suspended), storeId?, version (int) }`. No
  `tenant_id` (implicit in scope).
- `PayerAccountPage` — `{ items: PayerAccount[] (max 200), nextCursor (string/null —
  opaque keyset cursor; null on last page) }`.

### 3.2 Ownership boundary (non-negotiable)

- Console **manages payer/customer/corporate accounts via the GENERATED DP-2 client
  only** (DP-2 035 FR-017).
- Console MUST NOT contain **backend business logic**, MUST NOT **hold settlement /
  receivable / account state** (the projection is read-through from DP-2; DP-2 owns
  truth per OQ-7 / 7-C), and MUST NOT **call ERPNext / Frappe directly** (architecture
  invariant: POS/Console never call ERPNext; everything flows through DP-2 contracts).
- **Payer = an account record, NOT an auth principal** (Clarifications OQ-1). Creating
  a payer account does **not** create a login, a session, a role, or any identity
  credential. No new identity provider or scheme is introduced (DP-2 035 NG-7).
- 017 does **not** regenerate or author the OpenAPI contract; DP-2 owns
  `settlement.yaml`. 017 only *consumes* the generated client built from it.

---

## Clarifications

> **CLARIFY pass — 2026-06-16.** Ambiguities surfaced from the SPECIFY draft.
> Non-critical items are resolved here with a documented default + rationale.
> Critical items (those that would change the consumed contract surface, an
> ownership boundary, an actor/identity decision, or a gate) are flagged
> `[CRITICAL]` and also reported to the dispatcher; none block this artifact —
> each takes the best provisional default.

- **OQ-1 — Is a payer an authentication principal?** → **Default: NO. Payer is an
  account *record*, never an auth principal.** Rationale: DP-2 035 §2 models
  insurers/corporates as "not a system user… a payer account the receivable is owed
  by." Creating a payer account issues no login/session/role. 017's only actor is the
  Console admin (`cookieAuth`); the payer is data, not a user. (Boundary decision —
  also reflected in §2 and §3.2; not critical because it confirms, rather than
  changes, the parent's stated model.)
- **OQ-7-applied — Who operates this surface, cashier or admin?** → **Default:
  admin / accounting operator only, NOT the cashier.** Rationale: the consumed
  operations are `cookieAuth` (Console human session) per `settlement.yaml`; the
  cashier path is the separate `operatorAuthorization` `posRecordSettlementIntent`
  route (POS-020). DP-2 035 OQ-7 (7-C) makes DP-2 the operational-truth owner and
  keeps ERPNext out of the Console path; account management is a back-office admin
  function. (Confirms the parent's auth split; not critical.)
- **OQ-CON-EDIT — Can 017 edit / suspend a payer account?** → **Default: NO — read +
  create only in v1.** Rationale: `PayerAccount` carries `status (active|suspended)`
  and an optimistic-concurrency `version` ("stale version on update → 409"), which
  *imply* a future update/suspend operation — but **no `consoleUpdatePayerAccount` /
  suspend operationId exists in the ratified G2 surface**. 017 MUST NOT fabricate
  one. Account edit/suspend is therefore **deferred pending a future additive
  contract op** from DP-2; 017 consumes `status`/`version` read-only (display +
  carry-through for any later optimistic update). *Flagged for awareness:* if the
  owner deems edit/suspend product-essential for v1, that is a **contract-surface
  expansion** request to DP-2, not something 017 can self-author — escalated as
  `[CRITICAL]` so the dispatcher can route it; meanwhile the provisional default
  (read+create only) lets 017 proceed unblocked.
- **OQ-CON-LIST-FILTER — What list filters does 017 expose?** → **Default: the
  contract's `category` filter + keyset pagination (`cursor` / `page_size`) only.**
  Rationale: those are the only query parameters the ratified `consoleListPayerAccounts`
  exposes; client-side free-text search over `displayName` is a UI affordance over the
  returned page, not a new server filter. (Non-critical UI default.)
- **OQ-CON-IDEMPOTENCY — How does 017 satisfy create idempotency?** → **Default:
  Console generates a client-side `Idempotency-Key` (UUID) per create attempt and
  replays the *same* key on retry of the *same* submission.** Rationale: the op is
  `x-idempotency: required`; replay-safety (DP-2 035 G5/FR-020) is satisfied by a
  stable per-submission key so a double-submit never creates two accounts.
  (Non-critical implementation default; finalized in `plan.md`.)
- **OQ-CON-STORE-SCOPE — Tenant-wide vs store-scoped accounts?** → **Default: expose
  the optional `storeId` (null = tenant-wide) exactly as the contract models it; the
  active tenant is resolved by the RF-1 context provider and is server-resolved on
  write.** Rationale: mirrors `PayerAccountCreate.storeId` semantics; no new scoping
  invented. (Non-critical default.)

---

## 4. User Scenarios & Testing *(mandatory)*

### User Story 1 — Create a payer account (Priority: P1)

A Console accounts administrator, working in a resolved active tenant, creates a new
payer account for a credit customer, a corporate account, or an insurer — choosing
the `category`, giving it a `displayName`, and optionally recording an `externalRef`
(e.g. an insurer code) and a `storeId` scope. The account is created by the backend
via `consoleCreatePayerAccount` and appears in the tenant's payer-account list.

**Why this priority**: This is the reason 017 exists and the precondition for every
later settlement child — receivables (018) and reconciliation (019) are owed against
a payer account, so creating accounts is the foundational MVP slice.

**Independent Test**: Reviewable by walking the create flow through the consumed
contract — confirming (a) only `PayerAccountCreate` fields are sent (no `tenant_id`,
no actor), (b) the response is a `PayerAccount` projection with a `payerRef`,
`status`, and `version`, and (c) a duplicate submit with the same `Idempotency-Key`
yields a single account. No code is run; this validates the contract-consuming
design.

**Acceptance Scenarios**:

1. **Given** an authenticated admin with a resolved active tenant, **When** they
   submit a valid `PayerAccountCreate` (category + displayName), **Then** the design
   calls `consoleCreatePayerAccount` and renders the returned `PayerAccount`
   projection; `tenant_id`/actor are server-resolved and never sent.
2. **Given** a create submission, **When** it is retried with the **same**
   `Idempotency-Key`, **Then** no second account is created (G5 replay-safety;
   OQ-CON-IDEMPOTENCY).
3. **Given** a backend `409 conflict` (e.g. idempotency/version semantics), **When**
   it is returned, **Then** the design surfaces a deterministic, non-disclosing error
   to the admin and never silently creates a duplicate.

---

### User Story 2 — List and filter payer accounts (Priority: P2)

The administrator views the tenant's payer accounts — newest-first, paged via the
opaque keyset cursor — and optionally filters by `category` (credit customer /
corporate / insurer) to find the account a receivable will be owed against.

**Why this priority**: An account that can be created but never found or browsed is
not a usable management surface; listing is the read half that the rest of the
console (and the operator) depends on.

**Independent Test**: Reviewable by walking the list flow — confirming (a) the design
calls `consoleListPayerAccounts` with `category` / `cursor` / `page_size` only, (b)
it renders a `PayerAccountPage` (≤200 items + `nextCursor`), and (c) pagination
follows the opaque cursor with no client-invented filters hitting the server.

**Acceptance Scenarios**:

1. **Given** a tenant with payer accounts, **When** the admin opens the list, **Then**
   the design calls `consoleListPayerAccounts` and renders the `PayerAccountPage`
   newest-first.
2. **Given** more than one page, **When** the admin advances, **Then** the design
   passes the prior page's `nextCursor` as `cursor`; a null `nextCursor` is the last
   page.
3. **Given** a category filter selected, **When** the list reloads, **Then** the
   design passes `category` to the server; free-text `displayName` search is a
   client-side affordance over the returned page only (OQ-CON-LIST-FILTER).

---

### Edge Cases

- **No active tenant resolved** — if RF-1's active-context provider reports no active
  tenant, the design routes the admin to set scope first (mirrors 005 OQ-1) rather
  than calling the settlement ops with no tenant.
- **Cross-tenant / out-of-scope access** — any cross-tenant payer reference is a
  **non-disclosing 404** owned by the backend (DP-2 035 FR-022, §II/§XII); 017 never
  reveals existence.
- **Unknown / stale `version` on a (future) update** — out of v1 scope
  (OQ-CON-EDIT); when an update op later exists, a stale `version` is a `409` the
  design must surface deterministically.
- **Duplicate create (double-submit)** — replay-safe via the per-submission
  `Idempotency-Key` (OQ-CON-IDEMPOTENCY; G5).
- **Empty list** — a tenant with zero payer accounts renders an empty-state, not an
  error.
- **`creditTerms` placeholder** — carried as an opaque object/null (FR-004); 017
  invents **no** credit-terms field shapes or tax rules (tax-pending; DP-2 035 §6).

## 5. Requirements *(mandatory)*

### Functional Requirements — Payer-Account Management (consuming DP-2 035 G2)

- **FR-001**: The Console MUST let an authenticated accounts administrator **create a
  payer account** within the active tenant by calling `consoleCreatePayerAccount`
  via the generated DP-2 client. (Consumes DP-2 035 FR-001/FR-002/FR-004.)
- **FR-002**: The create surface MUST support all v1 `PayerCategory` values —
  `credit_customer`, `corporate`, `insurer` — without hard-coding a single vertical,
  exactly as the contract enum defines them. (DP-2 035 FR-002.)
- **FR-003**: The Console MUST send only `PayerAccountCreate` fields (`category`,
  `displayName`, optional `externalRef` / `creditTerms` / `storeId`) and MUST NOT send
  `tenant_id` or actor — both are server-resolved. (DP-2 035 §XII.)
- **FR-004**: The Console MUST treat `creditTerms` as an **opaque placeholder**
  (object/null) and MUST NOT invent credit-terms or tax/VAT field shapes (tax-pending;
  DP-2 035 FR-023/NG-4). (DP-2 035 FR-004.)
- **FR-005**: The Console MUST satisfy create **idempotency** by sending a stable
  per-submission `Idempotency-Key` and replaying the same key on retry, so a
  double-submit never creates two accounts. (DP-2 035 G5/FR-020.)
- **FR-006**: The Console MUST let the administrator **list payer accounts** via
  `consoleListPayerAccounts`, rendering a `PayerAccountPage` newest-first. (DP-2 035
  FR-017.)
- **FR-007**: The list MUST support the contract's `category` filter and **opaque
  keyset pagination** (`cursor` / `page_size`), following `nextCursor` for subsequent
  pages and treating a null `nextCursor` as the last page. (DP-2 035 FR-017.)
- **FR-008**: The Console MUST render the `PayerAccount` wire projection only
  (`payerRef`, `category`, `displayName`, `externalRef`, `status`, `storeId`,
  `version`); it MUST NOT depend on `tenant_id` (implicit in scope) or any field the
  projection omits.
- **FR-009**: The Console MUST consume `status` (`active|suspended`) and `version`
  **read-only** in v1; it MUST NOT fabricate an update/suspend operation absent from
  the G2 surface (OQ-CON-EDIT). Account edit/suspend is **deferred pending a future
  additive contract op**.

### Functional Requirements — Boundary, Identity, Isolation

- **FR-010**: The Console MUST integrate **only through the generated DP-2 client**
  built from `settlement.yaml`; it MUST NOT call ERPNext / Frappe directly, hold
  settlement state, or contain backend business logic. (Architecture invariant;
  DP-2 035 FR-017/§I/§III/§IX.)
- **FR-011**: 017 MUST authorize the surface with the **Console human session
  boundary** (`cookieAuth` — `DashboardAuthGuard` + `RolesGuard`); it MUST NOT use a
  POS `operatorAuthorization` envelope or a connector credential. (DP-2 035 §8/G10.)
- **FR-012**: A payer account is an **account record, not an auth principal**;
  creating one issues no login/session/role/credential, and 017 introduces no
  identity provider. (OQ-1; DP-2 035 NG-7.)
- **FR-013**: All accounts MUST be **tenant-isolated** (and store-scoped where
  `storeId` is set); cross-tenant access surfaces as a backend non-disclosing 404 and
  017 never discloses existence. (DP-2 035 FR-022.)
- **FR-014**: 017 MUST author **no** OpenAPI YAML, **no** migration, **no** generated
  client regeneration, and **no** UI code in this SPECIFY/PLAN/TASKS artifact; the
  contract is owned by DP-2 035. (Mode contract; foundation FR-008 five-gate rule.)

### Key Entities *(consumed from DP-2 035 G2 — field shapes owned by DP-2)*

- **Payer Account** — who is responsible for settling a sale balance; `category`
  (credit_customer / corporate / insurer), `displayName`, optional `externalRef`,
  opaque `creditTerms` placeholder, optional `storeId`, `status`, `version`. Owned
  and authorized by DP-2; consumed read/create-through by 017.
- **Payer Category** — the v1 enum (`credit_customer | corporate | insurer`).
- **Payer Account Page** — a newest-first, opaque-keyset-paginated page of payer
  accounts (`items` ≤ 200, `nextCursor`).

---

## 6. Identity / Access (G10)

- 017's surface is authorized by the **Console human session** (`cookieAuth`,
  httpOnly `dp2_session`) and gated `Management`-family RBAC, consistent with the
  RF-1 auth shell and DP-2 035 §8.
- A payer account is **not** an identity; no operator/cashier/connector credential is
  used or issued (FR-011, FR-012).
- Cross-tenant access returns a backend **safe 404** (FR-013; DP-2 035 §II/§XII).

---

## 7. Non-Goals / "does NOT"

017 explicitly **does NOT**:

- **NG-1 — Receivables / cash application.** No receivable list/read, no
  `consoleApplyPayment`. That is **Console 018** (DP-2 035 §12; consumes
  `consoleListReceivables` / `consoleGetReceivable` / `consoleApplyPayment`).
- **NG-2 — Claims / remittance reconciliation.** No `consoleSubmitClaim` /
  `consoleReconcileRemittance`. That is **Console 018 / 019**.
- **NG-3 — Settlement-reconciliation surface.** That is **Console 019** (LAST; also
  needs DP-2 032 runtime wiring).
- **NG-4 — POS settlement-intent capture.** No `posRecordSettlementIntent`; that is
  **POS-020**, on the `operatorAuthorization` path (DP-2 035 FR-016).
- **NG-5 — Connector posting.** No ERPNext / Payment-Entry posting; that is
  **Connector 009**, gated behind 011-DR-POSTING-R1 (DP-2 035 FR-018).
- **NG-6 — Account edit / suspend.** No update/suspend op (absent from the G2
  surface); deferred pending a future additive contract op (OQ-CON-EDIT, FR-009).
- **NG-7 — Contract / backend authorship.** No OpenAPI YAML, no migration, no DTO,
  no service/worker, no generated-client regeneration, no backend logic. DP-2 owns
  `settlement.yaml`.
- **NG-8 — Tax / VAT.** No VAT allocation, co-pay split, or credit-terms math;
  tax-pending placeholder only (DP-2 035 §6 / OQ-2 / NG-4).
- **NG-9 — Reversal / void / refund.** Not modeled anywhere in 017; reuse anchors are
  DP-026 + Connector Arc A + POS-014 (DP-2 035 NG-1).
- **NG-10 — New identity provider / auth principal.** Payer accounts are records, not
  logins (OQ-1; DP-2 035 NG-7).

---

## 8. Gate Mapping

> Console 017's **own** repo gates (the foundation FR-008 five-gate rule + the
> upstream-contract dependency). **NONE of 017's own gates are marked satisfied** —
> this is a Proposed/Draft SPECIFY-PLAN-TASKS artifact.

| Gate | Meaning (this slice) | Status in this artifact |
|------|----------------------|-------------------------|
| **Upstream DP-2 035 G2** | The settlement contract 017 consumes is ratified. | **RATIFIED upstream** (DP-2 035 §10: PR #574, `cb4a7e5`, owner-approved). Reported as a verified dependency precondition — **does not flip any 017 gate**. |
| **CON-G1 — Contract pin** | 017 pins the exact DP-2 035 G2 ops/schemas it consumes. | **Identified at SPECIFY level** (§3.1); **NOT satisfied** — generated-client pin happens in PLAN/implementation, not here. |
| **CON-G2 — Design approval** | Owner approves the 017 design (`design-brief.md`). | **NOT satisfied** — design phase not run. |
| **CON-G3 — API readiness** | Backend op availability verified against DP-2 `main`. | **NOT satisfied** — to be recorded in `research.md` / `api-readiness.md` at PLAN. |
| **CON-G4 — Foundation attach** | 017 attaches cleanly to RF-1 shell + active-context. | **NOT satisfied** — confirmed conceptually (§1); not certified. |
| **CON-G5 — Implementation gate** | Foundation FR-008 five-gate clearance before any UI code. | **NOT satisfied** — implementation is out of scope (Mode contract). |

---

## 9. Conceptual Model / Data Impact (PLAN — conceptual ONLY)

017 introduces **no** persistent state of its own. The payer-account `PayerAccount`
projection is **read-through** from DP-2; the create path is a write-through to
`consoleCreatePayerAccount`. There is **no Console-side database, table, migration,
or cache of record** for payer accounts. Any client-side state is ephemeral view
state over the generated client's responses. (Detailed in `data-model.md` at PLAN —
conceptual only; authors no schema.)

---

## 10. Claim Ceiling / Status Honesty

- This is a **Proposed / Draft, SPECIFY-PLAN-TASKS-only** artifact. It defines the
  contract-consuming design intent for the Console payer-account surface.
- It produces **no** code, OpenAPI, migration, generated client, or built UI.
- Upstream **DP-2 035 G2 = RATIFIED** is reported as a **verified dependency
  precondition**, not as a 017 gate. **None** of Console 017's own gates (§8) are
  marked satisfied. Nothing here is built, done, or dispatched.
- Account edit/suspend (OQ-CON-EDIT) is **deferred pending a future additive contract
  op** — any reader treating it as in-scope is reading more than this artifact claims.

---

## 11. Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A reviewer can confirm 017 consumes **exactly two** ratified G2
  operations — `consoleCreatePayerAccount` + `consoleListPayerAccounts` — and **zero**
  others (no receivables / claims / reconciliation / POS-intent / connector ops).
- **SC-002**: A reviewer can trace each consumed schema (`PayerAccountCreate`,
  `PayerAccount`, `PayerAccountPage`, `PayerCategory`) to its DP-2-owned definition
  and confirm 017 invents **no** field shapes.
- **SC-003**: A reviewer can confirm 017 maps to DP-2 035 **FR-001 / FR-002 / FR-004
  + FR-017** and to **no** receivable/claim/reconciliation FRs (those are 018/019).
  *(FR-003 — the sale↔buyer↔payer relationship binding — is referenced only insofar
  as 017 defines the payer-account entity the relationship points to; the binding
  itself is consumed by POS-020 / Console-018, not authored here.)*
- **SC-004**: A reviewer can confirm in under 2 minutes that 017 authors **zero**
  OpenAPI/migration/code and integrates **only** through the generated DP-2 client,
  never ERPNext directly.
- **SC-005**: A reviewer can confirm the actor/identity decision is unambiguous —
  payer = account record (not principal), surface operated by the Console admin (not
  the cashier) — consistent with DP-2 035 §2 and the contract's auth split.

---

## 12. Assumptions

- The generated DP-2 client built from the **ratified** `settlement.yaml` is (or will
  be, at PLAN) available to the Console; this spec does not regenerate it.
- The RF-1 auth shell, active-context provider, and `Management` nav family
  (foundation 001 / 003, merged) exist and are reused; 017 adds no session lifecycle.
- DP-2 owns payer-account state, idempotency, audit, tenant isolation, and
  optimistic-concurrency `version`; Console holds none of it (DP-2 035 OQ-7 / 7-C).
- The v1 `PayerCategory` set (`credit_customer | corporate | insurer`) is sufficient
  for 017; new categories are an upstream contract change, not a Console change.
- Exact UI component / router / data-fetching primitives are deferred to `plan.md` /
  `research.md` (reusing RF-1's resolved primitives); this spec names none.
