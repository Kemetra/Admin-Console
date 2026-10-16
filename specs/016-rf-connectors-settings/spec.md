# Spec 016 — ERP Connection & Sync Status (formerly "RF Connectors / Settings")

| Field | Value |
| --- | --- |
| Feature ID | 016 (folder name `016-rf-connectors-settings` kept for link stability) |
| Status | **Proposed — decision recorded, not yet planned** (RT-557, Planning) |
| Decision | **BUILD, narrowed.** Build a tenant-scoped ERP connection & sync status surface. **Drop** the generic "settings" half. Do **not** merge into RT-391. |
| Date | 2026-10-16 |
| Owning repo | Kemetra/Admin-Console |
| Jira | [RT-557](https://rahmaqanater.atlassian.net/browse/RT-557) (parent RT-5, W5 Console Operations) |
| Supersedes | The 2026-06-13 vision stub (Data Pulse / file feeds / generic settings intent) |

## 0. Baselines (verified 2026-10-16, read-only)

| Repo | `origin/main` | Notes |
| --- | --- | --- |
| Admin-Console | `d6e666d` | Console client pin `DATA_PULSE_2_PIN = 2b03ad2d` (`openapi-ts.config.ts`). |
| Backend-Core | `1d26d287` | The four contracts below are **byte-identical** at `2b03ad2d` and `1d26d287` (same git blob SHAs). |
| ERPNext-Connector | `e217edd2` | All 57 non-test `.py` files and `hooks.py` `scheduler_events` searched: **no heartbeat sender**. Scheduled jobs are only the posting poller and the bin-view poller. |

"Data Pulse" / "Data-Pulse-2" is the old name of Backend-Core. "File feeds" do not exist in the
architecture. Both references from the stub are dropped.

## 1. Decision and why

### 1.1 Build: a tenant-scoped ERP connection & sync surface

Tenant owners and tenant admins need to answer three questions without opening ERPNext or asking
support:

1. **Is our ERP connector connected?** Which instances are registered, and when did each last report?
2. **Is our ERP posting keeping up?** Are any sales or reversals dead-lettered, and why?
3. **Has reconciliation run, and did it find mismatches?**

Backend-Core `main` already serves all three questions with owner/tenant_admin-only,
tenant-scoped (RLS), cookie-session contracts. Admin-Console consumes none of them today.

The approved Confluence baseline *ERP Integration & Sync Operations* (page 25264129, section
"Admin Console / Operations") names this surface: "Integration Operations may project connector
health, mapping readiness, posting backlog, compatibility and reconciliation without creating a
second source of truth." Its Permissions section keeps the gate at the existing
owner/tenant_admin roles, with no new `erp_admin` role.

### 1.2 Not a merge into RT-391 (Platform Control Center)

RT-391 (Done, Planning; owner decisions D1–D5 approved 2026-10-12) is for the **platform
operator** working **across tenants** under a purpose-bound support session. Its v3 plan states
that the tenant owner has **no access** to the Platform Control Center. Every contract this spec
consumes is the opposite: **tenant-scoped, owner/tenant_admin only**, with cross-tenant reads
returning a non-disclosing 404.

| | 016 (this spec) | RT-391 Platform Control Center |
| --- | --- | --- |
| Persona | Tenant owner / tenant_admin | `platform_admin` (not a tenant owner) |
| Scope | One tenant (its own) | Cross-tenant, under a support session (RT-414) |
| Connector view | The tenant's own instances, liveness and backlog | Platform-wide connector liveness, **RT-391 Phase 2** |
| Writes | Tenant-owned actions only (phases B/C) | Read-only by default; break-glass for writes (D1) |

Both read the same Backend-Core sources, and neither owns them. The **Connector heartbeat sender**
is already listed in RT-391 Phase 2 ("Connector heartbeat sender (020 wiring)"). This spec depends
on it but does not re-propose it as new work. See §6.

### 1.3 Drop: the generic "settings" half

Every operator-owned setting found has its own ticket. 016 does not duplicate any of them, and
there is no generic settings hub.

| Setting | Owner |
| --- | --- |
| Tenant branding (display name, logo) | RT-405, RT-474 (Backend-Core `tenant-branding.openapi.yaml`) |
| Shift variance policy | RT-384 (Backend-Core contract), RT-389 (Admin UI) |
| Store time zone | RT-477 (Admin UI, In Review), RT-401 (Backend-Core, Done) |

RF-7's "verified-absent" rows in `specs/001-console-foundation/api-readiness.md` (checked at
`62d0906`) are stale. `tenant-branding.openapi.yaml` now exists, and so do the connector
contracts below. Refreshing those rows is RT-558's job (Docs), not this spec's.

## 2. Actors

| Actor | Access |
| --- | --- |
| Tenant owner, tenant_admin | Full access to this surface (server-enforced `@Roles("owner","tenant_admin")`). |
| store_manager, cashier | **No access.** Navigation is hidden by role (DESIGN.md UX-09). The server is the authority: a call returns 403/404. |
| platform_admin | Out of scope here. Reaches tenant data only through RT-391 / RT-414 support sessions. |

## 3. Operator needs vs what Backend-Core `main` serves

| Operator need | Served on BC `1d26d287`? | By | Gap |
| --- | --- | --- | --- |
| ERP connection status | **Yes (contract + runtime)** | C1 `tenantAdminListConnectorInstances`, C2 `listConnectorHealth` / `getConnectorHealth` | No Connector heartbeat sender, so every instance reads `never_seen`. The summary's `connector_health` domain is hard-coded `not_available`. |
| Last successful posting / sync | **No** | Nearest proxies only: the C3 posting `DomainSummary` (dead-letter count; `detail` is fixed text such as "No posting dead-letters"), C2 `lastSeenAt` (connector liveness, not posting), C3 run `finishedAt` (stock reconciliation, not posting) | There is no "last successfully posted at" or "oldest pending posting age" read. Proposed as issue 6 (§9), stated as a need without field names. Until then the UI must not imply "posting is current". |
| Posting failures needing attention | **Yes** | C3 `consoleListPostingBacklog` | `rejectionClass` only; reason text is RT-410. |
| Reconciliation outcome | **Yes** | C3 `consoleListReconciliationRuns`, summary `reconciliation` domain | — |
| Operator-owned connector configuration | **Yes** | C1 register / issue / rotate / revoke / disable | Browser exposure deferred pending a security review (OD-1, §8); for now this is a platform-team runbook step. |
| Other tenant/store settings | Out of scope | — | See §1.3. |

## 3a. Consumed Backend-Core contracts (all exist on `main`; none invented)

| # | Contract (Backend-Core `packages/contracts/openapi/`) | Operations used | In console client today? |
| --- | --- | --- | --- |
| C1 | `connector/connector-admin.yaml` (spec 018) | **A:** `tenantAdminListConnectorInstances`. **B:** `tenantAdminRegisterConnectorInstance`, `tenantAdminIssueConnectorCredential`, `tenantAdminRotateConnectorCredential`, `tenantAdminRevokeConnectorCredential`, `tenantAdminDisableConnectorInstance` | No (not a composed source) |
| C2 | `erpnext-connector/connector-health.yaml` (spec 020) | **A:** `listConnectorHealth`, `getConnectorHealth`. (`connectorReportHeartbeat` is machine-only and never called by the console.) | No |
| C3 | `erpnext-sync-ops/console-sync-ops.yaml` (spec 025) | **A:** `consoleGetSyncOpsSummary`, `consoleListPostingBacklog`, `consoleListReconciliationRuns` | No |
| C4 | `erpnext-reconciliation/reconciliation.yaml` (spec 017) | **C (gated):** `repairPosting`, `reResolvePosting` | Partly: the source is composed, but only the three RT-178 stock ops are wrapped |

**Contract work for implementation (later, not this issue):** add C1–C3 as composed sources in
`openapi-ts.config.ts` and regenerate. This is a **regeneration at the existing pin `2b03ad2d`**,
because the files are byte-identical on Backend-Core `main` `1d26d287`. No re-pin is needed. This
planning issue changes no config or generated file.

### 3.1 Fields the UI may rely on (from the contracts, verbatim names)

- **Connector instance (C1 `ConnectorInstance`):** `id`, `display_name`, `erpnext_site_ref`,
  `environment`, `created_at`, `disabled_at`, `active_credential` (a `CredentialStatus`:
  `credential_id`, `issued_at`, `expires_at`, `revoked_at`). Never a secret.
- **Connector health (C2 `ConnectorHealthView`):** `connectorId` (= the C1 registration `id`),
  `displayName`, `environment`, `erpnextSiteRef`, `lastSeenAt`, `liveness` ∈
  {`healthy`, `stale`, `never_seen`, `disabled`}, `secondsSinceLastSeen`, `connectorVersion`,
  `backlogIndicator`, `erpnextReachable`, `reportedFieldsAt`. `liveness` is derived on read by the
  server against a 5-minute threshold. `erpnextReachable` is the **connector's self-report**,
  never a Backend-Core probe.
- **Sync-ops summary (C3 `SyncOpsSummary.domains[]`):** `domain` ∈ {`posting`, `reconciliation`,
  `connector_health`, `product_master`}, `status` ∈ {`ok`, `attention`, `not_available`},
  `headlineCount`, `detail`. Optional `store_id` filter.
- **Posting backlog (C3 `PostingBacklogItem`):** `postingStatusId`, `kind` ∈ {`sale_post`,
  `reversal`}, `sourceSystem`, `externalId`, `status` (always `permanently_rejected`),
  `rejectionClass` (nullable), `deadLetteredAt`. Cursor pagination (`nextCursor`), `page_size` ≤ 200.
- **Reconciliation runs (C3 `ReconciliationRunView`):** `runId`, `storeId`, `kind` (`stock`),
  `trigger` ∈ {`on_demand`, `scheduled`}, `status` ∈ {`running`, `completed`, `failed`},
  `startedAt`, `finishedAt`, `mismatchSummary` (per-class counts).

There is no rejection **reason text** field. Reason text depends on RT-410 (To Do, GATED
migration). The UI must not invent, parse or infer one.

## 4. Scope by phase (risk-ordered)

### Phase A — Read-only status (first implementation slice)

1. **Connection panel.** One row per registered connector instance: the C1 list joined with C2 on
   registration id. Shows display name, environment, ERPNext site ref, liveness, last seen,
   self-reported version, self-reported ERPNext reachability and credential expiry. An instance
   in C1 with no C2 row, or a failed C2 read, renders as **no signal**, never healthy.
2. **Sync summary strip.** One tile per C3 domain with its `status`, `headlineCount` and `detail`.
   `not_available` renders as a deferred/unavailable tile, not as "OK".
3. **Posting backlog list.** Paginated dead-letter rows with kind, external id, rejection class and
   dead-lettered time. Read-only, with no repair button in this phase.
4. **Reconciliation run history.** Newest-first runs with trigger, status, timing and mismatch
   counts. Stock-mismatch detail and the Refresh action stay in the shipped **Stock discrepancies**
   screen (RT-178). Phase A links to it instead of duplicating it.
5. **Store filter.** The optional `store_id` filter on the summary, backlog and run history,
   limited to the operator's in-scope stores.

### Phase B — Tenant-owned connector configuration (mutating; DEFERRED pending a security review, see §8 OD-1)

Register an instance, issue, rotate or revoke a credential, and disable an instance, through C1
only. All of these are human-session-only on the server. A `dashboard_api` machine bearer is
rejected.

### Phase C — Typed posting recovery (gated)

`repairPosting` / `reResolvePosting` (C4), as typed, precondition-checked recovery under the
Confluence 25264129 rules. Gated on RT-410 (reason text, so an operator can tell *why* before
repairing) and on a Backend-Core impact preview where the baseline requires one. Blind retry is
never offered.

## 5. Acceptance criteria (for the future implementation slices)

### Phase A

- **A-1 Truthful liveness.** `liveness = healthy` renders as connected (quiet). `stale` renders as
  degraded with `lastSeenAt` / `secondsSinceLastSeen`. `never_seen` renders as the design system's
  **"no signal"** state (hollow dot, لا توجد إشارة), never as healthy and never as "offline".
  `disabled` renders as disabled, never as healthy.
- **A-2 Current-main reality.** The Connector on `main` sends no heartbeat, so every instance
  reads `never_seen`. Given that state, the panel shows "no signal" for every instance and does
  not show an error or a healthy state.
- **A-3 Self-report labelling.** `erpnextReachable` and `connectorVersion` are labelled as
  reported by the connector, with `reportedFieldsAt`. A null value renders as "not reported".
- **A-4 No collapsed status.** No single green/red "ERP OK" bit. Each C3 domain renders separately
  (Confluence 25264129, "Health and readiness"). `connector_health: not_available` in the summary
  is shown as unavailable even when the C2 panel shows instances.
- **A-5 Backlog honesty.** Rows show `rejectionClass` or "not recorded" when null. No reason text
  is shown or inferred. An empty backlog renders as "no dead-lettered postings", with an as-of time
  from the read.
- **A-6 Isolation.** Every request uses the cookie session only. A store_manager or cashier sees
  no navigation entry, and a direct URL renders the existing NoAccess state. A 404 from an
  out-of-scope `store_id` or `registrationId` renders not-found without leaking existence.
- **A-7 Boundary.** No request leaves the console for ERPNext-Connector or ERPNext/Frappe. All
  calls go through the generated client to Backend-Core paths.
- **A-8 States.** Each panel has loading (skeleton), empty, error (banner with `request_id`),
  stale and no-access states, in Arabic and English, RTL-correct (DESIGN.md / RT-392).

### Phase B (deferred; the bar it must meet after its security review, OD-1)

- **B-1** The raw `secret` from issue or rotate is shown **exactly once**, in a dismiss-to-close
  dialog. It is never written to storage (local, session or IndexedDB), the query cache, the URL,
  logs, analytics (spec 021) or error capture (spec 020). Closing the dialog drops it from memory.
- **B-2** Rotate and revoke send an `Idempotency-Key` per user action. A retry reuses the same
  key, so a double click cannot rotate twice.
- **B-3** Disable and revoke require explicit confirmation naming the instance and its
  environment. Disable warns that every credential on the instance stops working.
- **B-4** `409 conflict` on register (an active registration already exists for the same tenant,
  environment and site ref) renders as an actionable message, not a generic error.

### Phase C (only after its gates clear)

- **C-1** A recovery action shows only when Backend-Core reports the row eligible and the reason is
  visible (RT-410). There is no "retry everything".

## 6. Backend-Core and cross-repo dependencies

| Dependency | Status | Blocks |
| --- | --- | --- |
| C1–C3 contracts and runtime on `main` | **Exist** (`1d26d287`) | Nothing; Phase A can start after client regeneration |
| Connector heartbeat sender (ERPNext-Connector → `connectorReportHeartbeat`) | **Missing.** Already listed in **RT-391 Phase 2**, with no dedicated Jira issue found | Live liveness. Phase A still ships, with truthful "no signal" |
| `consoleGetSyncOpsSummary` populating `connector_health` from the 020 read model (today hard-coded `not_available`, `erpnext-sync-ops.read-model.service.ts`) | **Gap.** No Jira issue found | Summary tile for connector health; Phase A renders it unavailable until then |
| Posting rejection reason text in the backlog | **RT-410** (To Do, GATED migration) | Phase C; a better Phase A backlog (not blocking) |
| Connector compatibility profile (RT-379) | Connector-only by **RT-391 D3**; not exposed to Backend-Core or Admin | Non-goal here |

## 7. Non-goals

- Generic tenant/store/platform settings hub (see §1.3).
- Cross-tenant or platform-wide connector views (RT-391).
- ERP item / warehouse **mapping management** UI (`erpnext-item-map.yaml`,
  `erpnext-warehouse-map.yaml` exist on Backend-Core). This is a separate domain workflow. No Admin
  ticket exists, so it is listed as a proposed issue (§9), not as 016 scope.
- Product-master sync (`product_master`, spec 021 on Backend-Core, `not_available`).
- Compatibility profile, ERP target cutover, provider Drain → Switch.
- Stock-mismatch detail and repair, which stay in Stock discrepancies (RT-178).
- Any direct call to ERPNext-Connector or ERPNext/Frappe, and any client-side health probe.
- Alerts and notifications (specs 013/014 are vision stubs; alerting is deferred by design per
  Confluence 25264161).

## 8. Decisions

### Decided (coordinator, 2026-10-16, under the owner's delegation)

- **OD-1 Browser-minted connector credentials (Phase B): DEFERRED.** Phase A ships read-only.
  Phase B (register, issue, rotate, revoke and disable from the browser) needs its own security
  review before anyone plans it. Until then, the credential lifecycle stays a platform-team
  runbook step. §5 B-1…B-4 remain the bar Phase B must meet. The question was: should tenant
  owners do this from the Admin-Console, which means showing a raw secret once in a browser?
  Backend-Core already allows it for owner/tenant_admin on a human session.
- **OD-2 Navigation placement: decided in the Phase A implementation issue**, against the RT-392
  navigation budget (UX-09). The default proposal is a role-gated "ERP connection" entry in its own
  section, like Stock discrepancies and Shift closes. Nothing further is decided here.

## 9. Proposed Jira issues (not created; the coordinator decides)

1. **Admin-Console — 016 Phase A: ERP connection & sync status (read-only)** (Implementation).
   Add C1–C3 as client sources at pin `2b03ad2d` and regenerate, then build §4 Phase A to §5 A-1…A-8.
2. **Backend-Core — populate `connector_health` in `consoleGetSyncOpsSummary` from the 020 read
   model** (Implementation, small, no contract change expected: the enum and `DomainSummary` shape
   already exist).
3. **ERPNext-Connector — heartbeat sender to `connectorReportHeartbeat`** (Implementation). This is
   **already named in RT-391 Phase 2.** Create it once, as a shared dependency of 016 and RT-391,
   not twice.
4. **Admin-Console — 016 Phase B: connector registration & credential lifecycle**: **deferred
   pending a security review** (OD-1). It is not planned until that review clears it against §5 B-1…B-4.
5. *(Optional, later)* **Admin-Console — ERP item / warehouse mapping readiness**, if the owner
   wants mapping management in the console.
6. **Backend-Core — posting freshness read for the console** (Planning, contract-first). The
   operator needs to know when posting last succeeded, or how old the oldest pending posting is,
   for the tenant or a store. Field names and semantics are Backend-Core's to define. Today only
   the dead-letter count exists (§3).

## 10. Boundaries with sibling specs

- **009 Overview (RT-555):** the Overview may show a compact `consoleGetSyncOpsSummary` tile that
  deep-links to 016. 016 owns the detail view. RT-555 defers that tile until 016 exists.
- **013 Monitoring / pipeline ops (vision stub):** overlaps on posting backlog and reconciliation
  runs for the tenant persona. Flagged to RT-558 so the stub can be pointed here or retired.
- **Sale-sync-ops (Backend-Core spec 032, `sale-sync-ops/sale-sync-ops.yaml`):**
  `consoleGetSaleSyncStatus`, `consoleListNeedsRepair`, `consoleGetSaleAuditTimeline` and
  `consoleRepairSaleSync` exist (owner/tenant_admin). They cover POS → Backend-Core sale sync
  per sale, not ERP posting. Per-sale sync status belongs to the sale detail in **012 Sales
  (RT-556)**. `consoleRepairSaleSync` is **excluded from 016**. RT-391 found the needs-repair
  dead-letter producer unwired. On BC `1d26d287` the producer
  (`apps/worker/src/sales/sale-sync-deadletter.producer.ts`) exists, but code search shows no
  caller outside its own test. Re-verify before any UI relies on that list being non-empty.
- **Stock discrepancies (shipped, RT-178):** owns negative on-hand and the reconciliation Refresh.
  016 run history links to it.
- **020 Admin observability instrumentation:** watches the Admin app itself, which is distinct
  from connector health. Phase B secrets must be excluded from it (B-1).

## 11. Vision reference (superseded intent only)

[`docs/design/_vision/vision-1/09-settings-integrations.png`](../../docs/design/_vision/vision-1/09-settings-integrations.png)
is **superseded intent**. Design input for implementation is `DESIGN.md` and the RT-392 design
system (state semantics: healthy is quiet, unknown/no-signal is never neutral-green, and stale
shows its as-of time).
