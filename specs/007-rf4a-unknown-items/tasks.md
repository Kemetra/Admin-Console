# Tasks — RF-4a Unknown-Items Review Queue

Generated from plan.md. TDD where practical (boundary + mapping tests are
authored alongside the layer they cover). `[X]` = done in this slice.

## Phase 2 — Codegen
- [X] T001 Add `UnknownItems` source (`packages/contracts/openapi/catalog/unknown-items.yaml`) to `openapi-ts.config.ts` `OPENAPI_SOURCE_SPECS` (pin unchanged `62d0906`).
- [X] T002 `pnpm generate:client`; verify `tenantAdminListUnknownItems` / `tenantAdminInspectUnknownItem` / `tenantAdminDismissUnknownItem` appear in `src/generated/schema.d.ts`.

## Phase 3 — Data layer
- [X] T003 `src/lib/unknown-items-queries.ts`: typed wrappers `listUnknownItems(params)`, `inspectUnknownItem(id)`, `dismissUnknownItem(id)` over `apiClient`; query keys; `mapUnknownItemError` (per-op documented statuses; `forbidden` 403 branch; dismiss 409 `already_reconciled`; no 422/429).
- [X] T004 `src/unknown-items/useUnknownItemQueries.ts`: TanStack hooks (`useUnknownItemList`, `useUnknownItemInspect`, `useUnknownItemDismiss`) returning result-encoded errors.
- [X] T005 `src/unknown-items/useUnknownItemScope.ts`: read active tenant/store from `ActiveContextProvider` (mirror `useStoreScope`).

## Phase 4 — Surfaces
- [X] T006 `src/unknown-items/UnknownItemList.tsx`: DataTable + filter/sort/group control row + ListState/Banner; row activates inspect.
- [X] T007 `src/unknown-items/UnknownItemInspectDrawer.tsx`: Drawer rendering `ReviewQueueItem` (no `sale_context`) + dismiss entry.
- [X] T008 `src/unknown-items/UnknownItemDismiss.tsx`: ConfirmDelete-style confirm calling dismiss; invalidates list on success.
- [X] T009 `src/shell/rf4aRoutes.tsx`: route fragment (`unknown-items`); mount in `App.tsx`.

## Phase 5 — Tests
- [X] T010 `tests/unit/rf4a-queries.test.ts`: `mapUnknownItemError` per-op status coverage + no-undocumented-status assertion.
- [X] T011 `tests/unit/rf4a-list.test.tsx`: list renders rows / empty / 403 banner; filter/sort/group re-keys.
- [X] T012 `tests/unit/rf4a-boundary.test.ts`: VG-3 (no fetch/axios/Bearer), VG-4 (no link/create-product/reopen/bulk-dismiss/membership/context op), VG-5 (no role-conditioned hiding).
- [X] T013 `e2e/rf4a-review-queue.spec.ts`: review-queue journey (list → inspect → dismiss) + a11y assertions.

## Phase 6 — Validation
- [X] T014 `pnpm build` (tsc --noEmit + vite build) — typecheck PASS.
- [X] T015 `pnpm test` (vitest) — RF-4a unit + boundary PASS.
- [X] T016 `pnpm lint` (biome) — PASS.

## RT-724 — RF-4b actions
- [X] T017 Data layer: `createProductFromUnknownItem`, `reopenUnknownItem`, `bulkDismissUnknownItems` (Idempotency-Key on the two keyed ops); `mapUnknownItemError` for `validation_error`, `alias_conflict`, `target_unavailable`, `already_reconciled`, `idempotency_key_conflict`, `forbidden`, 404, 425.
- [X] T018 Hooks: create / reopen / bulk-dismiss mutations; no automatic retry; a key is reused only for a manual retry after an unsettled outcome (5xx, 425).
- [X] T019 Drawer: Create product form (name + tax category; input survives errors) and Reopen for dismissed items.
- [X] T020 Queue: status filter; row selection + bulk-dismiss bar with a counted confirm and per-outcome result banners.
- [X] T021 Nav: the Unknown items entry leaves the RF-4 gate (Catalog section; owner / tenant_admin / store_manager).
- [X] T022 Tests: `rf4b-queries`, `rf4b-actions`, boundary + nav updates; e2e S5–S7 with axe.
- [ ] Deferred: link to an existing product (needs a catalog read contract).
