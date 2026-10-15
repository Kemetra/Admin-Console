# Tasks: RF-2 Tenant / Store Management

**Input**: Design documents from `specs/004-rf2-tenant-store-mgmt/`
**Prerequisites**: plan.md, spec.md (clarified Session 2026-06-06), research.md, data-model.md, design-brief.md, contracts/rf2-tenant-store.md, quickstart.md

> **⛔ GATE BANNER — READ BEFORE EXECUTING ANY TASK.** This is the 3rd FR-008
> gate input, **not** authorization to write code. No task below may be executed
> until the foundation FR-008 five-gate is explicitly approved for slice 004
> (spec + plan + tasks + API map + validation gates). RF-2 is expected to add
> **no** new runtime dependency (it reuses RF-1's); if any clarify/impl decision
> nonetheless adds one, it must clear Constitution Principle 9 first. Until the
> gate clears, `tasks.md` is a **plan of record**. Generating it does not start
> implementation (spec FR-004-011; Non-goals §3).

**Tests**: Included and **required** — VG-1 (Vitest unit coverage) and VG-2
(Playwright journeys) are FR-008 validation gates (plan.md §Validation-gate
shape), not optional. Tests against an approved `disposable: true` mock only;
never live DP2 (FR-004-012, slice 002 C-5).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no incomplete dependencies)
- **[Story]**: `[USn]` ≡ spec.md Scenario **Sn** (US1≡S1 … US8≡S8). Note the two
  axes: story labels map to *scenarios*, while phases group by *surface*
  (SF-T*/SF-S*/SF-L). A surface phase can therefore carry tasks from several
  scenarios.
- Exact file paths included. Repo is a React 19 + Vite SPA; the console owns zero
  domain entities (data-model.md). RF-2 **reuses** RF-1's primitives.
- **🔗 SHARED-FILE**: marks a task that edits a file RF-1 owns — sequence it; do
  not run in parallel with another slice touching the same file.

## Path conventions (this repo)

- Source root: `src/`. RF-2 areas: `src/tenants/` (SF-T1/T2/T3), `src/stores/`
  (SF-S1/S2/S3), shared list/table/form bits in `src/components/`.
- **Reused (do not re-derive):** `src/lib/client.ts` + `src/lib/query.ts`
  (client/query), `src/App.tsx` (router), `src/context/`
  (`ActiveContextProvider`), `src/components/Banner.tsx` +
  `src/components/InlineError.tsx`, `src/shell/AppShell.tsx` + `ScopeHeader.tsx`,
  `src/styles/tokens.css`. Generated client `src/generated/` — never edited.
- Tests: `tests/unit/` (Vitest), `tests/e2e/` (Playwright).

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Confirm gate + reuse posture. Blocks everything.

- [ ] T001 Confirm FR-008 gate approval for slice 004 is recorded before any further task runs (spec FR-004-011). If not approved, STOP.
- [ ] T002 Confirm **no** new runtime dependency is required: RF-2 reuses RF-1's react-router / TanStack Query / openapi-fetch client / ActiveContextProvider / Banner / InlineError (research R4-1..R4-5). If a new dep is unavoidable, STOP and obtain Constitution Principle 9 approval first (FR-004-009).
- [ ] T003 🔗 SHARED-FILE Add `packages/contracts/openapi/tenants.openapi.yaml` + `stores.openapi.yaml` to `OPENAPI_SOURCES` in `openapi-ts.config.ts` and re-run `pnpm generate:client` **at the same pin `62d0906`** so `src/generated/schema.d.ts` exposes the ten RF-2 operations (`listTenants`/`readTenant`/`createTenant`/`updateTenant`/`softDeleteTenant`, `listStores`/`readStore`/`createStore`/`updateStore`/`softDeleteStore`). Regeneration at the pinned SHA (NOT a re-pin); edits a slice-002 scaffold config — acknowledge at the FR-008 gate. Sequence vs sibling slices (each adds its own contract to the same config). Do not hand-edit the generated output.
- [ ] T004 [P] Re-confirm OQ-6 CSRF posture against the pinned `tenants.openapi.yaml` + `stores.openapi.yaml` (cookieAuth, no CSRF token); already recorded resolved in `api-readiness.md` — verify no demotion since.

**Checkpoint**: Gate approved, reuse confirmed (zero new deps), client current, CSRF posture known.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The RF-2-specific shared plumbing built ON TOP OF RF-1's reused layer. No surface (Phase 3+) work begins until this completes.

**⚠️ CRITICAL**: Reuse RF-1's client/query/router/error surface; do not re-create them.

- [ ] T005 Add the RF-2 query keys + typed-error mapping helper in `src/lib/rf2-queries.ts` over the **reused** openapi-fetch client, mapping the statuses the tenant/store contracts actually define @ `62d0906`: 403→banner; 404→uniform; 409→inline conflict (tenant slug | store code, OQ-9); store **401** "No active tenant"→scope prompt **distinct from session-expiry 401** (must not trigger RF-1 sign-out; FR-004-006, OQ-4); 5xx→retry-able banner. No 422/429 asserted (contracts document none). No new client (design-brief §6; FR-004-007/008).
- [ ] T006 [P] Implement the shared list-table presenter in `src/components/DataTable.tsx` using the DESIGN.md `.data-table` from `src/styles` tokens (tables-over-cards; row→detail; 36px touch floor; AA contrast). No table library (research R4-4).
- [ ] T007 [P] Implement the shared empty-state + loading-skeleton presenters in `src/components/ListState.tsx` (default/empty/loading distinct; empty is a successful zero-row state, not an error — spec OQ-8, design-brief §6). Reuse Banner for error state.
- [ ] T008 [P] Implement the shared destructive-confirm affordance in `src/components/ConfirmDelete.tsx` (`.btn-destructive` + confirm step; names the resource; single-primary rule). Used by SF-T3/SF-S3 soft-delete (design-brief §7).
- [ ] T009 🔗 SHARED-FILE Register the RF-2 routes in `src/App.tsx` inside RF-1's existing protected boundary (no new public route; RF-2 is behind the RF-1 401→sign-in guard). Sequence this; do not parallelize with another slice touching the router (plan.md §Shared-file touches).
- [ ] T010 🔗 SHARED-FILE Un-gate the "Stores" entry in `src/shell/AppShell.tsx` `GATED_NAV` (promote to an active nav link to SF-S1; leave Catalog/Unknown items/Operators/Audit gated). Sequence this; do not parallelize with another slice touching AppShell (plan.md §Shared-file touches).

**Checkpoint**: RF-2 query/error mapping, shared table/list/confirm presenters, routes registered, "Stores" nav un-gated.

---

## Phase 3: SF-T1/T2/T3 Tenant Surfaces — Scenarios S1/S2/S3/S8 (Priority: P1) 🎯 MVP

**Goal**: The tenant roster, detail, and create/edit/soft-delete — the parent scope (plan.md build order #1).

**Independent Test**: Given a mocked `listTenants`, the roster renders the backend-scoped set as a table with no client filter; zero rows → empty state; a create attempt by an unpermitted actor renders a 403 (no pre-hide); a duplicate slug renders inline; soft-delete behind a confirm re-fetches the list; a 404 detail renders uniformly.

### Tests for tenant surfaces

- [ ] T011 [P] [US1] Unit test the tenant-list state matrix (default/empty/loading/error/success; backend-scoped, no client filter) in `tests/unit/tenant-list.test.tsx` (VG-1; spec OQ-2/OQ-8).
- [ ] T012 [P] [US2] Unit test the tenant create/edit branching (success / 409 slug-conflict inline / 403 banner on create+soft-delete / 404 uniform on update) in `tests/unit/tenant-form.test.tsx` (VG-1; FR-004-007). No 422/429 (createTenant contract documents 201/403/409 only).
- [ ] T013 [P] [US1] E2E tenant roster → detail (S1), incl. empty state, in `tests/e2e/tenant-roster.spec.ts` (VG-2, Scenario S1).
- [ ] T014 [P] [US2] E2E tenant onboard + 409 slug-conflict (S2) in `tests/e2e/tenant-create.spec.ts` (VG-2, Scenario S2).
- [ ] T015 [P] [US3] E2E unpermitted tenant-create attempt → 403 rendered, operator stays in place (S3), in `tests/e2e/tenant-403.spec.ts` (VG-2, Scenario S3, FR-004-004).

### Implementation for tenant surfaces

- [ ] T016 [US1] Implement the tenant list (SF-T1) in `src/tenants/TenantList.tsx` using the shared DataTable + ListState: render the backend-scoped `listTenants` set (no client filter — OQ-2); zero rows → empty state with create entry point (OQ-8); the "New tenant" primary is rendered for all (no role pre-hide — OQ-3).
- [ ] T017 [US1] Implement the tenant detail (SF-T2) in `src/tenants/TenantDetail.tsx` via `readTenant`: field rows + status `.badge`; `is_platform_admin`/`role_code` display-only badges (FR-004-004); 404 uniform (FR-004-008); edit + soft-delete rendered for all.
- [ ] T018 [US2] Implement the tenant create/edit form (SF-T3) in `src/tenants/TenantForm.tsx` as an uncontrolled native form (no form library; research R4-3): calls `createTenant`/`updateTenant`; **409 slug conflict → InlineError on the slug field**; 403 → Banner (create not platform admin); 404 uniform on update. No client-side validation; backend field errors render inline as reported (FR-004-004/AS-5). No 422/429 asserted (contract documents none).
- [ ] T019 [US8] Implement tenant soft-delete in `src/tenants/useTenantDelete.ts` calling `softDeleteTenant` behind the shared ConfirmDelete; re-fetch the list on success; 404 uniform (S8, FR-004-008).

**Checkpoint**: Tenant surfaces functional + independently testable against a mock.

---

## Phase 4: SF-S1/S2/S3 Store Surfaces — Scenarios S4/S5/S6/S7/S8 (Priority: P2)

**Goal**: The store roster/detail/create-edit/soft-delete, scoped to the active tenant from RF-1 (plan.md build order #2).

**Independent Test**: With an active tenant resolved (RF-1), `listStores` renders that tenant's stores; with no active tenant a store surface pre-gates to the RF-1 scope chooser and a residual `401` renders as a scope prompt (not a sign-out); the store form has no tenant picker; a store-code `409` renders inline; a tenant switch re-scopes the list; soft-delete re-fetches.

### Tests for store surfaces

- [ ] T020 [P] [US4] Unit test the store-list state matrix incl. no-active-tenant **pre-gate** + residual `401` → scope prompt (not sign-out) in `tests/unit/store-list.test.tsx` (VG-1; FR-004-006, OQ-4).
- [ ] T021 [P] [US6] Unit test the store create/edit branching (success / **409 store-code conflict inline** / 403 banner / **401 no-active-tenant scope prompt, not sign-out** / 404 uniform) and the **no tenant picker** invariant in `tests/unit/store-form.test.tsx` (VG-1; FR-004-005/007, OQ-9). No 422/429 (contracts document none).
- [ ] T022 [P] [US4] E2E store list in the active tenant (S4), incl. empty state, in `tests/e2e/store-list.spec.ts` (VG-2, Scenario S4).
- [ ] T023 [P] [US5] E2E store list/create with no active tenant → scope prompt (residual `401`, not a sign-out) (S5) in `tests/e2e/store-scope-prompt.spec.ts` (VG-2, Scenario S5, FR-004-006, OQ-4).
- [ ] T024 [P] [US7] E2E tenant switch re-scopes the store list (S7) in `tests/e2e/store-rescope.spec.ts` (VG-2, Scenario S7, OQ-5).
- [ ] ~~T025 [P] [US8] E2E store soft-delete + uniform 404 (S8) in `tests/e2e/store-delete.spec.ts` (VG-2, Scenario S8).~~ **Superseded by RT-400 (decision 194): store soft-delete retired; the spec was removed in PR #101.**

### Implementation for store surfaces

- [ ] T026 [US4] Implement the store list (SF-S1) in `src/stores/StoreList.tsx`: **pre-gate on the active tenant** read from the **reused** `ActiveContextProvider` — if no active tenant, route to RF-1's scope chooser and do **not** issue `listStores` (research R4-2 option (a), so the scope `401` is avoided, not interpreted as a sign-out). With an active tenant, render `listStores` via the shared DataTable + ListState; a residual `401` "No active tenant" → scope prompt (FR-004-006, OQ-4), never a sign-out; zero rows → empty state.
- [ ] T027 [US4] Implement the store detail (SF-S2) in `src/stores/StoreDetail.tsx` via `readStore`: field rows; 404 uniform (FR-004-008).
- [ ] T028 [US6] Implement the store create/edit form (SF-S3) in `src/stores/StoreForm.tsx`: uncontrolled native form scoped to the **active tenant** with **no tenant picker** (scope shown as a read-only line — FR-004-005); pre-gate on active tenant (as T026); calls `createStore`/`updateStore`; **409 store-code conflict → inline on the code field** (OQ-9); residual **401 no-active-tenant → scope prompt** (not a sign-out; OQ-4); 403 Banner; 404 uniform on update. (No 422/429 — contracts document none; backend field errors render inline as reported.)
- [ ] ~~T029 [US8] Implement store soft-delete in `src/stores/useStoreDelete.ts` calling `softDeleteStore` behind ConfirmDelete; re-fetch the store list on success (S8).~~ **Superseded by RT-400 (decision 194): not implemented; `softDeleteStore` is not called from the Console.**
- [ ] T030 [US7] Wire store-list re-scoping to the RF-1 active-tenant switch (invalidate/re-fetch `listStores` on scope change; drop store-scoped views) in `src/stores/useStoreScope.ts` (S7; RF-2 holds no authoritative scope — OQ-5).

**Checkpoint**: All RF-2 surfaces functional; tenant and store management complete.

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Validation gates VG-3/VG-4/VG-5, accessibility, and closeout.

- [ ] T031 [P] VG-3 boundary grep: assert no hand-written `fetch(`/XHR targets a DP2 path, no OpenAPI bytes (field name, slug pattern, status enum, validation rule) copied, no `Authorization: Bearer` set by the console (FR-004-002/003). Wire as a CI/test check.
- [ ] T032 [P] VG-4 no-scope-creep grep: assert RF-2 references none of `listMembers`, the four `memberships.openapi.yaml` ops, and calls **no** context operation (`getActiveContext`/`switchActiveTenant`/`switchActiveStore`/`clearActiveStore` are RF-1's; RF-2 reads via the provider) (FR-004-001, OQ-5).
- [ ] T033 [P] VG-5 no-frontend-authorization assertion: assert RF-2 contains no role/`is_platform_admin`-conditioned hiding or disabling of a list, action, or route; lists render the backend set; actions are rendered and 403s caught; roles are display-only (FR-004-004; OQ-2/OQ-3). Wire as a test/lint check.
- [ ] T034 [P] Accessibility pass: keyboard nav for tables + forms, AA contrast, screen-reader labels on the tenant/store forms and table rows, `aria-invalid` on field errors, `prefers-reduced-motion` respected (PRODUCT.md Accessibility; DESIGN.md rule 10).
- [ ] T035 [P] Confirm VG-1 unit coverage ≥ repo threshold for the tenant/store state-matrix + error-mapping logic.
- [ ] T036 Run quickstart.md validation walkthrough end-to-end against the approved mock; remove the disposable mock per its removal task (FR-004-012).

---

## Dependencies & Execution Order

### Phase dependencies

- **Setup (P1)**: T001 gates everything; T002 confirms zero new deps.
- **Foundational (P2)**: depends on Setup. T005–T008 build the RF-2 shared
  presenters over RF-1's reused layer; T009/T010 are 🔗 SHARED-FILE touches
  (router + AppShell) — sequence them. Blocks all surfaces.
- **Tenant surfaces (P3)**: first surface group (plan.md order); MVP.
- **Store surfaces (P4)**: depend on the tenant patterns + RF-1's
  ActiveContextProvider for scope.
- **Polish (P5)**: depends on all surfaces.

### Surface build order (plan.md, not UX flow)

Tenant (SF-T1→T2→T3) → Store (SF-S1→S2→S3). Stores need a resolved active tenant
(scope before action); tenant surfaces establish the create/edit/error patterns
stores reuse.

### Parallel opportunities

- Setup: T003/T004 [P].
- Foundational: T006/T007/T008 [P] (different presenter files). T009/T010 are
  🔗 SHARED-FILE — **not** parallel with each other or with other slices.
- Within each surface group: the test tasks marked [P] run together; impl files
  in different paths marked [P] run together.
- Polish: T031–T035 all [P].

---

## Implementation Strategy

### MVP (tenant surfaces)

1. Setup (gate approved, zero new deps, client current, CSRF known)
2. Foundational (RF-2 query/error mapping, shared table/list/confirm, routes,
   "Stores" un-gated)
3. Tenant list → detail → create/edit/soft-delete → **STOP and VALIDATE** the
   tenant roster + onboard loop (S1/S2) end-to-end
4. This is the minimum that proves RF-2 manages the parent scope.

### Incremental delivery

1. MVP above (tenant surfaces, scenarios S1/S2/S3/S8-tenant)
2. Add store surfaces (S4/S5/S6/S7/S8-store) scoped to the active tenant
3. Polish: VG-3/VG-4/VG-5 greps, a11y, coverage, quickstart validation

---

## Notes

- [P] = different files, no incomplete dependencies.
- Every task traces to a surface (SF-T*/SF-S*/SF-L ↔ US1–8) and to the
  design-brief.md state matrix; UI tasks reuse `src/styles` tokens + RF-1
  components rather than re-deriving them.
- RF-2 adds **no** new runtime dependency (reuse of RF-1's).
- The two 🔗 SHARED-FILE touches (`src/App.tsx`, `src/shell/AppShell.tsx`)
  are sequenced for implement, not parallelized.
- Tests use an approved `disposable: true` mock only; never live DP2 (FR-004-012).
- Commit after each task or logical group.
- **Nothing here executes until the FR-008 gate clears (see gate banner).**
