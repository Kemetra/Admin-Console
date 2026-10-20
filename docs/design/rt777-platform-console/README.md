# RT-777: Platform Console design review (P1-a)

Work item: Jira RT-777 (Planning, docs only). Follow-up to RT-391 (D1–D5), RT-414 and RT-431.
Nothing here changes `src/`, a contract or a pin. It does not open implementation issues; the slices in §4 are proposals for owner review.

## 0. Baselines and how to read the contract columns

- Admin-Console `main`: `6c804a5`. Backend-Core contracts pinned at `62f8699fb785ddd9fb3fffd1f07e1235da95138c` (`contracts/backend-core/PIN`). Backend-Core `main` was `52bbf29` when checked (2026-10-21); `platform-support-sessions.openapi.yaml` is identical at the pin and on `main` (blob `6143cc5`).
- Screens: `design/screens/` exports 20–46 (1440px, Arabic, light, mock data). They are a design record, not sign-off (`design/screens/README.md`).
- Each contract is tracked at **three levels**. One "merged" flag would hide that a slice is blocked:
  - **A, exists at `62f8699`:** the operation is in the Backend-Core OpenAPI at the pinned commit.
  - **B, pinned:** the file is in the PIN file list, so it is in `src/generated/schema.d.ts` and the client can call it. Adding a file means a repin (`contracts-repin.yml`), which is a separate, reviewed step.
  - **C, served:** no `x-runtime-status: contract-only`, and a controller exists on Backend-Core `main`.

| Contract file | A | B | C | Note |
|---|---|---|---|---|
| `platform-support-sessions.openapi.yaml` (`openSupportSession`, `getCurrentSupportSession`, `renewSupportSession`, `endSupportSession`) | yes (1.1.0-draft) | **no** | **no** (all four `contract-only`; no `apps/api/src/platform*` on `main`; the `platform_support_sessions` migration GATE is pending) | RT-414 contract merged in #741; runtime is not. |
| `context.openapi.yaml` (`getActiveContext`, `switchActiveTenant`) | yes | yes | yes | 1.1.0-draft is pinned: `ContextResponse.support_session` (`SupportSessionSummary`) and `user.is_platform_admin` are already generated. Today `support_session` is always null: nothing can create one. |
| `audit.openapi.yaml` (`listAuditEvents`) | yes | yes | yes | Tenant-scoped; owner and tenant admin. Will show `platform.support_session.*` and `platform.cross_tenant.accessed` rows once RT-414 runtime ships. Never returns null-tenant rows. |
| `tenants.openapi.yaml` (`listTenants`, `readTenant`) | yes | yes | yes | Platform-scope. `Tenant.status` is `active / suspended / pending`; no store counts. |
| `catalog/sale-sync-ops` (`consoleGetSaleSyncStatus`, `consoleListNeedsRepair`, `consoleGetSaleAuditTimeline`, `consoleRepairSaleSync`) | yes | yes | yes | Tenant-scoped; see the redaction gap in §1.2. |
| `erpnext-sync-ops/console-sync-ops` (`consoleGetSyncOpsSummary`, `consoleListPostingBacklog`) | yes | yes | yes | Tenant-scoped. |
| `erpnext-connector/connector-health` (`listConnectorHealth`) | yes | yes | yes | Tenant-scoped. |
| `devices.openapi.yaml` (`consoleListDevices`, `consoleGetDevice`, `consoleGetDeviceImpact`) | yes | yes | yes | Tenant-scoped. No unsynced-sales count found on the device read. |
| `console-sales.openapi.yaml` (`consoleListSales`, `consoleGetSale`) | yes | yes | yes | Carries amounts and lines. |
| `console-sales-summary.openapi.yaml` (`consoleGetSalesSummary`) | yes | **no** | yes (served, RT-649) | Needs a repin before screen 44. |
| `console-telemetry.openapi.yaml` | yes | yes | yes | Sentry envelope tunnel for Console's own errors only. Not an observability read API. |
| Break-glass (P0-b), platform audit read (RT-431), `perm_owner_console`, platform-scope health, attention, incidents, fleet | **none** | no | no | No contract in Backend-Core. |

Method: contract files read from Backend-Core at `62f8699`; `x-runtime-status` and controller directories checked on `main`. Not available to this review: the Claude Design `FOLLOW-UPS.md` and the template HTML (DesignSync was not used). Decision numbers (#11, #30) are taken from RT-414 comments 13141 and 13147 and the screens README.

## 1. Per-screen review

«تصميم فقط» means the design shows a control or data with no service behind it; it must ship `aria-disabled` with that reason (DS-R17) or not ship.

### 1.1 Table

| # | Screen and states | Contract it needs | A / B / C | Stays «تصميم فقط» | Review notes |
|---|---|---|---|---|---|
| 20 | Support session start (drawer) | `openSupportSession` {`tenant_id`, `purpose`, `ticket_ref?`}; 404 `TenantNotFound`; 409 `already_member`; 403/429 | A yes / B **no** / C **no** | The free-text «سبب الوصول (إلزامي)» field is dropped (DEC-1): the request body is `additionalProperties: false`. «مرجع التذكرة» and «الغرض» match the contract (enum and pattern). | RT-414 decision 4 kept free text out of the tenant-visible audit row. See DEC-1. The scope text («للقراءة فقط… 60 دقيقة… حد 8 ساعات») matches the contract. |
| 21 | Support session active (banner + session ledger) | `getActiveContext` (`support_session`, pinned) for the banner; `endSupportSession`; `renewSupportSession`; the ledger reuses tenant reads (`consoleGetSaleSyncStatus`, `consoleListNeedsRepair`) | banner: A/B/C yes for the read, but no session can exist (C **no** for the write ops); ledger: A/B/C yes | «إعادة محاولة ترحيل البيعين الفاشلين» (a write inside a read-only session), «فتح مساحة المؤسسة» | The screens state «بلا مبالغ ولا بيانات عملاء». The existing sale reads return amounts and lines, so that is not enforced server-side today. See OQ-4. |
| 22 | Expiring | `getActiveContext` `expires_at`, `renewal_cap_at`; `renewSupportSession` | as 21 | none | Countdown is computed client-side from server `expires_at`. |
| 23 | Renewed | `renewSupportSession` 200 (`renewed_at` set) | A yes / B no / C no | none | |
| 24 | Expired | `getActiveContext` `status: expired`; `endSupportSession` (allowed on expired); `openSupportSession` again | as 21 | none | Mid-page expiry also arrives as 403 `support_session_expired` on any tenant route; no frame (§3). |
| 25 | Tenant not available | `openSupportSession` 404 `TenantNotFound`, non-disclosing | A yes / B no / C no | none | One identical state for unknown and forbidden. The suspended case must not land here (see OQ-2). |
| 46 | Cap reached | `renewSupportSession` 409 `support_session_renewal_cap_reached`; `renewal_cap_at` in `SupportSessionSummary` | as 22 | none | |
| 26 | Break-glass active (status chip) | none. P0-b has no contract. | none | whole flow | The chip «صلاحية كتابة طارئة · إجراء واحد» must not render. |
| 27 | Break-glass re-auth (step 1) | Password re-entry plus reason (owner decision 2026-10-20). Backend-Core must define the operation. | none | whole flow | Screen text still says «لم تُحدَّد بعد» for the method: update when the contract exists. |
| 28 | Break-glass reason (step 2) | as 27 | none | whole flow | Free-text reason is correct here (it is not on the tenant-visible row of a session). The contract must say where it is stored and who sees it. |
| 29 | Break-glass confirm (step 3) | one-action break-glass scope, bound to a typed domain action (D1) | none | whole flow | Suspended tenant: refused. |
| 30 | Support platform search (tenant directory) | `listTenants` (platform scope) | A/B/C yes | «المتاجر النشطة x / y» (no store counts on `Tenant`); «قيد التهيئة» maps to `pending`; the 9/9 column; the suspended note is correct | Counts need either a contract field or removal. Search-by-name is client-side over the list unless a filter exists. |
| 31 | Support session search (within tenant) | `corr_`, `sale_`, `dev_` resolve to records | partial: sale by `saleRef` (`consoleGetSaleSyncStatus`), device by id (`consoleGetDevice`); no `corr_` resolver found | the `corr_…` lookup | The input says «أدخل معرّفًا كاملًا»: exact-ID only, which fits. |
| 32 | Sale rejected | `consoleGetSaleSyncStatus`, `consoleGetSaleAuditTimeline` | A/B/C yes (tenant-scoped; needs the session) | the repair action (`consoleRepairSaleSync` is a write; break-glass only) | Amounts and lines must be hidden. See OQ-4. |
| 33 | Sale outcome unknown | same | same | same | Only the platform team resolves an unknown outcome (D-AUD-01); no resolve action is on any contract for the platform role. |
| 34 | Sale queued | same | same | none | |
| 35 | Device offline with outbox | `consoleGetDevice`, `consoleGetDeviceImpact` | A/B/C yes | «14 مبيعات بانتظار المزامنة» count: not found on the device read | Needs a contract field, or drop the figure. |
| 36 | Not found | 404 on the above | yes | none | Non-disclosing wording is required. |
| 37 | Needs attention, default | platform-scope attention list: work items, owner, status, impact, source | none | all of it | The «تولّي» and «إغلاق مع سبب» steps are platform-internal workflow (DS-R17 allows a mock), but there is no store to put them in. |
| 38 | Needs attention, empty | as 37 | none | all | |
| 39 | Needs attention, source disconnected | Sources: Datadog, Sentry, platform logs | none | all; «إعادة ربط Datadog» is already «تصميم فقط» | The browser cannot call Datadog or Sentry (CSP `connect-src 'self'`; allowed egress rules, D9). Needs a Backend-Core read model. |
| 40 | Platform dashboard (health) | platform-scope service health, open incidents, status history | none | all | Status-history strip and distribution bar are allowed marks (D-AUD-07), but have no source. |
| 41 | Owner command center: overview | `perm_owner_console`; platform-scope impact, incident and workflow data | none | all | The owner group has no field in `ContextResponse` to gate on. |
| 42 | Owner command center: incident investigation | as 41, plus «فتح وصول مُقيَّد للأدلة» which is a support session for the affected tenant | `openSupportSession` (A yes / B no / C no); the rest none | all except the session hand-off | The hand-off is the one reusable part: it opens a support session with purpose `incident`. |
| 43 | Owner command center: observability | Datadog-derived latency and error tables, dependency map | none | all | Metrics come from Datadog («المقاييس من Datadog»). No browser egress; read-only server read model needed; vendor choice stays with RT-40. |
| 44 | Tenant dashboard | `consoleGetSalesSummary` and sync-ops summary | summary: A yes / B **no** / C yes; sync-ops: A/B/C yes | week-over-week deltas («+5.2% عن الاثنين الماضي»), per-period table if not in the summary | Tenant Console surface, not `/platform`. Out of P1-a's platform scope except as a design check; needs a repin. |
| 45 | App shell (owner) | `getActiveContext` | A/B/C yes for identity; `perm_owner_console` none | the «مركز قيادة المالك» group | Frame shows a collapsed shell («القائمة»): the narrow-width state of the shell, not the owner shell at 1440. Treat as unclear (§3). |

### 1.2 Cross-cutting findings

1. **No session can exist yet.** `openSupportSession`, `renew…` and `end…` have no runtime and are not in the pin. The `getActiveContext` banner can be built against the pinned types, but will always render nothing. The migration GATE is the first real blocker.
2. **The merged contract contradicts the suspended-tenant decision.** `TenantNotFound` still reads «deleted or otherwise unavailable». RT-414 comment 11737 and the 2026-10-20 decision say a suspended tenant opens a read-only session. The GATED wording PR must land before the start slice's acceptance criteria can pass. The decision itself is not reopened here.
3. **D4 redaction is not backed server-side.** Screens 21 and 31–35 say a session shows no amounts or customer data. The reads they reuse (`consoleGetSale`, `consoleGetSaleSyncStatus`, `consoleGetDevice`) return what the tenant sees, including amounts and lines. RT-391 says browser-side hiding is not acceptable. A support-scoped projection is a Backend-Core dependency (see OQ-4).
4. **A platform admin who is not a member cannot reach `/platform` today.** `ProtectedArea` sends `membershipCount === 0` to NoAccess and a missing `active_tenant` to ScopeGate. `/platform` needs its own gate that branches on `user.is_platform_admin` (pinned). Once RT-414 runtime ships, `switchActiveTenant` also answers a platform admin 403 `support_session_required`, so the tenant picker cannot be the entry path.
5. **Platform-scope screens (37–43) have no contract at all.** They stay «تصميم فقط» and are not pilot scope.
6. **Writes inside a support session.** Until P0-b, a support session admits tenant writes at the API (RT-414 comment 11699). The UI must not offer any write in a session; this is a UI safeguard, not a security control.
7. **Field gaps:** store counts per tenant (30); unsynced-sales count per device (35); a `corr_` resolver (31); deltas (44); `Tenant.status` has no «قيد التحقيق» or other design lifecycle words (only `active / suspended / pending`).
8. **Design layout issues to fix when drawn again:** frames 44 and 45 show wrapped button labels and overlapping timestamps (for example the attention-card time overlaps its badge). These are design bugs, not component requirements.

## 2. `/platform` IA and navigation proposal

Principle (shell rule 7): navigation shows live, role-relevant destinations only. The frame's navigation is illustrative; this replaces it.

**Entry and gate.** `/platform` is reachable only when `context.user.is_platform_admin` is true (usability only; every check is server-side, D1). It uses its own tenant-less shell: no tenant scope bar, a platform identity label, and the support-session bar when a session exists. A platform admin never goes through ScopeGate or the tenant picker.

**Landing: the tenant directory, not Platform Health.** The directory is the only platform-scope screen with a contract (`listTenants`).

| Group | Destination | Route (proposal) | Phase |
|---|---|---|---|
| Support | المؤسسات (tenant directory, screen 30) | `/platform/tenants` | pilot |
| Support | الجلسة الحالية: support start and state | `/platform/support-session` | pilot |
| Inside a session (tenant-scoped, read-only) | بحث الدعم (screen 31–36) | `/platform/support/search` | pilot |
| Inside a session | The existing tenant read views (sale sync, devices, ERP status), reused with the session banner | existing routes, under a session-aware shell | pilot, after redaction (OQ-4) |
| Platform (later) | يتطلب الانتباه, صحة المنصة, الحوادث, أسطول الأجهزة | `/platform/attention`, `/platform/health`, `/platform/incidents`, `/platform/fleet` | after contracts |
| Platform audit (later) | تدقيق المنصة | `/platform/audit` | after RT-431 |
| مركز قيادة المالك (role group) | نظرة المالك, التحقيق في الحوادث, مراقبة المنصة | `/platform/owner/*` | after `perm_owner_console` and contracts |

Rules:

- The session bar (screen 21 and siblings) sits under the top bar and is the only place that shows purpose, ticket, remaining time, renew and end. Its states are exactly those of the contract: `active`, `expired`, cap reached. It never offers break-glass in this phase.
- Until a destination has a served contract it is not in the nav. The dev-only `GATED_NAV` pattern in `AppShell` may show placeholders in development builds only, as today.
- The owner group is hidden unless the user holds `perm_owner_console`. The permission needs a contract field; until then the group does not render at all (not as disabled).
- Tenant-scoped routes keep the tenant Console's own role navigation. Inside a session, the nav follows the read-only role that the server allows, not the tenant `owner` navigation.
- English and dark must work for all of it; only Stores has been drawn in those variants (§3).

## 3. Missing frames

Pilot-relevant means needed for a first pilot where a platform operator can open a support session and look at one tenant. Everything else waits for contracts.

| Frame | Why | Pilot |
|---|---|---|
| Support-session start, active, expiring, renewed, expired, cap reached, tenant not available at **1280** and **390**, Arabic | Only 1440 exists. | **yes (1280)**; 390 low (support is a desk task, but the bar must not overflow) |
| Same session frames in **dark** and in **English** | Only Stores has dark and English. | **yes (Arabic light first, English and dark next)** |
| Tenant directory (30), session search (31–36) at 1280, English, dark | As above. | **yes** |
| 409 `already_member`: «استخدم تبديل المؤسسة العادي» | Not designed (RT-414 comment 11711). | **yes** |
| Renew 409s: absent, expired, cap reached | Only cap reached is drawn. | **yes** |
| 429 `rate_limited` with `Retry-After` (reuse the existing `RateLimitBanner`) | Not drawn for `/platform`. | yes |
| 403 `origin_rejected` | Not drawn. | yes (low) |
| 403 `support_session_expired` arriving mid-page on a tenant route | Needed to turn a content error into the expired bar. | **yes** |
| Suspended tenant inside a session: read-only banner, no break-glass | Only the start and directory notes exist. | **yes** |
| Platform-admin landing with no tenant and no session | The first screen a platform admin sees. | **yes** |
| Owner permission denied (`perm_owner_console`) | Owner group. | no |
| Needs attention, dashboard, owner center (37–43) at 1280, 390, dark, English | No contracts. | no |
| Break-glass flow in English, dark, 390 | Not built before P0-b. | no |
| Frame 45 at 1440 (the expanded owner shell) | The export shows a collapsed shell. | no |

## 4. Proposed implementation slices

For owner review. None is opened. Each slice is one repo unless stated. Common acceptance: `pnpm lint`, unit tests and Playwright (ar and en) pass; tokens only; no ERPNext calls; no tenant data cached across scope changes.

| Slice | Repo | Depends on | Acceptance criteria |
|---|---|---|---|
| **S0** Backend-Core runtime for RT-414 | Backend-Core | the `platform_support_sessions` migration GATE; the suspended-tenant wording PR (GATED) | The four operations are served; `x-runtime-status` removed; one `platform.cross_tenant.accessed` row per covered request; a suspended tenant opens a read-only session. This is RT-414, not a new issue. |
| **S1** Repin and `/platform` gate (first slice; must land before any `/platform` UI) | Admin-Console | S0 (the RT-414 runtime, in progress in Backend-Core) and a repin of `platform-support-sessions.openapi.yaml`; `contracts-repin.yml` | The PIN includes `platform-support-sessions.openapi.yaml`; generated types compile. A platform-admin entry path exists: `/platform` renders for `is_platform_admin` with no membership and no active tenant; others get a non-disclosing no-access; unit tests for the gate. |
| **S2** Support session bar and lifecycle | Admin-Console | S1, S0 served | Bar shows purpose, ticket, remaining time (from server `expires_at`), renew, end. States: active, expiring, expired, cap reached. Renew and end call the operations; 409 codes map to the screen states; a 403 `support_session_expired` on any tenant call switches to the expired bar. No write control exists in a session. |
| **S3** Tenant directory and start flow | Admin-Console | S1, S2, `listTenants`, S0 wording PR | Directory lists `listTenants`; start drawer sends `purpose` and optional `ticket_ref` only (client-validated with the contract pattern; no free-text reason, DEC-1); 404 shows the single non-disclosing state; 409 `already_member` links to the normal switch; suspended tenant opens read-only with break-glass absent. |
| **S4** Support-scoped read views | Admin-Console + Backend-Core | S2; a support-scoped projection with no amounts, lines or customer data (OQ-4) | Search by sale ID or device ID inside the session; status, outcome, document reference and IDs only (D4); a test proves the amounts are absent from the server response, not hidden in the browser. |
| **S5** Owner-visible audit | Admin-Console | S0 | An owner or tenant admin sees `platform.support_session.*` and `platform.cross_tenant.accessed` rows in the existing audit view with recognisable labels (no new filter needed). |
| **S6** Platform audit read | Backend-Core then Admin-Console | RT-431 contract and owner decisions | Read-only list of null-tenant platform audit rows for platform admins, behind `/platform/audit`. Not pilot. |
| **S7** Break-glass | Backend-Core then Admin-Console | P0-b contract: password re-entry and reason; one-action scope; suspended tenant refused | Not before the contract is merged. Screens 26–29 get built from that contract; nothing renders before. |
| **S8** Platform health, attention, owner group | Backend-Core then Admin-Console | Platform-scope read models; `perm_owner_console` field and audit; vendor choice (RT-40) | Not pilot. Screens 37–43 are built only against served contracts. |

Ordering for a pilot: S0 → S1 → S2 → S3 → S5, with S4 before any tenant data is shown to an operator.

## 5. Open questions

| # | Question | Recommended answer |
|---|---|---|
| OQ-2 | Suspended tenant: the merged `TenantNotFound` text says «deleted or otherwise unavailable». | Ship the GATED wording PR first (RT-414 comment 11737 already decided it). S3 acceptance depends on it. |
| OQ-3 | The `/platform` gate: where does a platform admin with no membership land? | `/platform/tenants`. Never ScopeGate. Branch on `user.is_platform_admin`. |
| OQ-4 | D4 says no amounts or customer data in a support view, but the existing reads return them. | Add a Backend-Core support-scoped projection (P0-b-adjacent) and test it at the API. Until then, S4 stays blocked and the support views show only fields the existing reads already limit; do not hide data in the browser. |
| OQ-5 | `perm_owner_console` has no field in `ContextResponse`. | Backend-Core adds a field (or a separate read) as part of its contract. The Console hides the owner group until it exists; it does not infer the permission from `is_platform_admin`. |
| OQ-6 | Where does platform-internal workflow state live (take ownership, close with a reason, status history)? | Backend-Core, in a platform-scope store with its own audit. Not in the browser, not in Jira. Not pilot. |
| OQ-7 | Observability panels (39, 43) cite Datadog and Sentry as sources. | A Backend-Core read model only; no browser calls (CSP `connect-src 'self'`, D9, RT-391). Vendor choice stays with RT-40. Mark «تصميم فقط». |
| OQ-8 | Store counts, unsynced-sales count, a `corr_` resolver and week-over-week deltas have no contract fields. | Drop them from the first build. Add fields to Backend-Core only if the owner confirms they are pilot-needed. |
| OQ-9 | `support_session` is shown in the pinned `getActiveContext` but cannot exist yet. Build the bar now? | No. Build it with S2, against a served runtime, so it is tested against real states. |
| OQ-10 | Does a platform admin who is a tenant member need a support session? | No (contract). The `/platform` bar must not show for a member-entered tenant (`support_session` is null there). |
| OQ-11 | The repin: who performs it and when? | S1, through `contracts-repin.yml`, as its own reviewed PR; adding `console-sales-summary` for screen 44 goes in a separate repin. |

## 5a. Decisions recorded in this review

| # | Decision | Source |
|---|---|---|
| DEC-1 | Screen 20 drops the free-text «سبب الوصول» field. The purpose enum plus the optional `ticket_ref` are the reason, consistent with RT-414 decision 4. A bounded reason field would be a future GATED contract change and is not recommended. | Parent session, under owner delegation, 2026-10-21 |

## 6. Gaps in this review

- `FOLLOW-UPS.md` and the Claude Design templates were not read. The deltas in §1 are from the PNG exports.
- Backend-Core runtime was checked by controller presence and `x-runtime-status`, not by running it.
- Only the first part of each multi-part export was inspected for the screens with `-a/-b/-c` parts, except frame 20 (both parts).
