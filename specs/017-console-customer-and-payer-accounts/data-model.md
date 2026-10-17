# 017 — Data Model (render-side projection only)

**Slice:** 017 · **Date:** 2026-06-17
**017 owns NO store of record.** DP-2 035 owns the payer-account state. This document describes only the **render-side projection** the Console holds in TanStack Query cache for display — never a second source of truth (spec §9).

---

## PayerAccount (render projection — from DP-2 `PayerAccount`)

| Field | Type | Render note |
|---|---|---|
| `payerRef` | uuid | row identity |
| `category` | `credit_customer \| corporate \| insurer` | badge/label |
| `displayName` | string (1..200) | primary label |
| `externalRef` | string \| null | secondary; hidden if null |
| `status` | `active \| suspended` | **read-only** in v1 (no transition op — OQ-CON-EDIT deferred) |
| `storeId` | uuid \| null | "tenant-wide" when null |
| `version` | integer ≥ 0 | **read-only**; carried for future optimistic-concurrency (no update op in v1) |

> `status` + `version` are displayed but **not editable** — v1 has no `consoleUpdatePayerAccount`/suspend op (AD-SALE-SETTLEMENT-2 ratified defer). Rendering them read-only is deliberate, not an oversight.

## PayerAccountPage (list projection)

- `items: PayerAccount[]` (newest-first, contract bound `maxItems 200`).
- `nextCursor: string | null` — opaque keyset cursor; **null = last page**.

## Cache + invalidation design (T006)

- **List query key:** keyed by active tenant + `category` filter + opaque `cursor`.
- **Create → invalidate:** a successful `201` invalidates the list query and re-fetches; **no optimistic mutation** (the server is authoritative; render only what it returns).
- **Pagination:** pass the prior page's `nextCursor` as the next `cursor`; treat `null` as the end (FR-007).

## Create form fields (T009 — exactly `PayerAccountCreate`)

`category` (enum select, required) · `displayName` (text, 1..200, required) · `externalRef` (optional) · `storeId` (optional; null = tenant-wide). `creditTerms` was removed in settlement.yaml 2.0.0 (RT-417/RT-421); `externalRef` is the ERPNext Customer link.

## State matrix (for the post-gate unit-test plan, T012)

`default → submitting → (success: render PayerAccount + invalidate list) | (400: InlineError) | (401/403: session/RBAC) | (409: non-disclosing replay/conflict banner) | (500: failure banner)`. Replay of the same submission (same Idempotency-Key) → single account.

## Not modeled (out of scope)

No receivable/claim/reconciliation entity (018/019); no payer mutation state machine (deferred v1.1); no tax/credit-terms math (G6 / tax-pending).
