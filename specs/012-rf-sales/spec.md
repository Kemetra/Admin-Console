# Feature Specification: Console — Sales Search and Sale Detail

| Field | Value |
| --- | --- |
| Feature ID | 012 |
| Short name | rf-sales |
| Jira | RT-556 (epic RT-5) |
| Status | **Specified / Planning**. Contract path decided by the coordinator (OD-556-1..3, 2026-10-16) and ratified by the [GATED] Backend-Core contract review. The contract is **merged** (RT-561, Backend-Core PR #780, `521873c5`, 2026-10-16) as `1.0.0-draft`, contract only: both operations are `x-runtime-status: contract-only` and are not served until RT-562 ships (§6). Reconciled 2026-10-16 (RT-556). |
| Mode | Planning only. No implementation is authorized by this document. |
| Created | 2026-06-13 (vision stub) |
| Specified | 2026-10-16 |
| Owning repo | Kemetra/Admin-Console |
| Upstream producer | Kemetra/Backend-Core (console sales read, contract merged in RT-561; runtime RT-562, §6) |
| Baseline | Admin-Console `main@d6e666d`; Backend-Core `main@1d26d287` (§1 survey); contract reconciled against Backend-Core `521873c5` (`packages/contracts/openapi/console-sales.openapi.yaml`) |

> **Mode contract.** This spec defines the operator sales search and sale detail
> screens and records the admin-read contract decision. It authorizes no UI code,
> route, generated-client regeneration, contract pin change, OpenAPI YAML,
> migration or package change. The Backend-Core contract in §6 is merged;
> implementation still needs its own Jira issue, and the served runtime (RT-562,
> §6.5) before the console can read real data.

---

## 1. Background

Sales search belongs to Admin-Console, but Admin-Console `main` (`d6e666d`) has no
sales surface. The shipped console screens are Tenants, Stores, Operators, Audit,
Unknown items, Payer accounts, Receivables, Stock discrepancies and Shift closes
(RT-18). None of them lists or opens a sale.

The earlier vision stub ("Sales Monitor", `docs/design/_vision/vision-1/02-sales-monitor.png`)
described KPIs, trend charts, a transactions table and a detail panel. That mockup is
**superseded intent only** (RT-556). The design input is `DESIGN.md` and the RT-392
design system. KPIs and charts move to Reports (spec 015, deferred, §11).

### What Backend-Core serves today (verified on `main@1d26d287`)

| Surface | What it is | Can the console use it? |
| --- | --- | --- |
| `pos-sales/sale-history.yaml` 1.0.0-draft: `listSaleHistory`, `readSaleHistoryDetail`, `recordSaleReprint` (RT-537, BC#772; runtime RT-539, BC#774) | POS store-wide history, detail and reprint | **No.** `SaleHistoryAuthGuard` accepts only the POS operator envelope, or a device bearer plus `X-Cashier-Admission`. A dashboard session is refused (RT-539 lab note, 2026-10-16). The store comes from the credential; there is no `store_id` parameter. The three operations still carry `x-runtime-status: contract-only`. The runtime is served only in the rt9 lab and is not deployed elsewhere. |
| `pos-sales/sales.yaml` `readSale` | Minimal POS read used by void and return | **No.** Envelope only; no operator, device, ERP, void or returns detail. |
| `sale-sync-ops/sale-sync-ops.yaml`: `consoleGetSaleSyncStatus`, `consoleListNeedsRepair`, `consoleGetSaleAuditTimeline`, `consoleRepairSaleSync` | Console sync status, repair queue and one sale's audit timeline | **Partly.** `cookieAuth`, but roles `owner` and `tenant_admin` only. It reads one sale's sync state by `saleRef`. It cannot list or search sales, and it carries no lines, tenders or totals. |
| `settlement/settlement.yaml` `consoleListReceivables` | Receivables | Each `Receivable` carries `saleRef`. There is no `sale_ref` filter. |
| `shift-closes.openapi.yaml` (RT-383) | Admin read of recorded shift closes | Sales carry no shift id, so a sale links to closes only by store and day. |
| `audit.openapi.yaml` `listAuditEvents` | Audit search | Filters `action`, `actor_user_id`, `store_id`, `from`, `to`. There is no target or `saleRef` filter. |

So none of these operations let a console operator search sales by date range and
store, or open an itemized sale. That read is a new Backend-Core contract, since
merged as RT-561 (§6); its runtime is RT-562 and is not served yet.

## 2. Goals

- **G1.** An authorized operator finds a sale by business-date range and store, and
  narrows by sale number and status.
- **G2.** The operator opens one sale and sees its recorded lines, tenders (payments),
  totals, void and return facts, sync status and ERP posting state, exactly as
  Backend-Core serves them.
- **G3.** Every value is honest. Missing facts show "not recorded", unknown ERP state
  shows "unknown", and a list never claims to be the complete store history.
- **G4.** The screens link to existing screens (receivables, shift closes, audit) and
  never duplicate them.
- **G5.** The admin read contract is decided and recorded before any consumer work
  (contract-first).

## 3. Non-goals

- **No writes.** No void, return, refund, repair, reprint or edit of any sale fact.
  Sync repair stays on the sale-sync-ops repair surface (not yet specified; see
  spec 016 §10), not this slice.
- **No receipt reprint or receipt preview** from the console. Reprint is a POS action
  under RT-534 / OD-534-2.
- **No KPIs, trend charts, aggregates, exports or date-range reports.** These are
  Reports (spec 015), deferred behind this slice (§11).
- **No direct ERPNext, Frappe or ERPNext-Connector reads.** ERP posting state comes
  only from Backend-Core.
- **No reuse of POS credentials or of POS-scoped authorization** for admin reads.
- **No tenant-wide "All stores" sales list in v1.** Every list query names one store
  (OD-556-2). A tenant-wide list is deferred to a later slice; it would need its own
  approval and probably a [GATED] index migration (deferred issue 4, §6.5).
- **No cross-tenant view.** Platform support sessions are out of scope.
- **No duplication** of the receivables, shift-close or audit screens.
- **No change to spec 015** (another session owns it) or to any other spec.

## 4. Actors

| Actor | Sees | Notes |
| --- | --- | --- |
| `owner` | Sales of every store in their membership store authority | Tenant-wide for an `all` grant; never narrowed by the active store (operator-store-scope rule, RT-51 D6 / RT-131 / RT-193). |
| `tenant_admin` | Same as `owner` | Same rule. |
| `store_manager` | Sales of the stores in their resolved store scope | Active-store narrowing applies. |
| `store_staff` | Nothing | The route is hidden, and the server answers the non-disclosing 404. |
| Backend-Core | Authorizes, scopes, audits and projects every read | The console renders what it returns and never filters for security. |

Role-aware navigation (DESIGN.md §6): the "Sales" entry shows only for the three
permitted roles. Hiding the entry is not access control; the server decides.

## 5. Operator journeys

### J1 — Find a sale

1. The operator opens **Sales**. Nothing loads until a store and a business-date range
   are set. The default proposal is today in the store's timezone.
2. Filters:
   - **Store**: one store from the operator's scope (required in v1; see OD-556-2).
   - **Business-date range**: `from` and `to`, both inclusive, in the store's timezone,
     at most 31 business days (OD-534-4 applied to admin; see §6.3).
   - **Sale number**: exact match. Sales captured before the receipt snapshot have no
     sale number and never match; the screen says so next to the field.
   - **Status** (contract filters `sync_status`, `voided`, `return_state`,
     `erp_posting_state`, all four in v1, §6.3): sync status (`captured`, `synced`,
     `failed-retryable`, `failed-needs-repair`), voided yes/no, return state (`none`,
     `partial`, `full`), ERP posting state (`posted`, `pending`, `failed`, `unknown`).
3. The list shows, newest first: sale number (or "not recorded"), business date,
   occurred time in the store's timezone, terminal label, operator name, total with
   currency, and status chips (sync, voided, returns, ERP).
4. Paging uses the server cursor. The page shows "received by the server up to
   {asOf}". It never says "all sales". A page may hold fewer than `page_size` items,
   or none, while `nextCursor` is non-null (the server caps the rows one request
   examines, for example a selective status filter over a busy store). Only
   `nextCursor: null` ends the walk, so the list offers "load more" whenever the
   cursor is non-null, even on an empty page.
5. Filters live in the URL, like `ShiftCloseList` (`store`, `from`, `to`, plus the
   sale-number and status keys). A shared link reopens the same query in the viewer's
   own scope and never changes the viewer's scope (DESIGN.md §6).

### J2 — Open a sale

The detail route is `/sales/:saleRef`. It shows only what the detail projection
returns:

- **Header**: sale number, receipt number, business date, occurred, received and
  settled times, store, terminal (with label source), operator (with name source),
  currency and total.
- **Lines**: in receipt order when recorded. When the line order is `not_recorded`,
  the screen says the order is not the original. Each line shows name, quantity,
  unit, unit price, line amount, tax, and returned quantity.
- **Payments**: tenders (method, amount, reference). When the tender state is
  `unknown`, it says "payment details not recorded". Change given is shown when it
  was recorded.
- **Void**: void time, void business date, approved yes/no, approver role (no names).
- **Returns**: each return with its time, business date, total and lines.
- **Sync status**: from the sales detail projection.
- **ERP posting**: the sale's state, plus the reversal's state for a voided sale. The
  document id is shown only when the state is `posted`. The wording is operational,
  never a fiscal claim (OD-534-5).
- **Names**: `snapshot` names show as recorded; `current` names are labelled "current
  name"; `unavailable` shows "not recorded". Never an email address (OD-534-6).

The console does not show receipt-fact completeness or reprint eligibility. They are
POS concerns.

### J3 — Move to a related screen

See §7.

## 6. Admin read contract decision

### 6.1 Options

**(a) A new Backend-Core console read** (`cookieAuth`) over the same recorded sale
facts, following the RT-383 shift-closes precedent.

**(b) An additive extension of the RT-537 `pos-sale-history` contract**, adding the
console session as a third credential.

### 6.2 Recommendation: (a), a new console read (approved as OD-556-1, §6.4)

Three facts on Backend-Core `main@1d26d287` rule out (b):

1. **Credential model.** `SaleHistoryAuthGuard` is a reviewed composite that accepts
   the POS envelope or the device plus admission, and refuses a dashboard session.
   Adding `cookieAuth` would widen a guard that already passed security review
   (RT-539 M-1), and would mix human-session and device trust on one route.
2. **Scope model.** The POS contract takes the store from the credential and has no
   `store_id` parameter by design (RT-537 D-2). The console needs the
   operator-store-scope rule (owner and tenant_admin membership authority,
   store_manager resolved scope) and a `store_id` filter. Adding that breaks the
   RT-537 design.
3. **Rollout coupling.** The POS consumer RT-542 waits on removing the
   `contract-only` markers. The console should not depend on the POS release, or the
   POS on the console.

The precedent is RT-383: a separate `cookieAuth` admin read over POS-captured facts,
gated `SessionOnlyAdminGuard → TenantContextGuard → RolesGuard`, with a non-disclosing
404 and its own audit actions.

Backend-Core may reuse its sale-history query and projection code inside the server.
That is an implementation choice. It is not contract reuse, and the console contract
keeps its own auth, scope, audit and shape.

### 6.3 The merged contract (RT-561; Backend-Core PR #780, `521873c5`)

The contract is **merged** on Backend-Core `main` as
`packages/contracts/openapi/console-sales.openapi.yaml`, version `1.0.0-draft`,
`[GATED]` and contract only. Both operations carry `x-runtime-status: contract-only`
and are not served until RT-562 ships. The names below are final and match that file.
Where this section and the YAML differ, the YAML wins.

- **Operations**: `consoleListSales` (`GET /api/v1/sales`, audit
  `console_sales.listed`) and `consoleGetSale` (`GET /api/v1/sales/{saleRef}`, audit
  `console_sales.detail_read`). Read only. No reprint operation.
- **Schemas**: `ConsoleSalePage` (list), `ConsoleSaleItem` (a list row, and the
  `summary` of a detail) and `ConsoleSaleDetail`. The shared vocabulary (`SyncStatus`,
  `ReturnState`, `ErpPostingState`, `NameSource`, `DeviceView`, `OperatorView`,
  `SaleHistoryLine`, `SaleTenderView`, `ReceiptHeader`, `VoidSummary`, `ReturnSummary`,
  `ErpPostingView`) is identical to `pos-sales/sale-history.yaml`.
- **Auth**: `cookieAuth` only (httpOnly `dp2_session`). Guards
  `SessionOnlyAdminGuard → TenantContextGuard → RolesGuard`, so every bearer is 401. Roles
  `owner`, `tenant_admin`, `store_manager`. The tenant comes from the session, never from
  the request. The guards run before request validation, so an unauthenticated request is
  401 and a role outside the list is 404 for any input.
- **Store scope**: the operator-store-scope rule, as in `shift-closes.openapi.yaml`. An
  explicit `store_id` predicate on every query (sales RLS is tenant-only). A `store_id`
  outside the caller's scope, a sale of another tenant or store, an absent sale and the
  `store_staff` role all get the same non-disclosing 404. There is no 403 on this
  surface. The platform-admin session and how its store scope resolves are not decided
  here: the contract neither widens nor narrows the platform rule, and RT-562 implements
  and tests it, following the `shift-closes` runtime (§3, no cross-tenant view).
- **List query** (`consoleListSales`): `store_id` (required in v1, OD-556-2); `from` and
  `to` (required, inclusive business dates, `to >= from`, `to - from <= 30`; wider is 400,
  never truncated); `sale_number` (exact match on the captured receipt number, 1 to 96
  characters); the status filters `sync_status`, `voided` (only the literals `true` and
  `false`), `return_state` and `erp_posting_state`; `cursor` (opaque, 1 to 512 characters,
  bound to the operation, tenant, store and every filter; a foreign or forged cursor is
  400); `page_size` 1 to 100, default 50. An unknown or repeated query key is 400, as is a
  date that is not a calendar date. `erp_posting_state` filters the projected state:
  `pending` matches a `pending` or `failed_transient` posting, `failed` a
  `permanently_rejected` one, and `unknown` a sale with no sale posting row.
- **List response** (`ConsoleSalePage`): `{items, nextCursor, asOf, storeRef,
  storeTimezone, from, to}`. `storeRef` and `storeTimezone` are on the page, and `storeRef`
  is also on each item. Each `ConsoleSaleItem` carries: `saleRef`, `storeRef`,
  `saleNumber`, `businessDate`, `occurredAt`, `receivedAt`, `device`, `operator`,
  `currencyCode`, `posTotal`, `syncStatus`, `voided`, `returnState`, `erpPostingState`.
  Order `businessDate DESC, occurredAt DESC, saleRef DESC`, which matches the 0048 index
  `(tenant_id, store_id, business_date DESC, occurred_at DESC, id DESC)`.
- **Detail response** (`ConsoleSaleDetail`): `summary` (a `ConsoleSaleItem`, so `storeRef`
  sits there), then, at the top level, `storeTimezone`, `lines`, `lineOrder`,
  `tenderState`, `tenders`, `changeGiven`, `settledAt`, `receiptNumber`, `receiptHeader`,
  `void`, `returns` and `erpPosting`. `storeTimezone` is a **top-level** field of the
  detail, not of `summary`. The POS-only `receiptFacts` and `reprint` are absent. The
  detail takes only `saleRef` (no query key; any is 400) and resolves it anywhere in the
  caller's store scope, so a link from another screen opens without knowing the store.
  `storeTimezone` is the store's current zone, for showing times; business dates were
  fixed at capture and are never recomputed.
- **Paging and completeness**: keyset pagination with the opaque cursor. The list covers
  sales the server has received up to `asOf`; sales still queued on a terminal are
  unknown to it. **A page may be short, or empty, while `nextCursor` is non-null**,
  because the server may cap the rows one request examines (a selective status filter
  over a busy store). **Only `nextCursor: null` ends the walk**; every non-null cursor
  moves the position forward, so a walk always ends. The walk is not a snapshot: a sale
  received during a walk is returned only if it sorts after the current position, and a
  status is matched as it is when its page is read.
- **Status filters and storage**: all four status filters ship in v1 with **no
  migration**. The 0048 index covers the list query. The status filters are predicates on
  the rows of that range scan, evaluated with per-row lookups on existing per-sale
  indexes (`return_state`, `voided` and `erp_posting_state` are derived per sale, so no
  index can serve them without a denormalized column, which is out of v1). The cost is
  bounded to one store and 31 business days. **Migration 0048 must be authorized and
  deployed before RT-562 ships.**
- **Audit** (OD-534-7 applied to admin): `console_sales.listed`, one event per list
  request, with the filters (the sale number only as a flag) and the item count in its
  metadata and no row ids; `console_sales.detail_read`, one event per authorized open.
  The actor is the session user. The ids are carried in the event **metadata** through
  `annotateAudit`: `store_id` on both events and `sale_ref` on the detail event. The
  interceptor's `target_type` and `target_id` columns stay null, and its `store_id` column
  is the session's active store, which can differ from the store read. Events are emitted
  after a 200 only (a 400, 401 or 404 is not audited). No receipt content, no names, no
  secrets. A list page is never audited per row.
- **Errors**: the canonical `{ error: { code, message, request_id } }` envelope. 400
  `validation_error`, 401, 404 non-disclosing, 500. **There is no 429 in v1**: the surface
  has no console rate limit (tracked in RT-574).
- **Cache**: every 200 carries `Cache-Control: no-store` (the bodies carry staff display
  names and the receipt header).

### 6.4 Coordinator decisions (2026-10-16, under the owner's delegation)

- **OD-556-1 — contract path: approved, (a); ratified and merged.** A new Backend-Core
  `cookieAuth` console read following RT-383. RT-537 is not extended. The [GATED]
  Backend-Core contract review ratified it and the contract is merged (RT-561, BC#780,
  `521873c5`). The operation names, paths and audit action names in §6.3 are final.
- **OD-556-2 — `store_id` required in v1: approved, with no new migration.** The
  existing index starts `(tenant_id, store_id, …)`, so a one-store query needs no
  new index. A tenant-wide "All stores" list, or a tenant-wide sale-number lookup, is
  a v1 non-goal (§3), deferred to a later slice.
- **OD-556-3 — roles: approved.** `owner`, `tenant_admin`, `store_manager`, the same
  as the shift-closes navigation and OD-534-1 ("manager/admin: all authorized store
  sales"). The API stays the authority. The sale-sync-ops reads stay `owner` and
  `tenant_admin` only and are not widened here.

### 6.5 Backend-Core issues

1. **Backend-Core — console sales read contract [GATED].** **Done: RT-561** (BC#780,
   `521873c5`). `consoleListSales` and `consoleGetSale` as in §6.3. The console
   implementation was waiting on it.
2. **Backend-Core — console sales read runtime, authorization and audit: RT-562.** Not
   shipped, so the operations are not served. Guards, operator-store-scope, explicit
   `store_id` predicate, span cap, keyset cursor, row-examination cap, audit actions.
   Tests this spec expects: cross-store and cross-tenant non-disclosing 404, `store_staff` 404, every
   bearer 401, span over cap 400, foreign cursor 400, inclusive bounds, a 23:30 UTC sale
   on the next Cairo business date, voided, partial return, tender-unknown, pre-RT-77 sale
   with no device, unknown ERP state, a short or empty page with a non-null cursor, stable
   pages while sales arrive. RT-562 also owns the platform-admin session handling and how
   its store scope resolves (§6.3), and needs migration 0048 authorized and deployed
   before it ships.
3. **(Optional) Backend-Core — additive `sale_ref` filter on `consoleListReceivables`**,
   so a sale can link to its receivables (§7). Not yet created.
4. **Deferred.** Backend-Core — tenant-wide sales index [GATED migration]. Only if a
   tenant-wide "All stores" list is approved later; not needed for v1 (OD-556-2).
5. **Rate limiting: RT-574.** No 429 in v1 (§6.3).

## 7. Links to existing screens

The sales screens link out. They never re-render another screen's data.

| From | To | How | Status |
| --- | --- | --- | --- |
| Receivables list row | Sale detail | `Receivable.saleRef` → `/sales/:saleRef` | Available once 012 ships (receivables already carry `saleRef`). |
| Sale detail | Receivables for this sale | `/receivables?sale=<saleRef>` | **Blocked** on proposed issue 3 (no `sale_ref` filter today). Hidden until then. |
| Sale detail | Shift-close exceptions for the store and day | `/shift-closes?store=<storeId>&from=<businessDate>&to=<businessDate>` (keys `ShiftCloseList` already reads) | Available. Labelled "shift-close exceptions (non-zero variance) that day": RT-18's `buildListQuery` always sends `min_abs_variance >= 0.0001`, so balanced closes are not listed. Sales carry no shift id, so it is not "this sale's shift", and a shift that crosses midnight may close the next day. A link to *all* closes that day needs an all-closes URL key on `ShiftCloseList` (console dependency, not this slice). |
| Sale detail | Audit search | `/audit` filtered by store, date and the console sales audit actions (`console_sales.listed`, `console_sales.detail_read`) plus `sale_history.` / `sale.` | **Blocked.** `AuditSearch` keeps no filter state in the URL and the audit API has no `saleRef` filter. Needs URL filter state in spec 006 (dependency, not this slice). |
| Sale detail | Sync repair | — | Not linked. Repair is the sale-sync-ops repair surface (not yet specified; see spec 016 §10), `owner`/`tenant_admin` only. |

## 8. States

Every state is distinct and honest:

- **No query yet**: store or dates missing. Prompt, not an empty table.
- **Loading**: a skeleton table (RT-549 pattern).
- **Empty**: only when the response has `items: []` **and** `nextCursor: null`: "No
  sales received by the server for this store and range up to {asOf}." An empty or short
  page with a non-null `nextCursor` is not "no sales": the server capped the rows it
  examined. Show the rows so far (none, if empty) and a "load more" action, and say
  nothing about the end of the list. Only `nextCursor: null` ends the walk.
- **Range too wide**: a client check before the request, and the server's 400 if it
  still happens. Never truncated.
- **Not found / not permitted**: one message for the non-disclosing 404.
- **Session expired**: the shared 401 handling.
- **Missing facts on a sale**: each missing block says "not recorded for this sale".
- **ERP unknown**: "ERP posting state unknown". Never "not posted".
- **Partial completeness**: the "received by the server up to {asOf}" note on every
  list page.

## 9. Functional requirements

- **FR-001.** The console reads sales only through the Backend-Core console sales read
  (§6), via the generated client from the pinned contract. No other sales source.
- **FR-002.** No POS credential, POS route (`/api/pos/v1/**`) or POS-scoped
  authorization is used by the console.
- **FR-003.** No ERPNext, Frappe or ERPNext-Connector call. ERP state is rendered as
  Backend-Core returns it.
- **FR-004.** The list requires a store and a business-date range before it sends a
  request. The range is inclusive and at most 31 business days.
- **FR-005.** Business dates and times show in the sale's store timezone, labelled with
  that timezone.
- **FR-006.** Paging uses the opaque server cursor only. The console never builds,
  parses or reuses a cursor across filter changes. Only `nextCursor: null` ends the
  walk; a non-null cursor always offers "load more", even on a short or empty page.
- **FR-007.** Filters live in the URL and never change the operator's scope.
- **FR-008.** The detail shows only fields in the detail projection. Missing facts are
  labelled, never guessed or computed client-side.
- **FR-009.** Names follow their source label (`snapshot`, `current`, `unavailable`).
  No email is ever shown as a name.
- **FR-010.** No write action of any kind is offered on these screens.
- **FR-011.** Money uses the exact-decimal strings and currency code from the server;
  no float arithmetic and no client-side totals.
- **FR-012.** Navigation shows "Sales" only to `owner`, `tenant_admin` and
  `store_manager`. A 404 from the server is final, whatever the navigation shows.
- **FR-013.** Arabic-first RTL and the DESIGN.md token and component rules apply.

## 10. Acceptance criteria

This planning slice is accepted when:

- **AC-P1.** This spec has goals, non-goals, actors and acceptance criteria. (§2–§4,
  §10)
- **AC-P2.** The admin read contract decision is recorded with reasons, and the
  Backend-Core issues it needs are proposed. (§6)
- **AC-P3.** Reports (spec 015) are marked deferred behind this slice inside this spec.
  (§11)

The later implementation is accepted when:

- **AC-1.** An `owner`, `tenant_admin` or `store_manager` can list a store's sales for
  an inclusive business-date range of up to 31 days, newest first, with cursor paging.
  A page with a non-null `nextCursor` offers "load more" even when it is short or
  empty, and the list is shown as ended only when `nextCursor` is `null`.
- **AC-2.** A range wider than 31 business days is refused before the request, and a
  server 400 is shown as a validation message, never as an empty list.
- **AC-3.** Sale-number search finds an exact match, and the screen explains that
  pre-snapshot sales have no number.
- **AC-4.** Each of the four status filters (`sync_status`, `voided`, `return_state`,
  `erp_posting_state`) returns only matching sales, and combined filters use AND. An
  empty page with a non-null `nextCursor` under a status filter shows "load more", not
  "no sales".
- **AC-5.** A `store_staff` user sees no Sales entry, and a direct URL shows the
  not-found state.
- **AC-6.** A sale of another store outside the operator's scope, or of another tenant,
  shows the same not-found state as a missing sale.
- **AC-7.** The detail shows lines in receipt order when recorded, and labels
  `not_recorded` order.
- **AC-8.** A tender-unknown sale says payment details were not recorded, and shows
  no invented tender.
- **AC-9.** A voided sale shows its void summary and the reversal's ERP state.
- **AC-10.** A partially returned sale shows each return and the returned quantity per
  line.
- **AC-11.** ERP state `unknown` reads as unknown, and a document id appears only for
  `posted`.
- **AC-12.** No email address appears as an operator name, and `current` names are
  labelled.
- **AC-13.** Every list page shows "received by the server up to {asOf}". The "No sales
  received…" empty state appears only for `items: []` with `nextCursor: null`; an empty
  page with a non-null `nextCursor` shows "load more" instead and never claims there are
  no sales.
- **AC-14.** A receivable row opens its sale detail. The link labelled "shift-close
  exceptions (non-zero variance) that day" opens that store and day on the shift-close
  exception list.
- **AC-15.** Network traces show only Backend-Core console routes; no `/api/pos/v1/**`,
  ERPNext or Connector requests.
- **AC-16.** Opening a sale writes one detail-read audit event, and a list request
  writes one list audit event (`console_sales.detail_read` and `console_sales.listed`;
  the ids are in the event metadata, §6.3) (verified against Backend-Core, not asserted
  by the console).

## 11. Reports (spec 015) — deferred

Reports and analytics (spec `015-rf-reports-analytics`: KPIs, trends, distributions,
date-range reports, exports) are **deferred behind this slice**. They need aggregate
reads that do not exist on Backend-Core, and they should be planned only after the
console sales read in §6 exists, so that aggregates and row-level sales share one
scope, date and audit model.

Spec 015 itself is not edited here. Its owner records the dependency on RT-556 there.

## 12. Dependencies and related work

- **Backend-Core**: issue 1 is done (RT-561, contract merged). Issue 2 (RT-562, the
  served runtime) blocks the console reading real data, and needs migration 0048
  authorized and deployed first (§6.3). Issue 3 is needed only for the sale →
  receivables link. Rate limiting is RT-574 (no 429 in v1).
- **Console contract pin**: the generated client and contract pin do not yet include
  the console sales contract. Pinning it is a console implementation task, not this
  slice.
- **RT-534 / RT-537 / RT-538 / RT-539**: POS sale history. Related context only; this
  slice depends on the stored facts (receipt snapshot, `line_seq`, 0048 index), not on
  the POS contract.
- **RT-383 / RT-18**: shift-closes admin read, the auth and scope precedent.
- **Spec 006 (audit search)**: URL filter state, needed for the audit link.
- **Sale-sync-ops repair surface** (not yet specified; see spec 016 §10, which
  excludes `consoleRepairSaleSync`): owns sync repair; not duplicated here.
- **Shift closes (RT-18)**: an all-closes URL key on `ShiftCloseList`, needed only for
  a link to every close of a day (console dependency, not this slice).
- **Spec 015**: deferred behind this slice (§11).
- **RT-544**: store timezone must be correct before the first sale; business dates
  are frozen at capture.

## 13. Risks

- **Legacy sales are thin.** Sales before the receipt snapshot have no sale number,
  no line order and no name snapshot. The screens must label this, not hide it.
- **Business dates are stored per store** in each store's timezone at capture, and
  were UTC in the lab before the timezone was set (RT-539 lab note: 21 of 78 sales
  fall on a different Cairo day). A one-store query keeps one calendar per page.
- **`approverRole` is the approver's current role**, not the role at void time
  (BC#774 note). The detail label must say "approver role".
- **Freshness.** Offline terminals sync late, so a page can change after it loads.
  The `asOf` note covers this.
