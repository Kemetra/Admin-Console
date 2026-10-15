# Spec 021 — Console Product Analytics (PostHog): adoption, privacy and allowed-egress plan

**Status:** PLANNING-ONLY — draft for owner review. No SDK, no project key, no config, no event, no network call, no CSP/CI/package change is authored or implied here.
**Jira:** [RT-480](https://rahmaqanater.atlassian.net/browse/RT-480) (Work Mode: Planning) · Parent [RT-5](https://rahmaqanater.atlassian.net/browse/RT-5) W5 Console Operations.
**Owning repo:** `Kemetra/Admin-Console`. **Policy authority:** `Kemetra/Orchestrator` Technical Handbook (read only here — not edited).
**Date:** 2026-10-15.

**Baselines verified for this plan**

| Repo | `origin/main` SHA | What was read |
|---|---|---|
| `Kemetra/Admin-Console` | `fd6eb13` | routes (`src/App.tsx`, `src/shell/*Routes.tsx`), `src/auth/AcceptInvitation.tsx`, `index.html`, `src/vite-env.d.ts`, `e2e.config.ts`, `package.json`, spec 020 |
| `Kemetra/Orchestrator` | `420db8b` | `CLAUDE.md` §Sanctioned non-ERPNext egress + Observability-egress invariant; `docs/decisions/AD-TOOL-003-…md`; `docs/tooling/observability-phase-0-inventory.md`; `docs/tooling/deepwiki-adoption.md` §4 |
| `Kemetra/Backend-Core` | `ddae78a` | `.specify/memory/constitution.md` §XIV PII & Data Lifecycle Discipline + §PII & Data Lifecycle |

> **Not to be confused with:** spec [020](../020-console-observability-instrumentation/spec.md) (Sentry frontend errors + replay — AD-TOOL-003 D1), [RT-391](https://rahmaqanater.atlassian.net/browse/RT-391) (Platform Control Center diagnostics, Done), [RT-40](https://rahmaqanater.atlassian.net/browse/RT-40) (pilot observability sink / SigNoz), or the `e2e.config.ts` line that turns **off** the e2e CLI's own PostHog telemetry. This plan is about *product-usage analytics of the Console UI* only.

---

## 1. Understanding (what was asked vs. what is assumed)

**Stated (RT-480):** decide adopt-limited / defer / reject for PostHog Product Analytics, starting with Admin-Console; define a minimal allowlisted event taxonomy; threat-model tenant leakage, consent, retention, residency, access and billing isolation; default autocapture/replay/flags **off**; define the egress-approval path and the handbook update; verify credits; propose a gated first slice. No implementation.

**Assumed (owner to correct):**
- A1 — The business question is *"which Console screens/flows do pilot operators actually use, and where do they get stuck"* — not marketing attribution, not customer (shopper) analytics, not POS cashier analytics.
- A2 — The pilot has a **small number of operators across few tenants**. At that scale, usage data is low-volume and quasi-identifying (see §5.3).
- A3 — POS (`Kemetra/POS`) is out of scope for this plan; any POS adoption is a separate decision.
- A4 — The Console's governing data-protection jurisdiction is not yet recorded anywhere (default locale is `ar-EG`; no residency policy found in Confluence RETAIL on 2026-10-15). **Needs owner/legal verification.**

## 2. Decision options

| Option | What it is | Pros | Cons |
|---|---|---|---|
| **R — Reject** | No product analytics; rely on alternatives below. | Zero new egress, zero privacy surface. | No quantitative UX signal. |
| **D — Defer (recommended now)** | Ratify the policy in this plan, take no egress until the gating conditions in §2.1 hold. | Captures the design while pilot scale makes data both low-value and identifying; nothing to roll back. | Credits clock keeps running (12 months from grant). |
| **L — Adopt limited** | PostHog Cloud **EU**, manual allowlisted events only, anonymous (`person_profiles: 'never'`), memory persistence, consent-gated, key-gated default-inert, all other products off locally **and** in project settings, per-product billing limits. | Real funnel/feature-usage signal; credits cover cost. | New third-party egress + third-party script in the admin console; 7-year non-shortenable retention on paid Cloud; quasi-identification at pilot scale. |
| **S — Self-host** | PostHog hobby (Docker Compose, MIT) on Retail Tower infra. | Data stays on own infra; no third-party egress. | Officially unsupported, no CVEs/versioned releases, ≥4 vCPU/16 GB host, ops burden; cross-repo infra work. Not proportionate to pilot volume. |

**Non-telemetry alternatives that already exist (weigh before L):**
- **Backend-Core audit trail**, already surfaced in the Console by RF6 audit search (`src/audit/`) — answers *"what was done, by whom, when"* with no new egress.
- **Moderated sessions / interviews with pilot operators** — at pilot scale, five sessions out-inform a dashboard.
- **Sentry (spec 020)** — owns error/friction-by-failure signal once its own phase is approved; PostHog must not duplicate it.

### 2.1 Recommendation

**Defer (D) now, with a pre-approved path to Limited (L).** Move to L only when **all** of:
1. The owner records a concrete question that audit search + interviews cannot answer (e.g. onboarding-funnel drop-off across ≥ N tenants).
2. Operator population is large enough that route + role + locale is no longer identifying (owner sets N; suggestion: ≥ 20 active operators across ≥ 3 tenants).
3. The jurisdiction / cross-border-transfer question (A4, §5.5) is answered.
4. The egress and handbook changes in §7 are merged.

**Cost is not a reason to adopt:** expected pilot volume is far inside any free/credit allotment; the real cost risk is an accidentally enabled replay/AI product, handled by §6.

## 3. Event taxonomy (closed allowlist)

Rules:
- Event names are a **closed TypeScript union**; each name has a **fixed property schema**. Anything not in the schema is dropped, not scrubbed.
- Property values come **only from enums defined in code**: route template, screen id, form id, action id, outcome, locale, theme, app version.
- **No** IDs (tenant, store, membership, operator, receivable, claim, SKU), counts, amounts, dates, filter values, search terms, free text, error messages, URLs, query strings, hashes, referrers.

| Event | Properties (enum-valued only) | Purpose |
|---|---|---|
| `console_screen_viewed` | `route` (matched template, e.g. `/stores/:storeId`), `locale` (`ar`/`en`), `theme` (`light`/`dark`), `app_version` | Feature/screen usage |
| `console_nav_used` | `from_route`, `to_route`, `via` (`sidebar`/`back`/`breadcrumb`/`link`) | Navigation patterns |
| `console_form_started` | `form` (`tenant_create`, `tenant_edit`, `store_create`, `store_edit`, `operator_invite`, …) | Funnel entry |
| `console_form_submitted` | `form`, `outcome` (`success`/`validation_error`/`server_error`) | Funnel completion / friction |
| `console_form_abandoned` | `form`, `trigger` (`navigation_blocker_discard`/`navigation_blocker_stay`) — from the RT-268 navigation blocker (`src/shell/navigation-blocker.tsx`) | UX friction |
| `console_action_used` | `action` (closed list, e.g. `audit_search_run`, `audit_drawer_opened`, `locale_switched`, `theme_switched`), `outcome` | Feature adoption |
| `console_empty_state_seen` | `route`, `state` (`empty`/`no_access`/`error`) | Dead-end detection |

**Sample rate:** 100 % of the allowlisted events (volume is tiny); revisit only if volume grows.
**Cross-session / tenant context:** none in the first slice. `person_profiles: 'never'` + `persistence: 'memory'` ⇒ every page load is a fresh anonymous distinct id. Funnels work **within a session only**. Any tenant-level grouping (e.g. a salted, rotating tenant hash) is a separate owner decision after privacy review — **not** proposed here.

## 4. Data exclusion rules

### 4.1 Denylist (must never transit PostHog)
Raw or hashed customer/operator identifiers · operator email/name/avatar · tenant/store/membership ids and names · catalog, inventory, stock-discrepancy, sales, pricing, payment, receivables, claims, payer and settlement data · patient/RX-adjacent fields · auth tokens, JWTs, invitation tokens, cookies, session ids · full URLs, `pathname` with params, query strings, hashes, `referrer` · form values, filter values, search text, any free text · error messages/stacks (Sentry's domain) · client IP (project setting off) · device fingerprints beyond what PostHog adds by default (stripped by the allowlist rebuild).

### 4.2 Concrete leak paths found in this repo (the reason for "allowlist rebuild, not denylist strip")
- **`/accept-invitation?token=…`** (`src/auth/AcceptInvitation.tsx:28-29`) — PostHog's default `$pageview` sends `$current_url`; with defaults the invitation token would leave the browser.
- **Route params** — `tenants/:tenantId`, `stores/:storeId`, `stock-discrepancies/:storeId` (`src/shell/rf2Routes.tsx`, `stockDiscrepancyRoutes.tsx`) put business ids in `$pathname`, `$current_url`, `$initial_*`, `$referrer`.

### 4.3 Required client posture (for the future slice; option names from posthog-js config docs, read 2026-10-15)

| Concern | Setting |
|---|---|
| Autocapture | `autocapture: false` |
| Pageviews | `capture_pageview: false`, `capture_pageleave: false`; emit `console_screen_viewed` manually with the **route template** |
| Replay | `disable_session_recording: true` (and project-level replay **off**) |
| Heatmaps / dead clicks | `capture_heatmaps: false`, `capture_dead_clicks: false` (the latter defaults to `true`) |
| Exceptions | `capture_exceptions: false` — AD-TOOL-003 D1/D3 gives frontend errors to Sentry only |
| Surveys / flags | `disable_surveys: true`, `advanced_disable_flags: true` — **no remotely controlled behaviour** |
| Identity | `person_profiles: 'never'`; never call `identify`, `group`, `alias`, `register` with business data |
| Storage | `persistence: 'memory'` (intended: nothing in cookies/local/sessionStorage ⇒ no cookie-banner obligation for PostHog itself — proven by F6 AC-9, legal to confirm) |
| DNT | `respect_dnt: true` |
| Defaults bundle | **do not** set the `defaults: '<date>'` option — each date silently changes defaults; pin every option explicitly |
| Event shaping | `before_send` **rebuilds** each event from `{event, allowlisted properties, timestamp}` **plus the ingestion-required keys PostHog needs to accept the event** — the public project `token` and the random anonymous per-page-load `distinct_id` (the only identifiers the §7.1 invariant permits; any further key PostHog requires is listed and reviewed in F6 and must also fit §7.1); drops anything whose name is not in the union; strips all other `$`-prefixed auto-properties |
| External scripts | prefer no lazy-loaded scripts; `disable_external_dependency_loading` — **Needs verification** (not on the config page read) |
| Referrer | `save_referrer: false` — **Needs verification** (not on the config page read) |
| Init scope | SDK initialised **only inside `ProtectedArea`, after consent**; never on `/signin` or `/accept-invitation` |
| Key gating | empty/missing key ⇒ SDK never loads (dynamic import), no network call — mirrors spec 020 G4 |

### 4.4 Why local config is not enough — remote config
Heatmaps and exception capture fall back to **project remote config**; replay, surveys and flags are governed by **project settings**. A PostHog-UI toggle could therefore re-enable a surface with no code change — i.e. remotely controlled behaviour, which RT-480 forbids. Requirement: every surface is (a) pinned off in the client, **and** (b) off in project settings, with PostHog project-admin access restricted to the owner (§5.4). The privacy guarantee rests on (a) + (b) only. Per-product billing limits (§6) are a **spend** control, not a capture control — a $0 limit may still admit the free monthly allotment before ingestion stops (**Needs verification**).

**Server-side enrichment:** PostHog may add `$geoip_*` properties at ingestion (before the IP is discarded) — `before_send` cannot strip what is added server-side. At pilot scale, city + route is identifying. **Needs verification**; if enrichment occurs, F3/F6 must disable it (per-event GeoIP opt-out property and/or the project GeoIP transformation off).

## 5. Threat model (privacy / security)

| # | Threat | Likelihood × impact | Control |
|---|---|---|---|
| T1 | Token/ID leak via URLs, referrer, `$initial_*` | High × High | §4.2–4.3: no auto pageview, allowlist rebuild, no SDK on public routes |
| T2 | Autocapture/replay captures operator names, tenant data, receivables figures | High × High (if on) | Off in client **and** project settings (billing limits are spend-only, §4.4) |
| T2b | Server-side GeoIP enrichment adds city/region | Medium × Medium | §4.4 — Needs verification; disable if present |
| T3 | Remote re-enablement from PostHog UI | Medium × High | §4.4; owner-only admin; settings change reviewed |
| T4 | Third-party script in the admin console (SDK + any `eu-assets` lazy loads) | Medium × High | Bundle SDK from npm (lockfile-pinned, reviewed in its own slice); avoid lazy loads; future CSP `script-src`/`connect-src` restricted to the two PostHog hosts (§7.3) |
| T5 | Quasi-identification at pilot scale (route + role + locale + timestamp) | High × Medium | Defer gate §2.1(2); no role property in slice 1; no tenant context |
| T6 | Cross-tenant data mixing in one PostHog project | Low × Medium | No tenant data sent at all; one project per environment (`preprod`/`prod`, matching Phase-0 OQ-6 naming `rt-console`) |
| T7 | Retention longer than policy | Certain × Medium | §5.2 |
| T8 | Analytics outage/blocking breaks sign-in or operations | Low × High | Fire-and-forget, never awaited; failures swallowed **into a no-op** (not silently into business logic); no feature depends on PostHog; ad-blocked = fine |
| T9 | Project API key in repo | Low × Low (public-by-design write key, but still config) | Never committed; deploy-time env/runtime config (same mechanism as spec 020 OD-1); `.env.example` empty |
| T10 | Billing overrun after credits / AI products | Medium × Medium | §6 |
| T11 | Unauthorised access to analytics data | Low × Medium | Owner-only org; 2FA/SSO; no shared logins; access list reviewed quarterly |

### 5.1 Consent and user choice
- Operators are B2B staff of tenant customers. Even with anonymous, cookieless, memory-only capture, the plan assumes **explicit opt-in** in the Console (Settings toggle, default **off**), plus a short privacy notice naming PostHog as a processor. Opt-out is immediate and stops the SDK. The choice is stored locally **per user** (`rt.analytics.v1:consent:user:<id>`, mirroring the per-user `rt.locale.v1:user:<id>` pattern in `src/i18n/locale.ts`, which exists so a shared admin PC does not carry one operator's choice over to the next). There is **no browser-wide fallback**: an absent per-user key means "declined". The user id stays in local storage only and is never sent to PostHog. On sign-out or operator switch the SDK is shut down and re-evaluated against the new operator's own consent.
- Whether opt-in can be relaxed to notice + opt-out is a **legal question** (A4) — not decided here.
- `respect_dnt: true`. Global Privacy Control is **not** assumed to be handled by the SDK: the Console itself checks `navigator.globalPrivacyControl` (and DNT) before init and treats either as "declined".

### 5.2 Retention vs Backend-Core constitution §XIV
- PostHog Cloud retention is **1 year (free) / 7 years (paid)** and **cannot be shortened**; erasure is by deleting a person (none exist with `person_profiles: 'never'`) or the whole project.
- §XIV requires explicit retention windows and erasure flows. This plan states the window explicitly: **"up to 7 years (paid Cloud), anonymous events only; erasure = project deletion."** The privacy argument rests on there being nothing personal to retain — which is why §3/§4 are strict.
- **Option to verify:** a separate free-tier PostHog org/project for the Console (1-year retention, capped cost) — closer to §XIV. Trade-off: free-tier limits and loss of credit coverage.
- §XIV also requires a stated residency posture — see §5.5.

### 5.3 Pilot-scale identifiability
With few operators, "someone on tenant X opened receivables at 09:02 in `ar`" is effectively personal data. Hence: no role property, no tenant context, no timestamps finer than PostHog's own, and the §2.1(2) population threshold before going live.

### 5.4 Organisation / project / billing isolation
- Dedicated PostHog **organisation** for Retail Tower (not shared with other ventures), owner as sole admin.
- Projects: `rt-console-preprod`, `rt-console-prod`. No POS project until separately approved.
- IP data capture **off** at org default and project level (EU orgs default off — verify).

### 5.5 Hosting, region and jurisdiction
- **Cloud EU (Frankfurt)** is the only Cloud option considered; ingestion host `eu.i.posthog.com`, assets host `eu-assets.i.posthog.com`, app `eu.posthog.com`. US region rejected.
- **Needs verification:** which region the existing startup-credit org is on. If it is US, EU hosting likely means a **new org**, and the credits may not transfer — this could change the cost picture (still low at pilot volume).
- **Needs owner/legal verification:** the governing jurisdiction (Egypt PDPL and/or others, given `ar-EG` default and patient/RX-adjacent fields mentioned in the Phase-0 inventory) and its cross-border-transfer rules. **EU hosting is not automatically compliant** with non-EU transfer rules. A DPA with PostHog is required for Cloud.
- **Reverse proxy:** not the default. It is cross-repo infra, and its main benefit (bypassing ad blockers) works against user choice.
- **Self-host:** rejected for now (§2, option S).

## 6. Credits, billing and spend controls

| Fact | Source | Status |
|---|---|---|
| Startup plan with $50,000 credits, $0 bill, no events | Owner screenshot 2026-10-14 (per RT-480) | Live balance/expiry **Needs verification** |
| Credits last 12 months from grant | posthog.com startups handbook (via search result) | **Needs verification** against the live account |
| From 2026-09-14 credits cannot be used for AI products (PostHog AI, Replay Vision, Desktop, Inbox) | Handbook, via search snippet only | **Needs verification** |
| After credits are used/expired, account moves to standard paid plan automatically | Handbook, via search snippet | **Needs verification** |
| Per-product billing limits; data over the limit **is dropped permanently**; alerts at 80 %/100 % to the org owner | posthog.com/docs/billing/limits-alerts | Verified (docs). Behaviour **while on credits: Needs verification** |

**Controls (before any key exists):**
- Billing limit **$0** on every product except Product Analytics (replay, flags, surveys, experiments, data warehouse, error tracking, AI, etc.).
- Product Analytics limit set to a conservative cap (owner sets; suggestion: the lowest non-zero step, well under one month of credit burn).
- Calendar reminder 60 days before credit expiry; re-decide continue/stop then.
- No card-linked auto-upgrade without owner confirmation (verify what the plan allows).

## 7. Allowed egress and handbook update (proposal — Orchestrator is NOT edited here)

### 7.1 Proposed amendment to Orchestrator `CLAUDE.md` §Sanctioned non-ERPNext egress (Console line)
> - **Retail-Tower-Console:** Data-Pulse-2 contracts only (plus its own auth provider) · Sentry (frontend error and session-replay telemetry, DSN-gated, default-inert) · **PostHog Cloud EU (`eu.i.posthog.com` [+ `eu-assets.i.posthog.com` if the verification below shows the SDK contacts it]; product-usage analytics: allowlisted, anonymous UI-interaction events only; key-gated, default-inert, consent-gated; autocapture, replay, flags, surveys, heatmaps and exception capture off) — per AD-TOOL-00X.**

**Needs verification before F2:** whether posthog-js, with flags/surveys/replay disabled, still fetches remote config or extensions from `eu-assets.i.posthog.com`. The egress line must name every host the SDK actually contacts (F6 AC-8 proves it).

And a sibling invariant, mirroring AD-TOOL-003 D5:
> **Product-analytics egress invariant (AD-TOOL-00X).** PostHog carries **allowlisted UI-interaction events only**. **No business, catalog, inventory or sales payload, no operator or patient PII, no business or operator identifiers, no URL/query string, and no auth or session token** may transit it. The only identifiers permitted are the ingestion metadata PostHog requires to accept an event: the public project write key (`token`) and a random, anonymous, per-page-load `distinct_id` that is never derived from or linked to any operator, tenant or store. The Console enforces this by rebuilding every event from a closed schema before send. The target is key-gated, consent-gated and default-inert, and no product behaviour may be controlled remotely through it.

### 7.2 New decision record (not an AD-TOOL-003 amendment)
PostHog is **product analytics, not observability**; AD-TOOL-003 D1–D3 assigns observability signals to Sentry/Datadog. Proposed: a new `docs/decisions/AD-TOOL-00X-product-analytics-posthog.md` capturing §2–§6 decisions, plus a cross-reference from AD-TOOL-003 stating PostHog owns no error/replay/perf signal.

The AD-TOOL-003 D5 text also mentions an "architecture-boundary partial". **It could not be located** in the Orchestrator tree at `420db8b` (searched for `partial`, `boundary`, `allowed-egress`). The owner/Orchestrator maintainer should confirm whether it still exists before the egress PR.

### 7.3 CSP (separate infra gate)
The Console has **no CSP today** (`index.html` comment: a future CSP needs the inline theme/locale script's hash). Adopting PostHog makes CSP more important (T4). A CSP item — `connect-src` incl. `https://eu.i.posthog.com`, `script-src` without `eu-assets` unless lazy loads are unavoidable — is a **separate infra/deployment item**, not part of the first Console slice. Whether slice 4 may ship before the CSP is an owner decision (OD-6).

## 8. Gated follow-up issues (proposed — none created)

Each is blocked on the one before it.

| # | Proposed issue | Repo / owner | Gate in | Done when |
|---|---|---|---|---|
| F1 | Owner decision: adopt-limited / defer / reject + §9 ODs | Owner (Jira RT-480 comment) | This plan reviewed | Decision recorded on RT-480 |
| F2 | Orchestrator: AD-TOOL-00X + `CLAUDE.md` egress-list amendment (§7.1–7.2) | `Kemetra/Orchestrator` (Docs) | F1 = adopt | PR merged |
| F3 | Account setup: EU org/project, IP off, all non-analytics products off, $0 billing limits, owner-only access, DPA signed, credits/region verified | Owner, outside repos | F2 merged | Checklist evidence (screenshots) on Jira |
| F4 | Legal: jurisdiction + cross-border transfer + consent model | Owner/legal | F1 | Written answer on Jira |
| F5 | Infra: Console CSP | Deployment owner | F2 | CSP live in preprod |
| F6 | Console slice: consent toggle + notice, typed `track()` wrapper with closed event union, key-gated default-inert dynamic init inside `ProtectedArea`, allowlist-rebuild `before_send`, §4.3 config pinned | `Kemetra/Admin-Console` (Implementation; package + lockfile change explicitly authorised) | F3, F4 (+F5 per OD-6) | Tests below pass |

**F6 test plan (acceptance):**
- AC-1 Empty/missing key ⇒ SDK module never imported, **zero** requests to any `posthog.com` host (network-level assertion in Playwright).
- AC-2 Key set, consent absent/declined ⇒ zero requests.
- AC-3 `/signin` and `/accept-invitation?token=x` ⇒ zero requests even with key + consent.
- AC-4 `before_send` unit tests: output keys ⊆ allowlist (event properties **plus the explicitly listed ingestion-required keys**) for every event; unknown event ⇒ dropped; an **event property** carrying a UUID/token-shaped/URL value ⇒ event dropped (the shape check applies to event properties, not to the ingestion `token`/`distinct_id`); `distinct_id` is random per page load and differs across reloads and operators.
- AC-5 Route on `/stores/abc-123` ⇒ emitted `route` = `/stores/:storeId`; no `$current_url`/`$pathname`/`$referrer` in payload.
- AC-6 PostHog unreachable/blocked ⇒ sign-in and every RF screen work identically (no awaited calls, no console errors surfaced to UI).
- AC-7 Opt-out mid-session ⇒ no further requests.
- AC-8 (positive case) Key + consent set ⇒ the **only** hosts contacted are the ones sanctioned in the egress list (proves §7.1 is true).
- AC-9 Key + consent set ⇒ no `ph_*` (or other PostHog) keys in cookies, localStorage or sessionStorage — memory persistence may still use sessionStorage for session/window ids (**Needs verification**); the no-cookie-banner reasoning in §4.3 depends on this.
- AC-10 Operator A opts in on a browser; operator B then signs in on the same browser without opting in ⇒ zero requests for B's session (consent never carries over between operators, with or without a page reload).

## 9. Owner decisions required (NOT decided here)

| OD | Question | Recommendation |
|---|---|---|
| OD-1 | Adopt limited / defer / reject? | **Defer**, with §2.1 gates to move to limited |
| OD-2 | **Add PostHog Cloud EU to the Console's permitted egress?** | Only when OD-1 = adopt; with the §7.1 wording |
| OD-3 | Consent model: opt-in (default off) vs notice + opt-out | Opt-in until legal (F4) says otherwise |
| OD-4 | Paid Cloud (7-yr retention, credits) vs separate free-tier project (1-yr) | Verify both; prefer the one closer to §XIV |
| OD-5 | Population threshold for go-live (§2.1(2)) | ≥ 20 active operators across ≥ 3 tenants |
| OD-6 | May F6 ship before the CSP (F5)? | No — CSP first |
| OD-7 | Any tenant-level context later? | Not in slice 1; separate privacy review |

## 10. Sources (read 2026-10-15)

- posthog-js config reference — https://posthog.com/docs/libraries/js/config
- Data collection / privacy controls — https://posthog.com/docs/privacy/data-collection
- GDPR guidance (EU Frankfurt, IP capture, DPA, consent) — https://posthog.com/docs/privacy/gdpr-compliance
- Events retention — https://posthog.com/docs/data/events-retention
- Billing limits & alerts — https://posthog.com/docs/billing/limits-alerts
- Reverse proxy / hostnames — https://posthog.com/docs/advanced/proxy
- Self-hosting — https://posthog.com/docs/self-host
- Startup program — https://posthog.com/handbook/marketing/startups (page body not readable by tool; facts via search results — marked Needs verification)

> **PLANNING-ONLY.** This document authors no SDK, key, config, event, CSP, CI, package or Orchestrator change. Each follow-up in §8 is separately owner-gated.
