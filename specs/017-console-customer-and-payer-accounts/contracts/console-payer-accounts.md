# 017 — Consumed Contract: Payer Accounts (CON-G1 pin)

**Slice:** 017 · **Date:** 2026-06-17 · **Gate:** CON-G1 (pin the consumed boundary).
**This is a CONSUME-ONLY design doc — it authors NO OpenAPI YAML.** The authoritative contract is DP-2 `packages/contracts/openapi/settlement/settlement.yaml` (**`2.0.0`** since RT-417, Backend-Core #779; payer routes implemented by RT-418, #787; the `1.0.0-draft` @ `cb4a7e5` this doc was first written against is superseded). Shapes below are transcribed read-only for the Console consumer; if they ever diverge from DP-2 `origin/main`, DP-2 is authority — re-run the recheck.

---

## The whole of 017's consumed surface — exactly two ops

### 1. `consoleCreatePayerAccount` — `POST` payer-accounts
- **Header (required):** `Idempotency-Key` (contract `IdempotencyKey` parameter).
- **Body `PayerAccountCreate`** (`additionalProperties:false`):
  - `category` *(required)* — `PayerCategory` enum `credit_customer | corporate | insurer`.
  - `displayName` *(required)* — string, 1..200.
  - `externalRef` — string | null: the payer's **ERPNext Customer link** (opaque to Backend-Core; null = not linked; a blank or whitespace-only value is a 400).
  - ~~`creditTerms`~~ — **removed in 2.0.0 (RT-417)**: ERPNext owns payment terms; the body is strict, so sending it is a 400.
  - `storeId` — uuid | null (null = tenant-wide).
  - **NOT sent:** `tenant_id`, actor — server-resolved (§XII).
- **Responses:**
  - `201` → `PayerAccount` projection (render it).
  - `400` `ValidationFailure` → `InlineError`.
  - `401` `Unauthorized` / `403` `Forbidden` → session/RBAC handling.
  - `409` `Conflict` → idempotency-key replay / version conflict — deterministic, **non-disclosing** banner.
  - `500` `SystemFailure` → generic failure banner.

### 2. `consoleListPayerAccounts` — `GET` payer-accounts
- **Query params:** `PayerCategoryQuery` (`category`), `Cursor` (opaque), `PageSize` (1..200).
- **Responses:** `200` → `PayerAccountPage` (newest-first); `400`/`401`/`403`/`500` as above. **No `409`.**

## Typed wrappers to add (T005 — definition only, no code authored here)

Two wrappers in `src/lib/client.ts`, in the existing `{ status, data, error }` shape (mirrors `signIn`/`getActiveContext`):

```
consoleCreatePayerAccount(body: PayerAccountCreate, idempotencyKey: string)
  → { status, data?: PayerAccount, error? }      // sends Idempotency-Key header (FR-005)
consoleListPayerAccounts(params: { category?, cursor?, page_size? })
  → { status, data?: PayerAccountPage, error? }
```
Do **not** hand-edit `src/generated/client.ts`; the wrappers compose the generated typed ops.

## OQ-CON-IDEMPOTENCY (decided)

Generate **one stable `Idempotency-Key` (UUID) per submission**; replay the **same** key on retry of that submission, so a double-submit never creates two accounts (G5 / FR-020). A `409` on replay = the prior create already succeeded → resolve to that account, surface a deterministic, **non-disclosing** message (never reveal cross-tenant existence). The key maps 1:1 to the contract's `IdempotencyKey` parameter — not a Console invention.

## OQ-CON-LIST-FILTER (decided)

Server-side filtering is limited to the contract's **`category`** param + opaque keyset (`cursor`/`page_size`). Any free-text `displayName` search is a **client-side** affordance over the returned page only — Console invents **no** server filter the contract doesn't define.

## OQ-CON-STORE-SCOPE (decided)

Expose optional `storeId` exactly as the contract models it (`null` = tenant-wide). The active tenant/store is resolved by `ActiveContextProvider` and server-resolved on write — never passed as `tenant_id` in the body.

## Boundary assertion (SC-001)

017 consumes **only** these two ops and **zero** other settlement ops (no receivable/claim/reconciliation/POS-intent/connector surface). Verified in Phase 5 (T019).
