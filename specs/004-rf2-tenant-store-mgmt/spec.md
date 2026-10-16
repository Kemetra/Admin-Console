# Feature Specification: RF-2 Tenant / Store Management

| Field | Value |
| --- | --- |
| Feature ID | 004 |
| Short name | rf2-tenant-store-mgmt |
| Branch | `004-rf2-tenant-store-mgmt` |
| Status | Draft |
| Owner | Ahmed Shaaban |
| Mode | Planning-only |
| Created | 2026-06-06 |
| Spec Kit phase | `/speckit-specify` (this document) |
| Foundation slice | [`specs/001-console-foundation`](../001-console-foundation/) (merged) |
| Scaffold slice | [`specs/002-tooling-and-scaffold`](../002-tooling-and-scaffold/) (merged) |
| Auth-shell slice | [`specs/003-rf1-auth-shell`](../003-rf1-auth-shell/) (merged; RF-2 attaches to it) |

> **Amendment — RT-400 (2026-10-16): store soft-delete is retired.** Per owner
> decision 194 (permanent closure is a governed workflow, not a raw delete) and
> RT-400 (PR #101, `fd6eb13`), the Admin Console no longer offers store
> soft-delete: no `softDeleteStore` call, no confirm step, no `useStoreDelete`, and
> no `store-delete` e2e. Wherever this spec (and its `tasks.md`, `design-brief.md`
> and `contracts/`) describes store soft-delete — SF-S2/SF-S3, Scenario S8, A3 —
> read it as **superseded**. The store «حالة المتجر» control is the V1
> `is_active` flag only (readiness-gated activation is decision 188; closure is
> decision 194). **Tenant soft-delete is unchanged.** Store time zone is tracked
> in RT-477.

> **Mode contract**: Planning-only. This spec specifies the RF-2 tenant/store
> management surface (foundation `spec.md` §5, route family RF-2). It must not be
> used to justify any implementation, component file, route file,
> generated-client regeneration, mock server, CI change, or commit beyond this
> spec document and its companion planning artifacts. Implementation is gated by
> the constitution (`.specify/memory/constitution.md`) and the foundation
> FR-008 five-gate rule. This spec authorizes **no UI code**.

---

## 1. Background and why

Retail-Tower-Console is the admin web frontend in the three-repo Retail Tower
split (Data-Pulse-2 backend / POS-Pulse terminal / Retail-Tower-Console admin).
The foundation slice ([`001-console-foundation`](../001-console-foundation/))
named seven route families RF-1 through RF-7. **RF-2 — Tenant / store
management** is the second family: "create, view, and configure tenants and the
stores within them" (foundation `spec.md` §5), with the list scoped to the
acting identity.

The scaffold slice ([`002-tooling-and-scaffold`](../002-tooling-and-scaffold/))
fixed the stack (React 19 + Vite 6 SPA, TypeScript strict, Vitest + Playwright,
Biome, GitHub Actions CI) and vendored a generated OpenAPI client at
`src/generated/` from Data-Pulse-2 contracts pinned at SHA `62d0906`.

The auth-shell slice ([`003-rf1-auth-shell`](../003-rf1-auth-shell/)) built the
RF-1 auth shell and the active-context provider every later family attaches to:
the sign-in surface, the authenticated app shell, the read-only active-context
projection, the shared error/banner surface, the cookie-transport client, and
the 401-reactive-refresh interceptor. **RF-2 is downstream of RF-1**: a tenant
or store screen is reachable only after an authenticated session with a resolved
active context (foundation `spec.md` §5 sequencing rule).

RF-2 is therefore the **first management slice that reuses, rather than
establishes, the auth shell**. This document is its `/speckit-specify` output: it
specifies *what* the tenant/store management surface must do, *which* ten
Data-Pulse-2 operations it consumes, *why* it adds no new context operation
(reusing RF-1's active-context provider), and *which* gates must clear before
implementation begins. It does **not** design the UI, choose a router/state/data
primitive, or authorize any source file.

### Why now

- RF-2's backend dependency is `stable` (both rows) per foundation
  `api-readiness.md` §RF-2, verified 2026-05-30 against Data-Pulse-2 `main`
  @ `62d0906` (`tenants.openapi.yaml` + `stores.openapi.yaml`; foundation
  `sc-verification.md` SC-1/SC-2/SC-3 Verified). Planning is unblocked.
- The generated client (slice 002, `src/generated/schema.d.ts`) already exposes
  the ten RF-2 operations' types. RF-2 is the slice that first consumes them.
- RF-1 (merged) supplies the shell, the active-context provider, the error
  surface, and the client/query wiring RF-2 attaches to. Specifying RF-2 now
  capitalizes on that reuse instead of re-deriving it (Constitution Principle 5,
  "no hidden scope expansion" read symmetrically: no re-invention either).
- The RF-1 app shell already carries a **gated** "Stores" nav entry
  (`gate: "RF-2"`). RF-2 is the slice that un-gates it. Naming that here keeps
  the un-gate a tracked, planned change rather than a smuggled edit.

---

## Clarifications

### Session 2026-06-06

Behavioral resolutions only. Per AC-5, RF-2's router/state/data-fetching/form/
table/error-surface **primitive** choices are NOT named here; they are resolved
in [`plan.md`](./plan.md) Technical Context and [`research.md`](./research.md)
R4-1..R4-5. This section records only resolutions that name no library.

- Q: OQ-1 — RF-2 stack primitives (table rendering, create/edit form handling,
  list query/pagination)? → A: Resolved in `plan.md` Technical Context and
  `research.md` R4-1..R4-5 (named there, not here, per AC-5). RF-2 **reuses**
  RF-1's resolved primitives (the shared client, the query layer, the
  active-context provider, the banner/inline-error surface) and is expected to
  add **no** new runtime dependency. Any primitive that would add a dependency
  is *selected, pending Constitution Principle 9 approval at implementation*.
- Q: OQ-2 — Is the tenant/store list filtered by the frontend per role, or only
  by what the backend returns? → A: **Backend-scoped only.** `listTenants`
  returns "tenants the caller may access (or all, if platform admin)" and
  `listStores` returns stores in the active tenant; RF-2 renders exactly that
  set and applies **no** client-side authorization filter (FR-004-004,
  Principle 7). Applies to Scenarios S1/S4.
- Q: OQ-3 — How does RF-2 present an action the current actor is not permitted
  to perform (e.g., a Store Staff opening the tenant create form)? → A: **Render
  and let the backend decide.** RF-2 does not pre-hide or pre-disable an action
  by inspecting the actor's role. The action is attempted; a backend 403 is
  rendered via the shared error surface with its `request_id` (FR-004-007). Role
  and `is_platform_admin` are **display-only** (a badge), never a UI gate.
  Reconciled into Scenarios S3/S6.
- Q: OQ-4 — What does a store-management surface do when there is no active
  tenant? → A: It **requires an active tenant first.** Store list/detail/create
  are tenant-scoped; with no active tenant the surface routes the operator to
  resolve scope (the RF-1 scope chooser) before any store call. The backend
  signals "no active tenant" with **`401`** on `listStores` / `createStore` (per
  the stores contract). RF-2 MUST distinguish this scope-precondition `401` from
  a session-expiry `401`: a no-active-tenant `401` routes to the **scope chooser**
  (resolve tenant), not through RF-1's session-expiry refresh-then-sign-out path.
  Applies to Scenarios S5/S7. (Note: the store-write `409` is a **store-code
  conflict**, a distinct case handled inline — see OQ-9.)
- Q: OQ-9 — What is the `createStore` / `updateStore` conflict case, and how is
  it rendered? → A: The store-write **`409` is a store-code conflict within the
  tenant** (a duplicate `code`), per the stores contract — it is **not** a
  "no active tenant" signal (that is `401`, OQ-4). RF-2 renders the store `409`
  **inline** on the code field (parallel to the tenant `createTenant` `409`
  slug-conflict), not as a scope prompt. Recorded so the store error matrix maps
  `401`→scope and `409`→inline-code-conflict, distinctly. Applies to Scenario S6.
- Q: OQ-5 — Does RF-2 add any context operation to read the membership graph
  (active tenant, `memberships[]`)? → A: **No.** RF-2 reads active tenant scope
  and `memberships[]` from RF-1's already-built active-context provider; it adds
  **zero** new context operations. The RF-2 consumption boundary is exactly the
  ten tenant/store operations in §6 (FR-004-001). Recorded so the count is
  unambiguous.
- Q: OQ-8 (headless self-resolved) — How does a list surface render the **empty
  state** (a returned list with zero rows: A1 with no tenants yet, or an active
  tenant with no stores)? → A: Render an **explicit empty state** distinct from
  loading and from error: a short message plus, where the backend would permit
  it, the create entry point — the create action is still **not** pre-hidden by
  role (OQ-3); an unpermitted create simply 403s on attempt. The empty state is a
  successful zero-row response, never an error. Recorded as a state-matrix
  requirement for the design brief (default / empty / loading / error / success
  per surface). Reconciled into Scenarios S1 (tenant list) and S4 (store list).

### Headless clarify verification (Session 2026-06-06)

Run headless (no human present); each question above was self-answered with the
recommended option. Three consistency checks were performed and **passed**:

1. **AC-5 self-check.** Grepped `spec.md` for router/state/framework/table
   primitive names. The only hits are the slice-002 stack named as *fixed
   context* (Background §1) and the words "router/state/data/table/form/component"
   appearing inside **negation/exclusion** clauses (Non-goals §3, AC-5) — no
   section *chooses* an RF-2 primitive. No leak; nothing moved to `plan.md`.
2. **Scenario ↔ open-question contradiction scan (no-frontend-authorization
   class).** Every Scenario S1–S8 was reconciled against every resolved OQ:
   - OQ-2 (backend-scoped list) ↔ S1/S4: both render the returned set with no
     client filter. Consistent.
   - OQ-3 (no pre-hide; render → 403) ↔ S3/S6: write attempts reach the backend
     and 403s are rendered; no scenario pre-hides a control. Consistent.
   - OQ-4 (no-active-tenant `401` → scope prompt) ↔ S5/S7: store surfaces resolve
     scope first; the scope-precondition `401` renders as a scope prompt, not a
     sign-out. Consistent.
   - OQ-5 (zero new context op) ↔ S7: scope read from RF-1's provider; RF-2 holds
     no authoritative scope. Consistent.
   - OQ-9 (store `409` = code conflict, inline) ↔ S6: distinct from the `401`
     scope case. Consistent.
   No OQ-vs-Scenario contradiction found (the 003 OQ-2-vs-S5 class is absent
   here).
3. **Contract-fidelity reconciliation (added after reading
   `tenants.openapi.yaml` + `stores.openapi.yaml` end-to-end @ pin `62d0906`).**
   The error matrix was corrected to match the contracts exactly: store
   no-active-tenant is **`401`** (not `409`); store-write `409` is a **store-code
   conflict** (inline, OQ-9); `createTenant` `409` is a slug conflict; `404` is
   uniform; the verbs are `PATCH` for both updates; and the contracts document
   **no `422`/`429`** on these ten operations, so RF-2 does not assert them
   (FR-004-007). This closed an optimistic-classification risk (Principle 2 /
   foundation FR-011): the prior draft had read the store `409`/`401` from a
   keyhole grep and conflated them.

---

## 2. Goals

- **G1.** Specify the **tenant management** surfaces: the tenant list (scoped to
  the acting identity by backend response), the tenant detail/read view, and the
  tenant create/edit surface.
- **G2.** Specify the **store management** surfaces: the store list (scoped to
  the active tenant), the store detail/read view, and the store create/edit
  surface — all tenant-scoped via RF-1's active context.
- **G3.** Specify the **scope-aware layout**: how RF-2 reuses RF-1's active
  tenant/store context and scope header so a tenant/store action always happens
  in a legible scope (PRODUCT.md "Scope before action").
- **G4.** Enumerate the **exactly ten** Data-Pulse-2 operations RF-2 consumes,
  with no addition beyond the foundation RF-2 consumption boundary, and assert
  that RF-2 adds **zero** new context operation (reuses RF-1's provider).
- **G5.** Specify the **error-rendering** behaviors for the status codes the
  tenant/store contracts actually define (`403`/`404`/`409`/store-`401`/`5xx`),
  reusing the RF-1 shared error surface, including the uniform-404, the tenant
  slug- and store-code-conflict cases, and the no-active-tenant `401` scope
  prompt (distinct from session-expiry).
- **G6.** Define the **functional requirements** and **acceptance criteria** any
  RF-2 plan / task list / implementation slice must satisfy.
- **G7.** Record the **open questions** that must resolve before an RF-2
  implementation gate (FR-008) clears.

---

## 3. Non-goals

This spec **does not**:

- Authorize implementation of the RF-2 UI. That requires the foundation FR-008
  five-gate approval for this slice specifically.
- Choose a router, state-management library, data-fetching library, table
  component, styling system, component library, or form library. Those are RF-2
  *plan/clarify* decisions (this slice's `research.md` R4-1..R4-5), and RF-2 is
  expected to **reuse** RF-1's already-resolved primitives, adding no new
  dependency.
- Create any `src/` file, route file, component, hook, or test file. (It does
  **flag**, for the implementation slice, that the RF-1 app shell's gated
  "Stores" nav entry and the router config are the shared files RF-2 will touch —
  see §5 and `tasks.md`. Flagging is not editing.)
- Regenerate, edit, or re-pin `src/generated/schema.d.ts` **as a spec/plan
  action**. (RF-2's tenant/store operations are not in the slice-002 auth+context
  client; adding `tenants.openapi.yaml` + `stores.openapi.yaml` to
  `openapi-ts.config.ts` and re-running `pnpm generate:client` **at the same pin
  `62d0906`** is a gated *implementation* task — regeneration at the pinned SHA,
  not a re-pin, not a spec action. Per foundation `api-readiness.md`: slices
  re-run `pnpm generate:client` when their consumed contracts change.)
- Define, copy, paraphrase, or vendor any byte of Data-Pulse-2's
  `tenants.openapi.yaml`, `stores.openapi.yaml`, or `context.openapi.yaml`.
  Request/response shapes (field names, slug patterns, status enums, validation
  rules) are read from the generated client at implementation time, never copied
  here.
- Define backend APIs, authorization logic, tenant/store data model, validation
  rules, or persistence. Those belong to Data-Pulse-2.
- Implement any frontend authorization. RF-2 never decides who may list, read,
  create, update, or soft-delete a tenant or store; the backend decides and RF-2
  renders the result, including 403s (FR-004-004, Principle 7).
- Manage **memberships / operators** (invite, assign role, revoke). The
  `listMembers` operation on `tenants.openapi.yaml`, and all of
  `memberships.openapi.yaml`, belong to **RF-5** (operator / admin management),
  not RF-2. Named here so the exclusion is visible, not overlooked (FR-004-001).
- Manage catalog, unknown items, audit, or settings (RF-3/RF-4/RF-6/RF-7).
- Define POS terminal behavior or any write-path to a POS device.

---

## 4. Actors

RF-2 is consumed by the authenticated-actor categories defined in the foundation
spec (`001-console-foundation/spec.md` §4). RF-2 surfaces touch A1–A5 plus the
anonymous category by absence:

| ID | Actor | RF-2 relevance |
| --- | --- | --- |
| A1 | Platform Admin | Cross-tenant. `listTenants` may return all tenants; may create/soft-delete tenants. RF-2 renders the `is_platform_admin` flag for display only (no UI unlock — FR-004-004). What A1 may actually do is the backend's decision, surfaced as success or 403. |
| A2 | Tenant Owner | Highest privilege inside one tenant. Reads/updates the tenant; provisions and configures stores within it. The set RF-2 shows is whatever the backend scopes to A2. |
| A3 | Tenant Admin | Tenant-scoped admin. Reads/updates the tenant (per backend policy); creates/updates/soft-deletes stores within the active tenant. |
| A4 | Store Manager | Store-scoped. Typically reads the tenant and the store(s) the backend scopes to A4; create/update attempts the backend rejects are rendered as 403. |
| A5 | Store Staff | Read-mostly. Sees the scoped list/detail the backend returns; write attempts surface as 403 via the shared error surface. RF-2 does not pre-hide write controls (OQ-3). |
| A7 | Anonymous / unauthenticated | Has **no** RF-2 surface. RF-2 is behind the RF-1 protected boundary; an unauthenticated caller is routed to sign-in by the RF-1 route guard (401 → SF-1). Named only to assert its absence. |
| A6 | POS Device / POS Operator | **Never authenticates against the console.** RF-2 has no POS surface and never writes to a POS device. Named only to assert its absence (foundation §4 POS boundary rule, FR-004-013). |

**Authorization rule.** RF-2 never decides whether an actor *may* list, read,
create, update, or soft-delete a tenant or store. The backend enforces
authorization; RF-2 renders what the backend returns, including rejections
(FR-004-004, Constitution Principle 7). The list is scoped by the backend
response, not by a frontend filter (OQ-2). Actions are not pre-hidden by role
(OQ-3).

---

## 5. Surfaces in scope

RF-2 comprises two surface groups (tenant, store) plus the scope-aware layout
they share. This spec names them and their responsibilities; **layout,
navigation, table columns, and interaction design are deferred to this slice's
`plan.md`** (no wireframes here; the design brief lives in the plan artifacts).

| ID | Surface | Responsibility |
| --- | --- | --- |
| SF-T1 | Tenant list | Renders the backend-scoped set of tenants (`listTenants`) as a table (DESIGN.md tables-over-cards). No client-side authorization filter (OQ-2). Entry point to tenant detail and (where the backend permits) tenant create. |
| SF-T2 | Tenant detail | Read view of a single tenant (`readTenant`): its fields and status, rendered for display. Surfaces the path to edit/soft-delete; the backend decides whether those succeed. |
| SF-T3 | Tenant create / edit | Collects tenant fields, calls `createTenant` or `updateTenant`, and reacts to the response (success → detail/list; 403 → permission error on create/soft-delete; 409 → slug conflict inline on create; 404 → uniform on update). Soft-delete (`softDeleteTenant`) is offered here or from SF-T2 with a confirm step. |
| SF-S1 | Store list | Renders the active tenant's stores (`listStores`) as a table. Tenant-scoped via RF-1's active context; no active tenant → backend `401` rendered as a **scope prompt** (resolve tenant first), distinct from a session-expiry 401 (OQ-4). |
| SF-S2 | Store detail | Read view of a single store (`readStore`) within the active tenant. 404 uniform on absent/no-access. |
| SF-S3 | Store create / edit | Collects store fields scoped to the **active tenant** (no tenant picker in the form — scope comes from RF-1's active context), calls `createStore` or `updateStore`, reacts to the response (success; 403 insufficient role; 409 store-code conflict inline on the code field, OQ-9; 401 no-active-tenant → scope prompt, OQ-4; 404 uniform on update). Soft-delete (`softDeleteStore`) with a confirm step. |
| SF-L | Scope-aware layout | The shared frame: RF-2 mounts inside RF-1's authenticated app shell (SF-2) and reads active tenant/store from RF-1's active-context provider (SF-3). The persistent gold scope header (RF-1) shows the current tenant/store; switching scope re-fetches RF-2 lists. RF-2 adds **no** new context state — it consumes RF-1's. |

**Reuse rule.** SF-L is **not** a new shell. RF-2 renders within RF-1's
`AppShell` and reads scope from RF-1's active-context provider. The RF-1
shared error/banner surface renders RF-2's 4xx/5xx states. The implementation
slice **un-gates** the RF-1 app shell's gated "Stores" nav entry and registers
the RF-2 routes inside the existing protected boundary — these are the shared
files RF-2 touches (tracked in `tasks.md`, not edited by this spec).

**Scope-before-action rule.** A store surface requires a resolved active tenant
(OQ-4). With none, RF-2 routes the operator to RF-1's scope chooser before any
store call. The stores contract returns **`401` ("No active tenant")** on
`listStores` / `createStore` when no active tenant is set; RF-2 MUST treat this
scope-precondition `401` as a **scope prompt** (resolve tenant first), distinct
from a session-expiry `401` (which goes through RF-1's reactive-refresh path).
This honors PRODUCT.md Principle 1 (scope before action) and avoids
misrendering a scope gap as a session expiry.

---

## 6. Backend dependency — RF-2 consumption boundary

RF-2 consumes **exactly ten** Data-Pulse-2 operations. This set is the
foundation RF-2 consumption boundary (foundation `spec.md` §6 RF-2 row +
`api-readiness.md` §RF-2); this slice does not add to it. Adding an operation is
an FR-009 scope expansion that requires a foundation amendment, not a line in
this spec.

The detailed consumption boundary for this slice lives in
[`contracts/rf2-tenant-store.md`](./contracts/rf2-tenant-store.md). Operations
are named only (operationId + method + path + upstream file); request/response
shapes are read from the generated client (`src/generated/schema.d.ts`, slice
002 pin `62d0906`), never copied here.

### Tenant operations — `tenants.openapi.yaml`

| # | operationId | HTTP | Surface |
| --- | --- | --- | --- |
| 1 | `listTenants` | `GET /api/v1/tenants` | SF-T1 |
| 2 | `readTenant` | `GET /api/v1/tenants/{tenant_id}` | SF-T2 |
| 3 | `createTenant` | `POST /api/v1/tenants` | SF-T3 |
| 4 | `updateTenant` | `PATCH /api/v1/tenants/{tenant_id}` | SF-T3 |
| 5 | `softDeleteTenant` | `DELETE /api/v1/tenants/{tenant_id}` | SF-T2/SF-T3 |

### Store operations — `stores.openapi.yaml`

| # | operationId | HTTP | Surface |
| --- | --- | --- | --- |
| 6 | `listStores` | `GET /api/v1/stores` | SF-S1 |
| 7 | `readStore` | `GET /api/v1/stores/{store_id}` | SF-S2 |
| 8 | `createStore` | `POST /api/v1/stores` | SF-S3 |
| 9 | `updateStore` | `PATCH /api/v1/stores/{store_id}` | SF-S3 |
| 10 | `softDeleteStore` | `DELETE /api/v1/stores/{store_id}` | SF-S2/SF-S3 |

### Context — reused from RF-1, NOT re-consumed

RF-2 reads the active tenant scope and `memberships[]` projection from **RF-1's
active-context provider** (slice 003, SF-3). It adds **zero** new context
operation. The store operations are implicitly scoped to the active tenant the
RF-1 provider already holds; switching scope (an RF-1 action) re-fetches RF-2's
lists. This is the resolved OQ-5.

### Explicitly NOT consumed by RF-2

Named so a reviewer sees they were considered and intentionally excluded
(FR-004-001), not overlooked:

- `listMembers` (`GET /api/v1/tenants/{tenant_id}/members`, `tenants.openapi.yaml`)
  — membership listing belongs to **RF-5** (operator / admin management;
  foundation §6 RF-5 row claims it). RF-2 manages tenants and stores, not the
  identities within them.
- All of `memberships.openapi.yaml` (`createInvitation` / `updateMembership` /
  `revokeMembership` / `acceptInvitation`) — **RF-5**.
- The three RF-1 context mutators (`switchActiveTenant` / `switchActiveStore` /
  `clearActiveStore`) and `getActiveContext` — owned and consumed by **RF-1**;
  RF-2 reads their result through RF-1's provider, it does not call them itself.

**Readiness.** Both RF-2 rows are `stable` per foundation `api-readiness.md`
§RF-2 (verified against Data-Pulse-2 `main` @ `62d0906`). This slice's
[`api-readiness.md`](./api-readiness.md) carries that verification forward — it
does **not** re-derive or optimistically re-classify it. One residual
re-confirmation (CSRF posture on the writes) is recorded as OQ-6 and carried
forward from the RF-1 resolution (cookie transport, no CSRF token at this pin).

---

## 7. User scenarios

Illustrative of *why* RF-2 exists. Not UX flows; they do not constrain layout.

### Scenario S1 — Platform Admin reviews the tenant roster

A1 signs in (RF-1), and opens the tenant list (SF-T1). `listTenants` returns all
tenants (A1 is platform admin); RF-2 renders the returned set as a table with no
client-side filter (OQ-2). A1 opens one tenant's detail (SF-T2, `readTenant`).
If the returned set is empty, RF-2 renders the empty state (OQ-8), not an error.

### Scenario S2 — Platform Admin onboards a new tenant

A1 opens the tenant create surface (SF-T3) and submits. RF-2 calls
`createTenant`. On success, RF-2 routes to the new tenant's detail/list and
re-fetches `listTenants`. A duplicate slug returns 409; RF-2 renders a
slug-conflict error inline on the form (FR-004-007), not a generic failure.

### Scenario S3 — Store Staff attempts a tenant create (rejected)

A5 (Store Staff) reaches the tenant create surface (RF-2 does not pre-hide it —
OQ-3) and submits. The backend returns 403. RF-2 renders the 403 via the shared
error surface with its `request_id`, leaving the operator in place. No frontend
authorization decision was made (FR-004-004).

### Scenario S4 — Tenant Admin lists stores in the active tenant

A3 has an active tenant resolved (RF-1). A3 opens the store list (SF-S1).
`listStores` returns the active tenant's stores; RF-2 renders them as a table.
The set is whatever the backend scopes to A3 (OQ-2). A tenant with no stores yet
renders the empty state with the create entry point (OQ-8).

### Scenario S5 — Store list/create with no active tenant

An operator reaches a store surface (SF-S1/SF-S3) with no active tenant resolved.
RF-2 routes to the RF-1 scope chooser first (OQ-4); if a `listStores` or
`createStore` call nonetheless returns **`401` ("No active tenant")**, RF-2
renders it as a **scope prompt** (resolve tenant first) — distinct from a
session-expiry `401`, which RF-1's interceptor handles via reactive refresh. RF-2
does not let a scope-precondition `401` trigger a sign-out (FR-004-006).

### Scenario S6 — Tenant Admin edits a store

A3 opens a store detail (SF-S2, `readStore`), edits fields (SF-S3,
`updateStore`). On success, RF-2 re-fetches the store and the store list. A
permission rejection (`403` insufficient role) is surfaced via the shared error
surface; a `404` is rendered uniformly. A `createStore` store-**code** conflict
(`409`) is surfaced **inline** on the code field (OQ-9), parallel to the tenant
slug conflict. RF-2 implements no field validation of its own (FR-004-004).

### Scenario S7 — Tenant switch re-scopes the store list

A3 switches active tenant via the RF-1 scope header (an RF-1 action). RF-2's
store list (SF-S1) re-fetches `listStores` for the new tenant; any store-scoped
RF-2 view is dropped and re-resolved against the new scope. RF-2 holds no
authoritative scope of its own — it reads RF-1's active context (OQ-5).

### Scenario S8 — Soft-delete a store with confirmation (SUPERSEDED by RT-400)

> Not implemented and no longer in scope — see the amendment at the top of this
> spec (decision 194). Kept as historical record.

A2 soft-deletes a store (SF-S3, `softDeleteStore`) behind a confirm step
(a destructive action; DESIGN.md `.btn-destructive` + single-primary rule). On
success, RF-2 re-fetches the store list. A 404 (already gone / no access) is
rendered uniformly regardless of cause (FR-004-008).

---

## 8. Functional requirements

Each is testable against this slice's plan, tasks, or implementation, and
anchored to a foundation FR or constitution principle.

### Consumption boundary

- **FR-004-001 — Exactly-ten consumption.** RF-2's implementation MUST consume
  exactly the ten operations in §6 and no others. `listMembers` and all of
  `memberships.openapi.yaml` (RF-5) MUST NOT be consumed by this slice, and RF-2
  MUST NOT add any new context operation (it reuses RF-1's provider — OQ-5).
  *Anchors:* foundation FR-009; foundation `spec.md` §6 RF-2/RF-5 rows.

- **FR-004-002 — Generated-client only.** RF-2 MUST call the ten operations
  through the generated client at `src/generated/` (slice 002). No hand-rolled
  `fetch`/XHR targeting a Data-Pulse-2 path is permitted. No OpenAPI byte
  (field name, slug pattern, status enum, validation rule) is copied into this
  repo.
  *Anchors:* Constitution Principle 8; foundation FR-006; slice 002 C-3.

- **FR-004-003 — Cookie transport, no bearer.** RF-2 MUST rely on the
  `dp2_session` HttpOnly+Secure+SameSite=Lax cookie that the browser attaches
  automatically (reusing RF-1's client wiring). JavaScript MUST NOT read the
  cookie, and the console MUST NOT attach an `Authorization: Bearer` header.
  *Anchors:* foundation `contracts/rf1-auth-context.md` §Transport; slice 002
  C-2; RF-1 FR-003-003.

### Backend-enforced authorization

- **FR-004-004 — No frontend authorization.** RF-2 MUST NOT contain any logic
  that decides whether the current actor may list, read, create, update, or
  soft-delete a tenant or store. The list is scoped by the backend response
  (OQ-2); actions are attempted and a backend 403 is rendered (OQ-3); RF-2 does
  NOT pre-hide or pre-disable a control by inspecting the actor's role. The
  `is_platform_admin` flag and `role_code` are rendered for display only.
  *Anchors:* Constitution Principle 7; foundation FR-002.

- **FR-004-005 — Tenant/store scope is server-resolved and reused from RF-1.**
  RF-2 reads the active tenant/store from RF-1's active-context provider; it
  holds no authoritative scope of its own and performs no optimistic scope
  mutation. Store operations are scoped to the active tenant the RF-1 provider
  holds. A scope change (an RF-1 action) re-fetches RF-2's lists.
  *Anchors:* foundation `data-model.md` E-3; RF-1 FR-003-005; OQ-5.

- **FR-004-006 — Scope before a store action; scope-`401` is not session-expiry.**
  A store surface MUST require a resolved active tenant. With none, RF-2 routes to
  RF-1's scope chooser before any store call. The stores contract returns
  **`401` ("No active tenant")** on `listStores` / `createStore`; RF-2 MUST
  distinguish this scope-precondition `401` from a session-expiry `401` and render
  it as a **scope prompt** (resolve tenant first), NOT route it through RF-1's
  reactive-refresh-then-sign-out path. (How the interceptor disambiguates the two
  401s is a `plan.md`/`research.md` mechanism, not a spec decision.)
  *Anchors:* PRODUCT.md Principle 1; stores contract `listStores`/`createStore`
  `401`; OQ-4.

### Error rendering

- **FR-004-007 — RF-2 error behaviors via the shared surface.** RF-2 MUST render
  its 4xx/5xx states through the RF-1 shared error/banner surface (reuse, not a
  new surface), mapping each status to the behavior the tenant/store contracts
  actually define at pin `62d0906`:
  - `403` permission rejection (`createTenant` / `softDeleteTenant` not platform
    admin; `createStore` / `updateStore` insufficient role) — rendered via the
    shared banner; **no pre-hide** (OQ-3).
  - `409` **slug** conflict on `createTenant`, and `409` **store-code** conflict
    on `createStore` — both rendered **inline** on the offending field (OQ-9).
  - `401` "No active tenant" on `listStores` / `createStore` — rendered as a
    **scope prompt**, distinct from a session-expiry `401` (FR-004-006).
  - `404` rendered **uniformly** on `readTenant`/`updateTenant`/`readStore`/
    `updateStore`/`softDeleteStore` (FR-004-008).
  - `5xx` rendered as a retry-able banner.

  All 4xx responses surface the backend `request_id` (where present) in the
  user-visible message. RF-2 implements **no** client-side field validation; the
  slug pattern, store-code length, and status enum are backend-enforced and
  surfaced as the backend reports them (AS-5). (The tenant/store contracts at this
  pin do **not** document a `422` or `429` on these ten operations; RF-2 does not
  invent them. If the backend later adds a validation/`429` envelope, the shared
  surface renders it without an RF-2 contract change.)
  *Anchors:* foundation `data-model.md` VD-4; RF-1 FR-003-007 (shared surface
  reuse); tenant/store contracts @ `62d0906`.

- **FR-004-008 — Uniform 404.** RF-2 MUST render tenant/store 404 responses
  identically regardless of cause (resource absent vs. no access), per the
  backend's leak-avoidance design.
  *Anchors:* foundation `data-model.md` VD-5; Constitution Principle 7.

### Scope and gates

- **FR-004-009 — No scaffold/package/CI change without approval.** This slice
  MUST NOT add or modify `package.json`, any lockfile, CI workflow, deployment
  config, or `.env*` at planning time. RF-2 is expected to reuse RF-1's
  dependencies and add **none**. If a clarify decision nonetheless requires a new
  runtime dependency, it is recorded in this slice's `plan.md` and approved per
  Constitution Principle 9 before implementation.
  *Anchors:* Constitution Principle 9, Principle 10; foundation FR-007, FR-010.

- **FR-004-010 — Foundation & prior-slice immutability at planning time.** This
  slice MUST NOT, at planning time, modify any file under
  `specs/001-console-foundation/`, `specs/002-tooling-and-scaffold/`,
  `specs/003-rf1-auth-shell/`, the constitution, or the committed RF-1/slice-002
  artifacts. The implementation slice's planned touch of the RF-1 app-shell
  gated-nav entry and router config is a tracked, gated change (§5, `tasks.md`),
  not a planning-time edit. If RF-2 surfaces a foundation/RF-1 defect, STOP and
  open an amendment slice.
  *Anchors:* foundation FR-014; Constitution §Governance.

- **FR-004-011 — Full FR-008 gate before code.** No RF-2 implementation begins
  until all five foundation FR-008 gates are explicitly approved for this slice:
  spec, plan, task list, API dependency map (RF-2 rows confirmed `stable`), and
  validation gates. Clearing a gate for another slice does not carry over.
  *Anchors:* foundation FR-008; Constitution §Implementation readiness gates.

- **FR-004-012 — No mock without approval.** RF-2 tests MUST NOT depend on a
  live Data-Pulse-2 instance (slice 002 C-5). Any mock of the ten operations
  requires explicit human approval, a `disposable: true` marking, and a removal
  task (Maestro playbook §Mock rule). This spec does not pre-authorize a mock.
  *Anchors:* slice 002 C-5; Maestro playbook §Mock rule.

### POS boundary

- **FR-004-013 — No POS surface.** RF-2 MUST NOT contain any POS terminal,
  pairing, or POS-operator surface, and MUST NOT write back to a POS device.
  Tenant/store management is admin-console-only. A6 never authenticates here.
  *Anchors:* Constitution Principle 3; foundation FR-003, §4 POS boundary rule.

---

## 9. Acceptance criteria

This **spec** is acceptable when all of the following hold:

- **AC-1.** All mandatory sections (Header, Background, Goals, Non-goals, Actors,
  Surfaces, Backend dependency, Scenarios, Functional requirements, Acceptance
  criteria, Open questions) are present with concrete content.
- **AC-2.** Exactly the ten operations in §6 are listed; no eleventh operation
  appears; `listMembers`, `memberships.openapi.yaml`, and the RF-1 context
  operations are explicitly named as excluded/reused-not-consumed.
- **AC-3.** Each surface SF-T1/T2/T3, SF-S1/S2/S3, and SF-L is defined with a
  one-line responsibility, and no surface introduces a frontend authorization
  decision (no pre-hide/pre-disable by role; no client-side list filter).
- **AC-4.** Every functional requirement FR-004-001..FR-004-013 is testable and
  anchored to a foundation FR or constitution principle.
- **AC-5.** No section names a router, state library, data-fetching library,
  table/component library, styling system, form library, framework primitive,
  file path under `src/` (other than the slice-002-fixed generated-client
  location `src/generated/` and the named-as-shared-touch RF-1 files in §5),
  route path, or component name. (Naming the *repository*, the *generated-client
  location*, the slice-002 stack *as fixed context*, and the RF-1 surfaces RF-2
  *reuses* is allowed; choosing RF-2's own primitives is not.)
- **AC-6.** The backend dependency (§6 + [`api-readiness.md`](./api-readiness.md))
  carries the foundation RF-2 `stable` verification forward by reference; it does
  not re-classify RF-2 optimistically and names the SHA pin (`62d0906`).
- **AC-7.** No byte of Data-Pulse-2 OpenAPI content (field name, slug pattern,
  status enum, validation rule) is copied into any file of this slice.
- **AC-8.** The spec quality checklist
  [`checklists/requirements.md`](./checklists/requirements.md) is filled in with
  each item marked, and no failing item is left unaddressed at hand-off.
- **AC-9.** Open questions (§10) name every cross-repo confirmation or deferred
  decision that must resolve before `/speckit-plan` or the FR-008 implementation
  gate.
- **AC-10.** The reuse-of-RF-1 posture is explicit: RF-2 mounts in RF-1's shell,
  reads RF-1's active context, renders via RF-1's error surface, and adds no new
  context operation and (expected) no new dependency.

---

## 10. Open questions

These block `/speckit-plan` or the FR-008 implementation gate, not the
acceptance of this spec as a `/speckit-specify` output.

- **OQ-1 — RF-2 stack primitives (table / form / list-query).** **RESOLVED
  (Session 2026-06-06).** Table rendering, create/edit form handling, and list
  query/pagination are resolved in [`plan.md`](./plan.md) Technical Context and
  [`research.md`](./research.md) R4-1..R4-5 — RF-2 **reuses** RF-1's primitives
  and is expected to add **no** new runtime dependency. Per AC-5 they are not
  named here. Any primitive that would add a dependency is selected pending
  Constitution Principle 9 approval at implementation.

- **OQ-2 — List scoping (frontend filter vs backend response).** **RESOLVED
  (Session 2026-06-06): backend-scoped only.** RF-2 renders exactly the set
  `listTenants` / `listStores` returns and applies no client-side authorization
  filter (FR-004-004). Reconciled into Scenarios S1/S4.

- **OQ-3 — Presenting unpermitted actions.** **RESOLVED (Session 2026-06-06):
  render and let the backend decide.** RF-2 does not pre-hide/pre-disable an
  action by role; a backend 403 is rendered via the shared error surface
  (FR-004-007). Role/`is_platform_admin` are display-only. Reconciled into
  Scenarios S3/S6.

- **OQ-4 — Store surface with no active tenant.** **RESOLVED (Session
  2026-06-06): require active tenant first.** Route to RF-1's scope chooser
  before any store call. Per the stores contract, `listStores`/`createStore`
  return **`401` ("No active tenant")** when none is set; RF-2 renders this
  scope-precondition `401` as a **scope prompt**, distinct from a session-expiry
  `401` (which RF-1's interceptor handles via reactive refresh). The interceptor
  disambiguation mechanism is a `plan.md`/`research.md` concern. Applies to
  Scenarios S5/S7. (Corrected 2026-06-06 after reading the stores contract
  end-to-end: the no-active-tenant signal is `401`, not `409`.)

- **OQ-5 — New context operation vs reuse.** **RESOLVED (Session 2026-06-06):
  reuse, zero new context op.** RF-2 reads active tenant scope and
  `memberships[]` from RF-1's active-context provider; the consumption boundary
  is exactly the ten tenant/store operations (FR-004-001).

- **OQ-6 — CSRF posture on the four writes + two soft-deletes.** **RESOLVED
  (2026-06-06): no CSRF token required**, carried forward from the RF-1
  resolution. The console-facing scheme is `cookieAuth` (apiKey in cookie
  `dp2_session`); to be re-confirmed against `tenants.openapi.yaml` +
  `stores.openapi.yaml` @ `62d0906` in this slice's `api-readiness.md` (same
  scheme as `auth`/`context`). RF-2 wires cookie transport with
  `credentials: "include"` and no CSRF-header plumbing (FR-004-003).

- **OQ-7 — Validation-gate definition.** FR-004-011 requires "validation gates
  defined and approved" as the 5th FR-008 gate. What are RF-2's validation gates
  (unit coverage threshold, the specific journeys for SF-T*/SF-S*, the
  no-`fetch`-against-DP2-paths grep, the no-frontend-authorization assertion)?
  Defined in `plan.md` / `tasks.md`, not here.

- **OQ-8 — Empty-state rendering.** **RESOLVED (Session 2026-06-06, headless):**
  a zero-row list is a **successful empty state** (distinct from loading and
  error) — short message plus the create entry point, which is still not
  pre-hidden by role (OQ-3); an unpermitted create 403s on attempt. Anchors the
  design brief's default/empty/loading/error/success state matrix. Reconciled
  into Scenarios S1/S4.

- **OQ-9 — Store-write `409` meaning.** **RESOLVED (2026-06-06, after reading the
  stores contract):** the `createStore` `409` is a **store-code conflict within
  the tenant** (duplicate `code`), not a "no active tenant" signal. RF-2 renders
  it **inline** on the code field (parallel to the tenant `createTenant` slug
  `409`), while the no-active-tenant case is the `401` of OQ-4. This split the
  formerly conflated store error into two distinct, contract-faithful behaviors.
  Reconciled into Scenario S6 and FR-004-007.

---

## 11. Assumptions (informational only)

Recorded so a future reader can challenge them explicitly.

- **AS-1.** The slice 002 stack and the RF-1 (slice 003) auth shell + active
  context + error surface + client wiring are fixed, merged context for RF-2.
  RF-2 consumes and reuses them and does not re-open those decisions.
- **AS-2.** The Data-Pulse-2 pin `62d0906` (slice 002 C-4) is the contract
  reference RF-2 plans against. A re-pin is a separate change outside this slice.
- **AS-3.** The ten tenant/store operations are exhaustive for tenant/store
  management. Membership/operator management (`listMembers`,
  `memberships.openapi.yaml`) is RF-5, not RF-2 (FR-004-001).
- **AS-4.** Tenant/store scope is fully server-resolved per request and read from
  RF-1's provider; RF-2 holds no authoritative copy (foundation `data-model.md`
  E-3).
- **AS-5.** All tenant/store field validation (slug format, name length, status
  enum) is backend-enforced; RF-2 surfaces backend 422s and implements no
  business validation of its own (FR-004-004).

---

## 12. Cross-reference index

- Constitution: `.specify/memory/constitution.md` (v1.0.1)
- Foundation spec: [`specs/001-console-foundation/spec.md`](../001-console-foundation/spec.md) (§4 actors, §5 RF-2 definition + sequencing, §6 RF-2/RF-5 rows, FR-002/003/006/007/008/009/010/014)
- Foundation data-model: [`specs/001-console-foundation/data-model.md`](../001-console-foundation/data-model.md) (E-3, VD-4, VD-5)
- Foundation api-readiness: [`specs/001-console-foundation/api-readiness.md`](../001-console-foundation/api-readiness.md) (§RF-2, pin `62d0906`)
- Scaffold slice: [`specs/002-tooling-and-scaffold/spec.md`](../002-tooling-and-scaffold/spec.md) (D-1..D-8, C-1..C-8)
- Auth-shell slice (reused): [`specs/003-rf1-auth-shell/spec.md`](../003-rf1-auth-shell/spec.md) (SF-2 shell, SF-3 active context, FR-003-003/004/005/007; shared error surface)
- This slice's companions: [`plan.md`](./plan.md), [`research.md`](./research.md), [`data-model.md`](./data-model.md), [`api-readiness.md`](./api-readiness.md), [`contracts/rf2-tenant-store.md`](./contracts/rf2-tenant-store.md), [`quickstart.md`](./quickstart.md), [`checklists/requirements.md`](./checklists/requirements.md)

---

**End of Feature Specification: RF-2 Tenant / Store Management.**
