# Admin Console — Arabic-first locale + RTL migration plan (RT-266)

| | |
| --- | --- |
| **Jira** | RT-266 · Work Mode **Planning** (implementation follows as separate bounded slices) |
| **Repo** | `Kemetra/Admin-Console` |
| **Baseline** | `main@f8cf36d` (2026-10-10) |
| **Authority** | [UX-11 Accessibility, RTL & Inclusive Operation](https://rahmaqanater.atlassian.net/wiki/spaces/RETAIL/pages/23166988) · [UX-12 Content, Copy & Localization](https://rahmaqanater.atlassian.net/wiki/spaces/RETAIL/pages/24477697) · [Final Audit & Gap Map §B](https://rahmaqanater.atlassian.net/wiki/spaces/RETAIL/pages/24510466) · [`DESIGN.md`](../../DESIGN.md) v2.0 (RT-265) |
| **Depends on** | RT-265 (DESIGN.md rebaseline). Merge after it. |
| **Constraints** | No new package (no i18n library, no Tailwind, no RTL plugin). Built-in `Intl` and TypeScript only. No change to API semantics, auth, scope or idempotency behavior. |

This document is a plan. It does not change production code and does not claim that any
target below is shipped.

## 1. Target in one paragraph

The Admin Console renders **one locale at a time**. Arabic (`ar-EG`, `dir="rtl"`) is the
default and primary authored language. English (`en`, `dir="ltr"`) may follow later as a
separate locale. It is not a parenthesized duplicate on every control (UX-12 "One Locale at a
Time"). Direction is declared structurally (`<html lang dir>`), and layout uses logical CSS
properties. Machine data (IDs, emails, SKUs, amounts, request refs) is isolated LTR. Copy
comes from a typed message catalog selected by machine codes. Operational numbers use
Western digits. Money uses one formatting policy. Business time uses the Store's timezone,
while Audit evidence stays in exact, labelled UTC.

## 2. Inventory (as of `main@f8cf36d`)

### 2.1 Document and shell

| Item | Current | Target |
| --- | --- | --- |
| `index.html` | `<html lang="en">`, no `dir`, English `<title>` | `lang`/`dir` set from the active locale before first paint |
| Shell grid (`app-shell.css`) | `grid-template-areas` (direction-aware; flips correctly in RTL) | no change needed |
| Scope header separator | literal `›` glyph between Tenant and Store (`ScopeHeader.tsx`) | direction-aware separator (`‹` in RTL, or a mirrored icon), `aria-hidden` |
| Drawers | right-anchored with `justify-content: flex-end` (already logical) | entry animation must follow direction (see 2.2) |

### 2.2 Physical-direction CSS (21 declarations, 8 files)

| File:line | Declaration | Logical replacement |
| --- | --- | --- |
| `src/shell/app-shell.css:82` | `right: -1px` (presence dot) | `inset-inline-end: -1px` |
| `src/shell/app-shell.css:105` | `border-right` (sidebar) | `border-inline-end` |
| `src/shell/app-shell.css:130` | `text-align: left` (nav entry) | `text-align: start` |
| `src/shell/app-shell.css:175,179` | `left: 0`; `border-radius: 0 2px 2px 0` (active marker) | `inset-inline-start: 0`; `border-start-end-radius` / `border-end-end-radius` ¹ |
| `src/shell/app-shell.css:187` | `margin-left: auto` (nav gate) | `margin-inline-start: auto` |
| `src/shell/scope-header.css:48` | `left: var(--space-5)` (scope menu) | `inset-inline-start` |
| `src/shell/scope-header.css:74` | `text-align: left` (menu item) | `text-align: start` |
| `src/shell/scope-gate.css:52` | `text-align: left` (pick) | `text-align: start` |
| `src/components/data-table.css:23` | `text-align: left` (th) | `text-align: start` |
| `src/components/data-table.css:46` | `box-shadow: inset 3px 0 0 0 …` (row focus) | replaced by an outline in RT-267 ¹ |
| `src/components/drawer.css:16` | `border-left` | `border-inline-start` |
| `src/components/drawer.css:30,34` | `translateX(16px)` entry animation | direction-aware: `translate` via a `--dir-sign` custom property set under `[dir="rtl"]` |
| `src/audit/audit.css:39` | `margin-left: auto` (filter actions) | `margin-inline-start: auto` |
| `src/audit/audit.css:65,100` | `text-align: left` | `text-align: start` |
| `src/audit/audit.css:80` | `text-align: right` (time column) | `text-align: end` |
| `src/stock-discrepancies/stock-discrepancies.css:63` | `padding-left` (guidance list) | `padding-inline-start` |
| `src/stock-discrepancies/stock-discrepancies.css:80` | `text-align: right` (`.num`) | `text-align: end` |
| `src/unknown-items/unknown-items.css:21` | `float: left` (fieldset legend) | `float: inline-start` |

¹ RT-267 (forced-colors/focus baseline) rewrites these lines anyway and converts them to
logical properties in passing. Re-check this table against `main` when the shell slice
starts. Inline `style={{…}}` in TSX: **none** with physical direction (verified by grep).

### 2.3 Hard-coded English UI strings

There is no catalog: every string is a JSX literal or a module-local constant. An approximate
count of JSX text nodes, user-facing attributes and sentence literals (a heuristic scan,
excluding tests and generated code) gives **~448** across 14 surfaces:

| Surface | Files | ~Strings |
| --- | ---: | ---: |
| stock-discrepancies | 6 | 81 |
| operators | 5 | 56 |
| receivables | 5 | 52 |
| audit | 5 | 37 |
| payers | 3 | 36 |
| unknown-items | 3 | 33 |
| auth (sign-in, accept invitation, no-access) | 3 | 29 |
| stores | 5 | 24 |
| tenants | 4 | 22 |
| settlement-reconciliation | 2 | 19 |
| shell (topbar, nav, scope header, overview) | 5 | 19 |
| components (Banner, ListState, ConfirmDelete, Drawer, …) | 5 | 18 |
| lib (`COPY` tables in `rf2-queries.ts`, `unknown-items-queries.ts`) | 3 | 16 |
| context | 1 | 5 |

Notable patterns:

- **Error copy is already decoupled from the backend.** `mapRf2Error` and the unknown-items
  mapper choose client-authored `COPY` entries by **HTTP status**; components render
  `error.message` from that mapping, not raw backend text. That is the right seam. The gap is
  that selection is keyed on status rather than the envelope's `error.code`, and the copy is
  English.
- **Machine identifiers appear in copy:** the Banner renders `request_id: …`, `PayerList`
  renders the raw enum `suspended`, and role codes (`active_role_code`) show in the topbar.
- **Gate labels** `RF-3` / `RF-4` in navigation: RT-270 removes them, so don't translate them.
- **Sentence concatenation** (for example `` `This ERPNext snapshot is older than ${…}` ``,
  `Requested <time>…</time>.`) must become whole-sentence templates.

### 2.4 Date, money and number call sites

There are no `Intl.*` or `toLocale*` calls anywhere. Values are rendered verbatim:

| Call site | Value | Today | Target |
| --- | --- | --- | --- |
| `audit/AuditTable.tsx:23` `formatTime` | `occurred_at` | ISO with `T`→space, `Z`→` UTC` | **unchanged evidence semantics**: exact UTC, labelled («التوقيت العالمي UTC»), Western digits, LTR-isolated |
| `audit/AuditInspectDrawer.tsx:39` | `occurred_at` | raw ISO, mono | same as above |
| `stock-discrepancies/SnapshotStatusPanel.tsx:30,64,108` | snapshot `readAt`, `recordedAt`, `requestedAt` | raw ISO inside `<time>` | operational human time in the Store timezone (see §4 dependency) with exact time available; Western digits |
| `stock-discrepancies/StockDiscrepancyStores.tsx:68` | as-of time per Store | raw ISO | same; a cross-Store list must expose each Store's zone or use a declared evidence zone (UX-12) |
| `stock-discrepancies/stockDiscrepancyLogic.ts:129` `formatStaleAfter` | duration (seconds) | English phrase | catalog message with Arabic plural categories |
| `stock-discrepancies/stockDiscrepancyLogic.ts:120` | negative item count | `String(count)` / `"Unknown"` | Western-digit count; UNKNOWN stays a distinct localized state, never `0` |
| `stock-discrepancies/StockDiscrepancyStore.tsx:154` | `item.quantity` | verbatim string | verbatim exact value, LTR-isolated, tabular |
| `receivables/ReceivableList.tsx:114` | `outstandingBalance` | verbatim `Money` string | money formatter (§3.3) |
| `receivables/ReconcileRemittance.tsx:126,130` | `claimedAmount`, `remittedAmount` | verbatim | money formatter |
| `settlement-reconciliation/ApplyPayment.tsx:127,140` | `outstandingBalance` | verbatim | money formatter |
| `audit/AuditPager.tsx:23` (via `AuditSearch.tsx:129`) | loaded row count | English «Showing N» | noun-first counter («المحمّل: N»), no total unless the contract gives one (UX-10) |

## 3. Design of the localization layer (no new package)

### 3.1 Locale state and document direction

- `src/i18n/locale.ts` exports a `Locale` type (`"ar-EG"` now, `"en"` later), a `DIRECTION`
  map, and a provider that sets `document.documentElement.lang` and `.dir`. Default is `ar-EG`.
- **Product locale beats device accident (UX-12).** The browser and OS locale never pick the
  language or numerals. Persisting a choice is deferred until an English locale actually
  exists, so there is no switcher while only Arabic ships.
- Portals (Drawer, scope menu) inherit `dir` from `<html>`. Any element rendered outside the
  root must set `lang`/`dir` explicitly.

### 3.2 Message catalog

- **Shape:** one typed module per locale (`src/i18n/messages/ar.ts`, later `en.ts`). The
  Arabic catalog is the source of truth. The type
  `type MessageKey = keyof typeof ar` forces every other locale to be complete at compile
  time, so a missing key is a type error, not a runtime fallback.
- **Keys:** namespaced by surface and purpose (`shell.nav.stores`, `audit.table.time`,
  `errors.network.generic`), never by English text.
- **Whole sentences with named parameters:** `t("stock.snapshot.staleNotice", { age })`.
  No string concatenation, so word order, agreement and bidi stay correct (UX-12 "Localize
  Sentences, Not Fragments").
- **Plurals:** a message may be a plural map
  `{ zero, one, two, few, many, other }` resolved with
  `new Intl.PluralRules("ar-EG").select(n)`. All six Arabic CLDR categories are required for
  natural prose. Dense metadata uses noun-first counters («الأصناف: 11») instead.
- **Machine data inside messages** is wrapped by the formatter in a `<bdi>`, or in
  `dir="ltr"` for amounts, IDs, emails, SKUs and request refs.

### 3.3 Backend error code → localized copy

UX-12: *machine codes drive copy; they are not copy*, and *a missing translation must not
become a new operational error*.

1. Mappers (`mapRf2Error`, the unknown-items mapper, `settlementWriteOutcome`, the idempotency
   helpers) resolve copy by **`error.code` first**, for example `store_code_conflict`,
   `idempotency_key_conflict`, `stale_version` or `not_signed_in`. Only then do they fall
   back to an **HTTP status family** (`errors.http.403`, `errors.http.5xx`).
2. An unknown code with a known family uses the family message, such as «تعذر إكمال الطلب.»
   with the request reference. It never shows raw backend English and never shows the key.
3. The request reference is kept exact and LTR: «المرجع: req_…» replaces `request_id: …`.
4. Copy follows **What → Safety → Action → Evidence**. «حاول مرة أخرى» appears only where a
   retry can resolve the state; the current `serverError` "Try again" is fine for 5xx and
   wrong for 401/403/409.
5. A unit test enumerates every code the generated OpenAPI documents for a surface and asserts
   that it has a catalog entry. Adding a backend code without copy then fails CI instead of
   reaching an operator.

### 3.4 Formatters (`src/i18n/format.ts`)

| Formatter | Rule | Implementation note |
| --- | --- | --- |
| Integer and count | Western digits in Arabic UI | `new Intl.NumberFormat("ar-EG-u-nu-latn")` |
| Money | `1,250.00 EGP`: grouping, two minor digits, canonical `EGP`, LTR-isolated; **arithmetic unchanged** | Input is the exact-decimal `Money` **string**. Never `parseFloat`. Group the integer part from the string (or use `Intl.NumberFormat.format(string)`, which keeps exact decimals in Node 22 and current Chromium; TypeScript's `ES2022` lib types only accept `number \| bigint`, so a typed wrapper is needed). See open questions Q2 and Q3 on precision and currency. |
| Operational date/time | readable Arabic, Western digits, 24h, **Store timezone**, e.g. «7 أكتوبر 2026، 13:42» | `Intl.DateTimeFormat("ar-EG-u-nu-latn", { dateStyle: "long", timeStyle: "short", hourCycle: "h23", timeZone })`. Note: the default output joins with «في», so compose with `formatToParts` to get the UX-12 «،» form. |
| Evidence timestamp (Audit, request evidence) | exact, timezone-explicit, UTC-labelled; Western digits | keep the ISO value; render `YYYY-MM-DD HH:mm:ss UTC` LTR-isolated with an Arabic label |
| Relative time | orientation only; absolute value always available | `Intl.RelativeTimeFormat("ar-EG-u-nu-latn")`; never the only time on Audit |
| Duration | plural-correct phrase | catalog plural message |

All formatters take the locale explicitly and never read `navigator.language`.

### 3.5 Terminology (UX-12 authority)

| Concept | Arabic UI | Kept as evidence/internal |
| --- | --- | --- |
| Tenant | «المؤسسة» | `Tenant`, `tenant_id` |
| Legal Entity | «الكيان القانوني» | |
| Store | «المتجر» (never «الفرع»; authored names unchanged) | `Store`, `store_id` |
| Retail Item / `tenant_product` | «الصنف» | `tenant_product` |
| Catalog | «الكتالوج» | |
| Operator identity | «المستخدم» unless the role is known | `operator` |
| Roles | localized role labels from a role-code map, e.g. `manager` → «المدير», `cashier` → «الكاشير»; Admin role codes (`role_code` is a free string in the contract; the code uses `platform_admin`, `tenant_admin`, `store_manager`) need owner-approved terms (Q4) and an unknown-code fallback | raw role codes stay out of copy |

ERPNext, Frappe, EGP, SKU and API stay as proper or machine terms. Admin terms are
coordinated with POS RT-311 through the same UX-12 glossary: one authority, no shared
runtime.

## 4. Dependencies and blockers

| Need | Status | Owner |
| --- | --- | --- |
| **Store timezone** for Store-local business time | **Blocked.** The generated OpenAPI schema (`src/generated/schema.d.ts`) has no Store timezone field. Until Backend-Core exposes one, operational times stay exact and zone-labelled (UTC) rather than guessing a zone. | Backend-Core (contract issue to be created) |
| **Currency of `Money` values** | No currency field on `Money`; values are `numeric(19,4)` strings. `EGP` would be an assumption. | Backend-Core / owner decision (Q3) |
| Store scope switcher rewrite | The scope header and menu will be rewritten by RT-268 / RT-354; localize them in that slice, not twice. | Admin-Console |
| RF-* gated nav entries | removed by RT-270; do not translate. | Admin-Console |
| Forced-colors / focus baseline | RT-267 converts the shell marker and table-focus lines to logical properties. | Admin-Console |
| Dubai font | Arabic copy renders in Inter's fallback chain until the Inter → Dubai type slice. The shell slice's RTL captures must note the font used. | Owner to ticket (see `DESIGN.md` §10) |

## 5. Bounded slice plan

Each slice is its own Jira Implementation issue, one PR in this repo, with no new package.

| # | Slice | Scope | Evidence rules |
| --- | --- | --- | --- |
| S1 | **i18n foundation** | `src/i18n/` (locale, typed `ar` catalog skeleton, `t()`, plural helper, formatters + unit tests incl. all six Arabic plural categories, money-string grouping without float, Western digits); no surface changes | unit tests; `pnpm build`/lint; no visual change |
| S2 | **Document + shell** | `<html lang="ar-EG" dir="rtl">`; topbar, sidebar, scope header (unless RT-268 is in flight), sign-out, Overview, Banner/ListState/ConfirmDelete/Drawer chrome; logical CSS for every shell and shared-component row in §2.2 | RTL captures at 1280 and 1440; keyboard walk (Tab order matches visual RTL order); forced-colors capture; axe |
| S3 | **Auth surfaces** | sign-in, accept invitation, no-access, scope gate | captures (LTR emails isolated); keyboard; axe |
| S4 | **Tenants + Stores** | lists, detail, forms, error copy via codes (`store_code_conflict`, …) | RTL captures of list + form; keyboard; error-state captures |
| S5 | **Operators** | member list, invite, edit/revoke drawer, role labels | RTL captures incl. drawer; focus trap/restore re-verified in RTL |
| S6 | **Audit** | filters, table, pager, inspect drawer; evidence timestamps stay UTC-labelled | captures; keyboard shell → table → drawer → return in RTL |
| S7 | **Stock discrepancies + Unknown items** | snapshot panel, stale/pending copy, counts, UNKNOWN state | captures incl. stale and UNKNOWN states |
| S8 | **Money surfaces** | payers, receivables, settlement/apply payment with the money formatter | captures with large and zero amounts; exact-value preservation tests |
| S9 | **Error-code coverage gate** | the catalog completeness test (§3.3 item 5) across all documented codes | CI test |

**Order:** S1 → S2 → S3–S8 in any order, following product priority → S9 (or S9 alongside
S1 with a growing allowlist). S2 is the gate: no surface slice before the document is RTL.

**Evidence rules for every slice (UX-11 "evidence follows the touched surface"):**
- RTL screenshots of each touched surface at desktop widths, attached to the PR.
- Keyboard-only walk of the touched flow: visible focus, Tab order matching RTL reading order,
  focus not obscured.
- A forced-colors capture of the touched surface.
- axe on the touched routes. axe is not a repo dependency, so it needs an owner decision
  (Q5) or runs from an out-of-repo evidence script.
- Existing unit and E2E suites green; E2E selectors move from English text to roles and test
  IDs where copy changes.
- No raw localization key or backend English reachable in the touched surface.

## 6. Open questions (owner input required)

| # | Question | Why it matters |
| --- | --- | --- |
| **Q1** | **Do pilot staff use the Console?** | Sets priority. If the pilot operators are internal or platform staff only, the migration can follow the light-first token slice. If store managers use it in the pilot, S1–S2 move ahead of new surfaces such as RT-18. |
| Q2 | `Money` is `numeric(19,4)`; UX-12 says "exactly two minor digits". Should a value with non-zero 3rd/4th decimals be rounded, truncated, or shown at full precision? | Rounding display money silently could misstate truth; the formatter must not guess. |
| Q3 | Is every Admin `Money` value EGP, or will the contract carry a currency? | Determines whether `EGP` is a constant or a field. |
| Q4 | Arabic labels for Admin role codes (`platform_admin`, `tenant_admin`, `store_manager`, and any others Backend-Core issues; `role_code` is an open string in the contract). | Not in the UX-12 table. |
| Q5 | May axe (`axe-core` / `@axe-core/playwright`) be added as a dev dependency for accessibility evidence? | The evidence rules require axe and the repo forbids unapproved dependency changes. |
| Q6 | Is an English Admin locale in scope (as POS RT-311 plans), and when? | Decides whether S1 ships a locale switcher and persistence or Arabic only. |

## 7. Out of scope for RT-266

Implementation of any slice; token, color or font migration (`DESIGN.md` §10); Store
switcher behavior (RT-268/RT-354); RF-* nav removal (RT-270); Audit continuation (RT-269);
printed/fiscal documents.
