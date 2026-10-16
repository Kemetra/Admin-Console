# Feature Specification: Console Overview (tenant/store operator landing)

| Field | Value |
| --- | --- |
| Feature ID | 009 |
| Short name | rf-overview-dashboard |
| Jira | **RT-555** (parent epic RT-5 — W5 Console Operations) |
| Status | **Specified (Planning)**. Was a VISION-STUB (2026-06-13). Not built. |
| Work Mode | Planning: this spec only. No production code, generated code, package or lockfile change. |
| Date | 2026-10-16 |
| Owning repo | `Kemetra/Admin-Console` |
| Admin-Console baseline | `main` @ `d6e666d` (RT-477) |
| Backend-Core baseline | `main` @ `1d26d287` (RT-539). Console client pin `2b03ad2d` (`openapi-ts.config.ts`). No file under `packages/contracts/openapi/` changed between the two SHAs. |
| Route | `/` (index route; today `src/shell/Overview.tsx` renders only the title and the active scope) |

> **Mode contract.** This spec decides what the tenant/store operator's landing page shows and
> which Backend-Core reads serve it. It authorizes no implementation. Every panel below maps to
> an operation that exists on Backend-Core `main`, or to a named Backend-Core dependency
> (proposed). No field or endpoint is assumed. The implementation issue(s) come later.

---

## 1. Why

After sign-in, an operator lands on `/` and sees only a title and the tenant/store name. The
console already ships the screens where work happens (unknown items, stock discrepancies, shift
closes, receivables, audit), but nothing tells the operator **which of them need attention in
the current scope**. The Overview answers *where am I acting, and what needs me* and sends the
operator to the screen that owns the work.

The approved design system sets the shape: "An overview leads with attention items and next
destinations, not a KPI wall" (`design/claude-design-system/README.md`, rule 8).

## 2. Actors

The Overview is for **tenant and store operators** acting inside one tenant. Roles are the
Backend-Core membership roles enforced by each operation's guard (verified on Backend-Core
`main` @ `1d26d287`, controllers listed in §6).

| Actor | Role | What the Overview gives them |
| --- | --- | --- |
| Tenant owner | `owner` | All v1 panels, tenant-wide or narrowed to the active store. |
| Tenant admin | `tenant_admin` | Same as owner. |
| Store manager | `store_manager` | Unknown items, stock discrepancies and shift closes for their store scope. No receivables, no audit. |
| Store staff | `store_staff` | Whatever the backend answers. Today that is the scope line and the unknown-items panel: the list has no `RolesGuard`, a gap the controller's own comment calls temporary ("real auth+roles stack lands in a future Wave 1 slice"), so it is expected to tighten and is not a grant. Shift closes, stock discrepancies, receivables and audit refuse this role. |
| Platform admin | platform | **Out of scope.** See §4 (RT-391). With a tenant selected, the platform admin sees what the backend lets that session read, like any other caller. |

## 3. Goals and non-goals

### Goals

- **G-1.** Show the active scope (tenant, and store when one is selected) as the page's first
  fact. This is shipped today and stays.
- **G-2.** Lead with **attention items**: one row per domain that has work waiting in the
  current scope, each linking to the screen that owns it.
- **G-3. Deferred (OD-009-3).** ~~Show **recent activity** (latest audit events in scope) for roles
  that can read audit.~~ Every Overview load writes read audits of its own (`shift_closes.listed`,
  `settlement.receivable.listed`, …), so "latest 10" would mostly show the operator's own visit, and
  filtering in the browser would misstate the page. Waits for Backend-Core **RT-567**. In v1,
  owner and tenant_admin get a plain link to `/audit` instead.
- **G-4.** Every value is backend truth: Unknown stays Unknown, an error never reads as zero,
  and no client-side "health" is derived from missing data.
- **G-5.** Store-scoped users see only granted stores; tenant-wide users see the active store
  when one is selected, otherwise the tenant.

### Non-goals (v1)

- **NG-1. Sales KPIs.** No Backend-Core contract serves console sales figures (§5.4). The sales
  panel waits for BC-009-1; its figures are decided (OD-009-1, §10). No
  placeholder "coming soon" tile is rendered.
- **NG-2. Charts.** Bar, line and sparkline charts are not allowed until UX-13 ratifies a data
  palette (design-system rule 8). Counts appear as text in a ledger.
- **NG-3. Integration / ERP sync health tile.** `consoleGetSyncOpsSummary` exists, but there is
  no console destination for it yet. It belongs with RT-557 (spec 016); see §5.5.
- **NG-4. Platform health, telemetry and cross-tenant views.** These belong to RT-391 (§4).
- **NG-5. Actions on the Overview.** The Overview links; it does not dismiss, repair, approve
  or apply anything. Actions stay on the owning screens.
- **NG-6. Sales-by-store, GMV, average order value, "Welcome back" greeting, integration
  health.** These came from the vision mockup `docs/design/_vision/vision-1/01-overview.png`,
  which is superseded intent only (dark, LTR, KPI wall).
- **NG-7. Auto-refresh or polling.** v1 reads on load and on scope change, with a manual
  refresh.

## 4. Boundary with RT-391 (Platform Control Center)

RT-391 plans a **platform-operator-only** control surface: platform health by service and
tenant/store, support lookup, a triage board, diagnosis timelines and telemetry evidence. None
of that is in 009.

| Concern | 009 Overview | RT-391 Platform Control Center |
| --- | --- | --- |
| Audience | Tenant/store operators inside one tenant | Platform operator across tenants |
| Scope source | The session's active tenant/store (`getActiveContext`) | Explicit selected tenant with platform-admin session model |
| Content | Retail work waiting in this tenant/store, recent tenant audit | Service health, telemetry, correlation IDs, support refs, triage |
| Health | None. The Overview shows no service or integration health and derives none. | Platform Health with freshness and Unknown distinguished from Healthy |

Rule: when no tenant is active (for example, a platform admin who has not chosen a tenant),
the Overview renders no panels and keeps the existing scope prompt. Anything cross-tenant,
service-level or telemetry-based belongs to RT-391.

## 5. Panels and their contracts

All operations below are human `cookieAuth` (`dp2_session`) reads under
`DashboardAuthGuard` + `TenantContextGuard`. The tenant always comes from the session. All are
in the console's generated client at pin `2b03ad2d` except `consoleGetSyncOpsSummary`
(not in `OPENAPI_SOURCE_SPECS`; deferred anyway).

### 5.1 Panel → contract map

| # | Panel | Owning domain | Backend-Core operation (on `main`) | Contract file | Roles (controller) | Destination on console `main` | v1 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| P-0 | Scope line | Context | `getActiveContext` `GET /api/v1/context/me` | `context.openapi.yaml` | any session | — | **Yes** (shipped) |
| P-1 | Stock discrepancies | Inventory / ERPNext reconciliation (RT-177) | `listErpnextNegativeOnHandStores` `GET /api/v1/catalog/erpnext-reconciliation/negative-on-hand/stores` | `erpnext-reconciliation/reconciliation.yaml` | owner, tenant_admin, store_manager | `/stock-discrepancies`, `/stock-discrepancies/:storeId` | **Yes** |
| P-2 | Shift-close variances | Cash / shifts (RT-383) | `consoleListShiftCloses` `GET /api/v1/shift-closes` | `shift-closes.openapi.yaml` | owner, tenant_admin, store_manager | `/shift-closes` | **Yes** (per OD-009-2) |
| P-3 | Unknown items | Catalog (RF-4a) | `tenantAdminListUnknownItems` `GET /api/v1/catalog/unknown-items` | `catalog/unknown-items.yaml` | any tenant member; RLS scopes to stores | `/unknown-items` | **Yes** |
| P-4 | Flagged receivables | Settlement (035 / 018) | `consoleListReceivables` `GET /api/v1/settlement/receivables` | `settlement/settlement.yaml` | owner, tenant_admin | `/receivables` | **Yes** |
| P-5 | Recent activity | Audit (RF-6) | `listAuditEvents` `GET /api/v1/audit/events` | `audit.openapi.yaml` | owner, tenant_admin (403 otherwise) | `/audit` | **Deferred** (OD-009-3, RT-567). v1: a plain `/audit` link for owner/tenant_admin, no list, no counts |
| P-6 | Sales KPIs | Sales | **None.** Backend-Core dependency (proposed) **BC-009-1** | — | — | Sales screen (RT-556, spec 012) | **No** |
| P-7 | ERP sync status | ERPNext sync ops (spec 025) | `consoleGetSyncOpsSummary` `GET /api/v1/catalog/erpnext-sync-ops/summary` | `erpnext-sync-ops/console-sync-ops.yaml` | owner, tenant_admin | None yet (RT-557, spec 016) | **Deferred** |

`/unknown-items` and `/receivables` are routed on `main` but not in the production sidebar
(`GATED_NAV` / no nav entry). The Overview rows link to the routes; whether those routes join
the navigation is RT-270's and the owning slices' concern, not 009's.

### 5.2 How each v1 panel reads (no invented parameters)

- **P-1 Stock discrepancies.** One call, no store parameter (the contract has none). Each
  summary carries `storeId`, `storeName`, `snapshot` and `negativeItemCount`. With an active
  store, show only that store's row; otherwise one row per store returned. When
  `snapshot.status` is `no_warehouse_mapping` or `no_snapshot`, the count is `0` on the wire
  and **must render as Unknown** (contract text; RT-178 AC2 copy «غير معروف»). A `stale`
  snapshot shows its count with the snapshot's as-of time (`readAt`) and the stale state, as the
  RT-178 screen does; a snapshot is a point-in-time ERPNext read, never live stock. This is the
  only panel with a backend count. Paginated by cursor; follow `nextCursor` only to list the
  stores (the summary count is per store, so no counting across pages is involved).
- **P-2 Shift-close variances.** `approval=not_approved` plus `min_abs_variance` and a
  `closed_from` window, plus `store_id` when a store is active. The contract records no review
  or acknowledgement state, and the policy threshold (AD-CASH-001 D-7) does not exist yet, so
  the attention definition is set by OD-009-2 (§10): `min_abs_variance=0.0001` and
  `closed_from` at the start of the day six days before today (today plus the six days
  before it). Days are the active store's business dates, or UTC dates when no store is active
  (owner or tenant_admin, tenant-wide), the same rule `/shift-closes` uses. The Overview builds
  `closed_from` with the destination's own helper (`zonedDayStartIso` in
  `src/shift-closes/shiftCloseDates.ts`, as `shiftCloseFilters.ts` does), so the row count and
  the linked list always cover the same subset. The amount is compared in each
  close's own currency; the panel never converts or sums money across currencies.
- **P-3 Unknown items.** `status=pending`, plus `store_id` when a store is active. Store-scoped
  operators are narrowed by RLS regardless.
- **P-4 Flagged receivables.** `state=flagged` (the contract's variance / net-zero-or-below
  state), plus `store_id` when a store is active. The contract has no due date, so there is no
  "overdue" item.
- **P-5 Recent activity (deferred, OD-009-3; kept for when RT-567 lands).** `limit=10`, plus `store_id` when a store is active. Shows
  `occurred_at` (exact, timezone-explicit, as the audit screen does), `actor_label` and the
  action rendered through the catalog (machine code drives copy, never shown raw). Newest-first
  order is a **runtime fact only** (`audit.repository.ts` orders by `occurred_at DESC, id DESC`);
  `audit.openapi.yaml` does not state it. See BC-009-3.

### 5.3 Destination links must show the same subset

A row that says "3 unapproved variances" must not land on an unfiltered list. Checked on
console `main` @ `d6e666d`:

| Row | Destination today | Link |
| --- | --- | --- |
| P-1 | `/stock-discrepancies/:storeId` (per store) | Matches: one row per store. |
| P-2 | `/shift-closes` reads its filters from the URL (`shiftCloseFilters.ts`: `store`, `from`, `to`, `min`, `currency`, `approval`) | The link carries `approval=not_approved`, `min`, `from` and `store`. `from` is a calendar date that `shiftCloseFilters.ts` reads in the selected store's timezone, else in UTC. The Overview computes the OD-009-2 window by the same rule and helper (`zonedDayStartIso`): store business dates with an active store, UTC dates otherwise. |
| P-3 | `/unknown-items` defaults to `pending` and passes the active store as `store_id` (`UnknownItemList.tsx`) | Matches with a plain link. |
| P-4 | `/receivables` has no URL filter state and sends no `state` or `store_id` | **Gap.** Until the receivables screen (spec 018 slice) accepts `state` (and `store_id`) from the URL, the row links to the unfiltered list and its copy names the subset (flagged receivables, catalog wording decided at implementation), so the operator knows what to look for. Listed in §11. |
| P-5 | `/audit` | Plain link to the search; no filter carried (AuditSearch has no URL filter state, as RT-556 also found). |

### 5.4 Why sales KPIs have no contract today

`pos-sales/sale-history.yaml` (`listSaleHistory`, RT-537 / RT-539) is the only sales list on
`main`. It does not serve the console:

- it is a POS path (`/api/pos/v1/sale-history`) and the store comes from the device or
  operator-envelope credential, with no store parameter; its `SaleHistoryAuthGuard` refuses
  dashboard sessions, and the operations are still `x-runtime-status: contract-only` on `main`;
- the range is capped at 31 business days and the contract says a client "must never present
  a page as the complete store history" (sales still queued on terminals are not known);
- summing pages in the browser would be a derived, incomplete total, which the truth rules
  forbid.

So the KPI panel is a Backend-Core dependency (BC-009-1). The figures it shows are decided
(OD-009-1, §10).

### 5.5 Why the sync-ops tile is deferred

`consoleGetSyncOpsSummary` is runtime-present, tenant-scoped and returns a backend-derived
`status` (`ok` / `attention` / `not_available`) per domain, so it would not break the "no
derived health" rule. It is deferred because (a) no console screen consumes it, so the row
would have no destination; (b) RT-557 narrows spec 016 to "ERP Connection & Sync Status",
which owns that destination; (c) it is not in the console client's composed sources yet. When
016 ships, 009 can add a row that deep-links to it. A `not_available` domain then renders
«لا توجد إشارة», never healthy (on `main`, `connector_health` in the summary is always
`not_available`).

## 6. Scope, roles and counting rules

### 6.1 Active store

For `owner` and `tenant_admin`, shift closes and negative on-hand are **never narrowed by the
active store** on the server (contract text: membership store authority, not the active
store). The Overview must not contradict its own scope line, so:

- with an active store, every panel passes `store_id` (P-2, P-3, P-4, P-5) or keeps only that
  store's row (P-1);
- with no active store, panels show the caller's whole scope (tenant-wide or granted stores).

### 6.2 Roles

The backend decides. A panel that answers 403 or 404 is **omitted** for that session, and is
never shown as empty or zero. The implementation may reuse the existing nav role helpers
(`canReadStockDiscrepancies`, `canReadShiftCloses` in `AppShell.tsx`) to skip calls the API
is known to refuse, the same way the nav "mirrors the API" today. The backend's answer still
wins when it disagrees.

### 6.3 Counts

Only P-1 has a backend count. The lists behind P-2, P-3 and P-4 return a page and a cursor,
with no total. The Overview reads **one page** (each contract's default size, 50; the server
MAY return fewer) and shows:

- an exact count when the page returns `nextCursor: null` (or `next_cursor: null`);
- "at least N", where N is the number of items **actually returned**, when the cursor is not
  null (whole-phrase plural, e.g. «12 أو أكثر»);
- a quiet "none" only when the page is empty **and** the cursor is null. An empty page with a
  cursor is not proven empty: the row says the list has more to check and links to it, never "none".
  Zero is neutral text, never green.

It never walks every page to compute a total. If exact counts matter, that is BC-009-2.

### 6.4 States per panel

Each panel owns its loading, error, no-access and Unknown states. One failing panel does not
blank the page or its neighbours. An error shows an inline notice with a retry (state ladder:
indicator → inline notice), never a zero and never a toast.

## 7. Design input

- **Authority:** `DESIGN.md` v2.0 and the RT-392 bundle `design/claude-design-system/`.
  Light-first, Arabic-first (`dir="rtl"`, logical CSS), Dubai type, role tokens only.
- **Layout:** sections with headings, not a card grid. The attention items form one ledger
  ("Precision Ledger": label, count or state, link), ordered as P-1…P-4. Recent activity
  follows as a short semantic table or list. No card per value, no table inside a card.
- **Status words:** «غير معروف» for an unknown stock snapshot (shipped RT-178 copy);
  «لا توجد إشارة» (hollow neutral) for a missing signal. Healthy stays quiet. Never colour alone.
- **Numbers:** tabular, Western digits, LTR-isolated; noun-first counters («الأصناف: 11»).
- **Time:** store timezone for business dates (RT-477 shipped `Store.timezone`); audit keeps
  exact timestamps.
- **Copy:** whole sentences in `src/i18n/messages/{ar,en}/`, Arabic is the key set.
- **Superseded:** the vision PNG (dark, LTR, KPI wall, charts, greeting) is intent only.

## 8. Acceptance criteria

- **AC-1 Scope first.** The page's first content is the active tenant (and store, when
  selected), as today.
- **AC-2 No tenant, no panels.** With no active tenant, no panel renders and no panel call is
  made.
- **AC-3 Attention ledger.** For each of P-1…P-4 the session may read, one row shows the label,
  the count or state per §6.3, and a link to the destination in §5.1.
- **AC-4 Unknown stays Unknown.** A P-1 store whose snapshot is `no_warehouse_mapping` or
  `no_snapshot` renders Unknown, never 0 and never "no issues".
- **AC-5 Errors are not zeros.** A failed panel call shows an inline error with retry for that
  panel only; other panels render normally.
- **AC-6 Role by backend.** A panel answering 403/404 is omitted; it is never rendered as empty
  or zero. A store manager sees no P-4 or P-5; store staff see no P-1, P-2, P-4 or P-5.
- **AC-7 Active store narrows.** With an active store, P-2…P-5 send that `store_id` and P-1
  shows only that store, for every role, including owner and tenant_admin.
- **AC-8 Store isolation.** A store-scoped user never sees a row, count or name from a store
  outside their grant (tested with a two-store tenant and a single-store grant).
- **AC-9 Counts are honest.** No panel sums or walks pages. A list with a further page shows
  "at least N".
- **AC-10 Audit link (P-5 deferred, OD-009-3).** Owner/tenant_admin see a link to `/audit`; no
  activity list in v1, and the Overview makes no `listAuditEvents` call.
- **AC-11 No sales panel.** No sales or KPI element renders until BC-009-1 exists. When it
  does, P-6 shows only the OD-009-1 figures (today's received-sale count and gross total per
  currency, per store in scope, as text), in a later issue.
- **AC-12 Scope change.** Changing tenant or store re-reads every panel; no row from the old
  scope remains visible.
- **AC-13 Design rules.** Light and dark themes, Arabic and English, forced-colors, keyboard
  walk and axe pass on the Overview; no charts; no hardcoded hex.
- **AC-14 Boundary.** No call to ERPNext, the Connector or any non-Backend-Core origin; only
  generated-client operations in §5.1.

## 9. Backend-Core dependencies (proposed, not created)

The coordinator creates these issues if approved. Each is contract-first in Backend-Core.

| ID | One-line description | Unblocks |
| --- | --- | --- |
| **BC-009-1** | A console-facing (`cookieAuth`), store-scoped sales summary read for a business-date range in the store timezone, with an explicit as-of time and completeness statement (sales still queued on terminals are excluded), money as exact decimals per currency. | P-6. Coordinate with RT-556 (spec 012), which proposes a console sales list/detail read (`consoleListSales`, `consoleGetSale`). The summary is a separate aggregate: the Overview must not sum list pages. |
| **BC-009-2** *(optional)* | A scoped attention-count read returning exact counts of pending unknown items, unapproved shift-close variances and flagged receivables for the caller's scope. | Exact counts in P-2…P-4 instead of "at least N". |
| **BC-009-3** *(docs)* | State the `listAuditEvents` order (newest first by `occurred_at`, then `id`) in `audit.openapi.yaml`; the runtime already does this. | P-5 relying on contract, not runtime. |

## 10. Decisions

### Open owner decisions

None.

### Decided by the coordinator (2026-10-16, under the owner's delegation)

| ID | Question | Decision | Why |
| --- | --- | --- | --- |
| **OD-009-2** | What counts as a shift-close attention item, given no policy threshold and no review state? | **Approved as recommended.** An unapproved close (`approval=not_approved`) with any non-zero variance (`min_abs_variance=0.0001`), closed in the last 7 days (store business days with an active store; UTC dates otherwise). Revisit when the AD-CASH-001 D-7 policy ships (RT-384 / RT-387 / RT-389). | The contract has no policy threshold and no review or acknowledgement state. `0.0001` is the smallest amount `NonNegativeDecimalAmount` allows, so "any non-zero variance" needs no invented threshold and works in every currency. The 7-day window keeps old unapproved closes from staying on the Overview forever, since nothing on the contract clears them. |
| **OD-009-3** | Ship P-5 recent activity in v1? | **Deferred.** v1 ships P-0…P-4. Owner and tenant_admin get a plain link to `/audit` (the existing «سجل التدقيق» / Audit label), with no list and no counts. The action-copy catalog is deferred with P-5; when P-5 returns it belongs in a shared audit namespace so `/audit` can adopt it. Depends on Backend-Core **RT-567** (`listAuditEvents`: exclude read-only actions or filter by category, contract-first). | Backend-Core audits reads, so every Overview load writes several read audits and "latest 10" would mostly echo the operator's own visit: noise, against this spec's attention-first rule. Dropping rows in the browser would misstate a 10-row page. Decided 2026-10-16 (RT-559). |
| **OD-009-1** | Which sales figures matter commercially on the landing page? | **Approved as the starting point.** Today's (store business date) received-sale count and gross total per currency, per store in scope, as text. P-6 stays a non-goal until BC-009-1 exists. Average order value and trends come later, with no charts until UX-13. | The count and the gross total are what a summary read can state truthfully with an as-of time and a completeness statement. Totals stay per currency because the console never converts money. Charts wait for a ratified UX-13 data palette (design-system rule 8). |

### Decided in this spec

- Audience is the tenant/store operator; platform health is RT-391.
- v1 panels: P-0…P-4 (P-5 deferred by OD-009-3). P-6 waits for BC-009-1; P-7 is deferred to RT-557.
- Attention items lead; no KPI wall, no charts.
- No client-derived health, no page-walking totals.

## 11. Implementation notes (for the later issue)

- No re-pin is needed for P-0…P-5: their sources are already composed in
  `openapi-ts.config.ts` at `2b03ad2d`, and none changed by Backend-Core `main` @ `1d26d287`.
- P-7 would need `erpnext-sync-ops/console-sync-ops.yaml` added to `OPENAPI_SOURCE_SPECS`
  (regeneration at the pin), owned by whichever slice adds the tile.
- Reuse the owning screens' existing query hooks and copy where they fit; do not duplicate
  status vocabularies.
- Console dependency on the receivables slice (spec 018): URL filter state for `state` and
  `store_id` on `/receivables`, so the P-4 link can open the flagged subset (§5.3). Not a
  Backend-Core change.
- Evidence expected: component tests per panel state (loading / data / empty / at-least-N /
  Unknown / error / no-access), a two-store isolation test, an e2e for scope change, and
  visual captures in light, dark, Arabic, English and forced-colors.

## 12. Evidence (read-only, 2026-10-16)

- Admin-Console `main` @ `d6e666d`: `src/shell/Overview.tsx`, `src/App.tsx`,
  `src/shell/AppShell.tsx`, `openapi-ts.config.ts`, `DESIGN.md`,
  `design/claude-design-system/README.md`.
- Backend-Core `main` @ `1d26d287`: the contract files named in §5.1, plus
  `pos-sales/sale-history.yaml`; controllers `audit/audit.controller.ts`,
  `catalog/unknown-items/unknown-items.controller.ts`,
  `catalog/erpnext-reconciliation/negative-on-hand.controller.ts`,
  `shift-closes/shift-closes.controller.ts`, `settlement/settlement.controller.ts`,
  `catalog/erpnext-sync-ops/erpnext-sync-ops.controller.ts`; `audit/audit.repository.ts`
  (ordering).
- `gh api repos/Kemetra/Backend-Core/compare/2b03ad2d...1d26d287`: no file under
  `packages/contracts/openapi/` changed.
