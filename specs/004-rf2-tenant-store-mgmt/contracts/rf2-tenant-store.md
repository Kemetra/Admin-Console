# RF-2 Consumption Boundary (slice 004) — Tenant / Store Management

**Family**: RF-2 — Tenant / store management (foundation `spec.md` §5)
**Slice**: `004-rf2-tenant-store-mgmt`
**api-readiness state**: Both RF-2 rows `stable` (carried forward — see [`../api-readiness.md`](../api-readiness.md))
**Data-Pulse-2 pin**: `62d0906` (slice 002 C-4 — the SHA the generated client at `src/generated/` is produced against)
**Foundation reference**: foundation [`spec.md`](../../001-console-foundation/spec.md) §6 RF-2 row + [`api-readiness.md`](../../001-console-foundation/api-readiness.md) §RF-2

---

## Relationship to the foundation boundary

This is the **slice-level** consumption boundary for RF-2. It does not redefine
the boundary the foundation already set — it **restates the same ten operations**
the foundation RF-2 row enumerated (`tenants.openapi.yaml` 5 + `stores.openapi.yaml`
5) and maps each to the RF-2 surface (SF-T*/SF-S*) that consumes it. Adding any
operation beyond these ten is a scope expansion forbidden by spec FR-004-001 /
foundation FR-009.

This file does **NOT** replicate the OpenAPI contract. For request/response
shapes (field names, the slug pattern, the status enum, name length, validation
rules), the implementation reads the generated TypeScript client provided by
slice `002-tooling-and-scaffold` (`src/generated/schema.d.ts`). No byte of
`tenants.openapi.yaml` or `stores.openapi.yaml` is copied here (spec AC-7,
Constitution Principle 2).

---

## Operations consumed (the ten, mapped to surfaces)

> Convention: `<operationId> | <HTTP method> <path> | <upstream file>`. Upstream
> files are in `Data-Pulse-2/packages/contracts/openapi/`.

### Tenant management — `tenants.openapi.yaml`

| operationId | HTTP | Surface | RF-2 use |
| --- | --- | --- | --- |
| `listTenants` | `GET /api/v1/tenants` | SF-T1 | Renders the **backend-scoped** tenant set (all, if platform admin) as a table. No client-side authorization filter (spec OQ-2). Zero rows → empty state (OQ-8). |
| `readTenant` | `GET /api/v1/tenants/{tenant_id}` | SF-T2 | Read view of one tenant. **404** rendered uniformly regardless of cause (FR-004-008). |
| `createTenant` | `POST /api/v1/tenants` | SF-T3 | Create. **409** slug conflict → inline form error; **403** (not platform admin) → shared banner. (Contract documents 201/403/409 only — no 422.) |
| `updateTenant` | `PATCH /api/v1/tenants/{tenant_id}` | SF-T3 | Update tenant fields (name, status). Re-fetch detail + list on success. (Contract documents 200/404 only.) |
| `softDeleteTenant` | `DELETE /api/v1/tenants/{tenant_id}` | SF-T2/SF-T3 | Soft-delete behind a confirm step (204). **403** (not platform admin) → shared banner. Re-fetch list on success. |

### Store management — `stores.openapi.yaml`

| operationId | HTTP | Surface | RF-2 use |
| --- | --- | --- | --- |
| `listStores` | `GET /api/v1/stores` | SF-S1 | Renders the **active tenant's** store set (scope from RF-1's provider) as a table. **401** "No active tenant" → scope prompt, distinct from session-expiry 401 (FR-004-006, OQ-4). Zero rows → empty state. |
| `readStore` | `GET /api/v1/stores/{store_id}` | SF-S2 | Read view of one store. **404** uniform. |
| `createStore` | `POST /api/v1/stores` | SF-S3 | Create scoped to the **active tenant** (no tenant picker in the form — FR-004-005). **401** no-active-tenant → scope prompt (OQ-4); **403** insufficient role → banner; **409** store-**code** conflict within tenant → inline on the code field (OQ-9). |
| `updateStore` | `PATCH /api/v1/stores/{store_id}` | SF-S3 | Update store fields (name, is_active). Re-fetch on success. (Contract documents 200/404 only.) |
| `softDeleteStore` | `DELETE /api/v1/stores/{store_id}` | SF-S2/SF-S3 | Soft-delete behind a confirm step (204). **404** uniform. Re-fetch store list on success. **Superseded by RT-400 (decision 194): the Console does not call this op.** |

### Context — REUSED from RF-1, NOT consumed by RF-2

RF-2 reads the active tenant scope and `memberships[]` from **RF-1's
active-context provider** (slice 003, SF-3). It adds **zero** new context
operation. The store operations are implicitly scoped to the active tenant the
RF-1 provider holds; switching scope (an RF-1 action) re-fetches RF-2's lists.
This is the resolved spec OQ-5.

### Explicitly NOT consumed by RF-2

Named so a reviewer sees they were considered and intentionally excluded
(spec FR-004-001), not overlooked:

- `listMembers` (`GET /api/v1/tenants/{tenant_id}/members`, `tenants.openapi.yaml`)
  — membership **listing** belongs to **RF-5** (operator / admin management;
  foundation §6 RF-5 row). RF-2 manages tenants/stores, not the identities within.
- All of `memberships.openapi.yaml` (`createInvitation` / `updateMembership` /
  `revokeMembership` / `acceptInvitation`) — **RF-5**.
- `getActiveContext` / `switchActiveTenant` / `switchActiveStore` /
  `clearActiveStore` (`context.openapi.yaml`) — owned and consumed by **RF-1**;
  RF-2 reads their result via RF-1's provider, it does not call them.

---

## Transport & security posture

Reused from RF-1 (not re-derived):

- **Session transport.** `dp2_session` HttpOnly + Secure + SameSite=Lax cookie;
  browser attaches it on every same-site request; JavaScript never reads it
  (spec FR-004-003). RF-2 reuses RF-1's `openapi-fetch` client
  (`credentials: "include"`).
- **No bearer.** The console MUST NOT attach an `Authorization: Bearer` header.
- **CSRF — RESOLVED (OQ-6).** Re-confirmed against `tenants.openapi.yaml` +
  `stores.openapi.yaml` @ `62d0906`: global `security: [cookieAuth: []]`, the
  `apiKey`-in-cookie `dp2_session` scheme, no `X-CSRF-Token`/`X-XSRF` parameter
  or header anywhere in either contract. No CSRF-header plumbing (see
  [`../api-readiness.md`](../api-readiness.md)).

---

## Error contract behavior (RF-2 specifics)

Rendered through RF-1's shared error/banner surface (reuse, not a new surface);
mapped to the statuses the contracts actually document at pin `62d0906`
(FR-004-007/008):

- **`403` permission** (`createTenant`/`softDeleteTenant` not platform admin;
  `createStore`/`updateStore` insufficient role) — rendered via the shared banner
  with `request_id`; the action was **attempted, not pre-blocked** (spec OQ-3).
  RF-2 never pre-hides or pre-disables a control by role.
- **`404` tenant/store** (`readTenant`/`updateTenant`/`readStore`/`updateStore`/
  `softDeleteStore`) — rendered **identically** regardless of cause (resource
  absent vs no access; FR-004-008).
- **`409` slug conflict** on `createTenant` — inline on the slug field.
- **`409` store-code conflict** on `createStore` — inline on the code field
  (OQ-9), parallel to the tenant slug conflict.
- **`401` "No active tenant"** on `listStores`/`createStore` — scope prompt
  (resolve tenant first; FR-004-006, OQ-4), **distinct** from a session-expiry
  `401`. RF-2 must not let this scope-precondition `401` trigger RF-1's
  refresh-then-sign-out path.
- **`5xx`** — retry-able banner.
- **Any 4xx** — surface the backend `request_id` where present (data-model VD-4).

> Contract note: the tenant/store contracts at this pin document **no `422` and
> no `429`** on these ten operations. Field validation (slug pattern, store-code
> length, status enum) is backend-enforced and surfaced as the backend reports
> it; RF-2 asserts no `422`/`429` envelope it has not seen (AS-5; Principle 2 /
> FR-011). The two update verbs are **`PATCH`**.

---

## State transitions consumed

Maps to [`../data-model.md`](../data-model.md) (per-resource CRUD render-states).
RF-2 drives no session-lifecycle transition — that is RF-1's ST-1; RF-2 reads the
resulting AUTHENTICATED (context resolved) state.

---

## What this contract does NOT authorize

- ❌ Implementation of the RF-2 UI. Requires the FR-008 five-gate approval for
  slice 004.
- ❌ Choice of a router, state store, data-fetching library, form library, table
  library, or notification surface — RF-2 **reuses** RF-1's
  ([`../research.md`](../research.md) R4-1..R4-5).
- ❌ Adding any operation beyond the ten above, or any new context operation
  (spec FR-004-001, OQ-5).
- ❌ Consuming `listMembers` or `memberships.openapi.yaml` (RF-5).
- ❌ Vendoring or copying any byte of `tenants.openapi.yaml` /
  `stores.openapi.yaml` / `context.openapi.yaml`.
- ❌ Regenerating or re-pinning `src/generated/schema.d.ts`.
- ❌ Building a mock server (requires explicit approval; spec FR-004-012).
- ❌ Editing `src/shell/AppShell.tsx` / `src/App.tsx` at planning time
  (the gated-nav un-gate + route registration are tracked implementation tasks).

---

**End of RF-2 Consumption Boundary (slice 004).**
