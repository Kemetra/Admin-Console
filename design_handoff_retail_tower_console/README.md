# Handoff: Retail Tower Console

> [!IMPORTANT]
> **Reference / prototype only — not design authority (RT-265, 2026-10-10).**
> The Retail Tower UX/UI Constitution
> ([Final Audit, 2026-10-07](https://rahmaqanater.atlassian.net/wiki/spaces/RETAIL/pages/24510466))
> supersedes this bundle's identity. In particular these are **not adopted**:
> - the dark-by-default theme, Tower Gold "authority" and navy "action" palette (UX-02 is
>   light-first Mineral Daylight + Tower Teal, with no secondary brand accent);
> - the English/LTR-first copy (UX-12: Arabic-first);
> - the KPI coloring, up=green/down=red deltas, dual-axis charts, color-only donuts and
>   semantic-status chart palette (UX-13);
> - the screen and route map as production IA (UX-09).
>
> Use it for ideas and data shapes only. The governing design baseline for this repo is
> [`DESIGN.md`](../DESIGN.md). Instructions below such as "recreate this design" and
> "final" fidelity describe the bundle as originally authored, not current intent.

## Overview
**Retail Tower Console** is the admin web console for **Retail Tower OS**, a multi-tenant retail
operations platform (tenants like *Northstar Retail*, stores like *Cairo Festival City*). It is an
operator cockpit: one signed-in operator governs tenants, stores, catalog, money, sync, audit, and
platform health from a dense, dark-by-default command surface. This package is the complete design
reference for that console — the app shell plus **23 screens** and the supporting primitives,
tokens, and behaviors.

> **North star — "The Lit Command Desk."** A quiet **gold** signal means *authority*; **navy** means
> *action*; the dense, legible data is the content. Nothing decorates. Dark by default, light by
> preference — one role system on two grounds.

## About the Design Files
Everything in this bundle is a **design reference built in HTML + React (via in-browser Babel)** — a
high-fidelity prototype of the intended look, data model, and behavior. It is **not** production code
to ship. Two prototyping conveniences must NOT survive into production:
1. Components are read off a global namespace (`window.RetailTowerConsoleDesignSystem_b7c448`) and
   screen components are attached to `window`. Use real imports/modules instead.
2. All data is hard-coded fixture data inside each screen file.

Your task: **recreate this design in the real codebase.** The production Console is a **React app**
(`src/` tree); build there using its established component library, router, data layer, and design
tokens. If starting fresh, choose an appropriate framework and reproduce the same structure. Use the
existing design-system primitives rather than re-deriving them from the prototype.

## Fidelity
**High-fidelity (hifi).** Colors, type, spacing, radii, elevation, and layout are final and
token-based — the prototype already consumes the design-system CSS variables (`var(--color-*)`,
`var(--space-*)`, `var(--type-*)`, `var(--radius-*)`). Recreate to match, mapping each token to your
codebase's equivalent. Charts and bespoke visualizations are hand-rolled inline SVG (no charting
dependency); port the SVG math or map it to your charting lib while keeping the visual spec.

---

## Architecture

### Entry & composition
- **`Retail Tower Console.html`** — the entry. Loads React 18 + Babel, the design-system bundle
  (primitives) and stylesheet/token CSS, then every screen file, and finally `app.jsx`. Also holds the
  global `<style>` block: scrollbars, the `.rtc-screen` route-entrance animation, density hook,
  responsive grid-collapse rules, live-pulse / flow / shimmer / toast keyframes, and RTL support.
- **`console/app.jsx`** — `ConsoleApp` orchestrator. Owns `route`, `theme`, `scope`, the ⌘K command
  palette, the `?` cheatsheet, and tweak-driven document attributes. Renders `<AppShell>` with the
  active screen. Maps each route id → screen component. Mounts to `#app`.
- **`console/shell.jsx`** — `AppShell` (CSS-grid layout), `TopBar`, `Sidebar`, `ScopeSwitcher`,
  `NotifBell`. This is the persistent chrome.

### App shell layout (CSS grid)
```
gridTemplateRows:    var(--shell-topbar-h)  var(--shell-scope-h)  1fr     /* 56 / 40 / fill */
gridTemplateColumns: <sidebar 240px | 60px collapsed>  1fr
gridTemplateAreas:   "topbar topbar" / "scope scope" / "sidebar content"
```
- **TopBar (56px)**: gold tower mark + "Retail Tower OS" + "Console" pill; a ⌘K search button
  (max 480px); right cluster — "Production" status pill, help, **theme toggle** (sun/moon), **NotifBell**
  (badge + dropdown), and the user chip (initials avatar + online dot + name/role).
- **ScopeHeader (40px, signature)**: persistent gold-soft authority bar reading `Tenant › Store`,
  click to open the **ScopeSwitcher** menu (tenant list + store list, check on active). Always answers
  "what am I acting in".
- **Sidebar (240px / 60px collapsed)**: `NavEntry` per route (active = 3px gold leading marker), some
  with count "gate" chips; a **System status** card; a **Shortcuts** group (toast on click); sign-out +
  collapse at the bottom. Collapses to icon-only at ≤1024px or on toggle.
- **content**: `<main>` with `var(--space-7) var(--space-6)` padding, scrolls; re-keyed per route so
  `.rtc-screen` entrance animation replays.

### Signatures (preserve these)
- **Scope header** — the gold `Tenant › Store` bar, click-to-switch. *"Scope before action."*
- **Theme toggle** — sun/moon ghost button; persists to `localStorage["rtc-theme"]`; defaults dark.
- **The Gold Authority Rule** — gold appears on exactly three things: the logo mark, the scope header,
  and the active-nav marker. **Never** an action fill, badge, or decoration.
- **Navy drives every action**; exactly **one** primary button per context. Status colors
  (success/warning/danger/info) live only on badges/banners, never as button variants or brand fills.

---

## Routes / Screens (23)

Sidebar order. Each screen receives `scope = { tenant, store }`. File → exported component in brackets.

| # | Route id | Screen | File | What it does |
|---|---|---|---|---|
| 1 | `command` | **Command Desk** | `command_desk.jsx` [`CommandDesk`] | The home cockpit — live platform topology (animated flow links + node halos), KPIs, live log feed. |
| 2 | `incident` | **Incident War-Room** | `incident.jsx` [`IncidentWarRoom`] | 3-column command layout for an active incident: timeline, affected services, actions. |
| 3 | `overview` | **Overview** | `screens.jsx` [`Overview`] | Executive summary — KPI strip, throughput combo chart, exceptions, activity feed. |
| 4 | `sales` | **Sales Monitor** | `sales.jsx` [`SalesMonitor`] | Live sales by store/hour, basket metrics, top SKUs. |
| 5 | `reconciliation` | **Reconciliation** | `reconciliation.jsx` [`Reconciliation`] | Match POS takings vs. ERP postings; flag variances. |
| 6 | `moneyclose` | **Money Close** | `moneyclose.jsx` [`MoneyClose`] | End-of-day cash close — 3-column flow, drawer counts, sign-off. |
| 7 | `outbox` | **Outbox & Sync** | `outbox.jsx` [`OutboxMonitor`] | ERP sync pipeline (queued→posting→done→failed) with retry. |
| 8 | `catalog` | **Catalog & Inventory** | `catalog2.jsx` [`Catalog`] | Product/inventory table — tree filter, search/sort/select, bulk actions. |
| 9 | `transfers` | **Inventory Transfers** | `transfers.jsx` [`InventoryTransfers`] | Inter-store stock transfers — master/detail. |
| 10 | `pricing` | **Price Changes** | `pricing.jsx` [`PriceChanges`] | Price-change requests + approvals, 3-column. |
| 11 | `returns` | **Returns & Refunds** | `returns.jsx` [`ReturnsRefunds`] | Refund queue — master/detail review. |
| 12 | `unknown` | **Unknown Items Review** | `unknown.jsx` [`UnknownItems`] | Triage unscanned/unmatched items. |
| 13 | `stores` | **Stores & Tenants** | `stores2.jsx` [`Stores`] | Tenant/store directory + health. |
| 14 | `onboarding` | **Onboard Store** | `onboarding.jsx` [`OnboardStore`] | New-store wizard — stepper + form, 3-column. |
| 15 | `operators` | **Users & Roles** | `operators2.jsx` [`Operators`] | Operator directory, roles, invites. |
| 16 | `permissions` | **Permissions** | `permissions.jsx` [`PermissionsMatrix`] | Role × capability permission matrix. |
| 17 | `audit` | **Audit Logs** | `audit2.jsx` [`Audit`] | Searchable audit trail with mono request ids. |
| 18 | `observability` | **Observability** ⭐ | `observability.jsx` [`Observability`] | **Role-aware** platform health + business correlations (detailed below). |
| 19 | `oncall` | **Alert & On-Call** | `oncall.jsx` [`AlertOnCall`] | Alert rules + on-call rotation — master/detail. |
| 20 | `settings` | **Settings & Integrations** | `settings.jsx` [`Settings`] | Tenant settings + integration connectors. |
| 21 | `billing` | **Billing & Usage** | `billing.jsx` [`TenantBilling`] | Plan, usage meters, invoices — master/detail. |
| 22 | `aistudio` | **AI Studio** | `aistudio.jsx` [`AiStudio`] | AI assist / model config surface. |
| 23 | `edgestates` | **Edge States** | `edgestates.jsx` [`EdgeStates`] | Gallery of loading / empty / error / permission states (skeleton shimmer, banners). |

**Auth**: `signin.jsx` [`SignIn`] — the pre-auth screen (`ConsoleApp` toggles `authed`). Renders the
brand, email/password fields, and an error Banner pattern.

### ⭐ Observability — the role model (most detailed screen)
A `role` lens re-shapes the entire screen. **Platform Admin (the system owner) sees everything
un-redacted**; each role below gets a tailored KPI set, fewer tabs, narrower scope, and gated revenue.

| Role key | Label | Scope | Tabs | Revenue | Infra tab | Cross-tenant |
|---|---|---|---|---|---|---|
| `platform` | **Platform Admin** *(You)* | all tenants | Overview · Services · Correlations · Incidents | ✅ | ✅ | ✅ |
| `support` | **Support Engineer** | all tenants · infra | Overview · Services · Correlations · Incidents | ❌ restricted | ✅ | ✅ |
| `tenantOwner` | **Tenant Owner** | `{tenant}` | Overview · Correlations · Incidents | ✅ | ❌ | ❌ |
| `tenantAdmin` | **Tenant Admin** | `{tenant}` | Overview · Correlations · Incidents | ✅ | ❌ | ❌ |
| `store` | **Store Manager** | `{tenant} › {store}` | Overview · Correlations · Incidents | ✅ | ❌ | single store |

Gate semantics: `revenue:false` → EGP figures become a "Restricted" chip + an info Banner; `infra:false`
→ Services tab removed; `crossScope:false` → KPIs/incidents filtered to tenant, incident "Tenant" column
dropped; `storeOnly:true` → correlations filtered to the `storeRelevant` subset, matrix swapped for an
explainer.

> **Production-critical:** the "Viewing as" segmented control is a *preview/impersonation* affordance
> for the Platform Admin tier. In the real app the **effective role comes from the session / RBAC
> claims**, and data must be **authorization-filtered server-side** — the UI redactions are a second
> line of defense, not the only one.

**Business Correlations** tab ties technical signals to business outcomes with real statistics:
- `mulberry32`/`genPairs` build a deterministic 96-point sample; `pearson` and `linreg` compute the
  real **r**, **r²**, slope/intercept, and residual SD. **In production, feed real metric time-series
  pairs through `pearson`/`linreg`** instead of the seeded sample.
- Each correlation renders a **Scatter** (viewBox 360×208): grid, residual confidence band
  (`accent` @ .10), 96 points faded by recency (`opacity 0.22 + 0.6·i/n`, r=2.4), the regression line
  (`warning-on`, 2.5), an `r²` badge, and axis labels. Plus methodology chips (`n`, `14d`, lag, `p<0.01`)
  and a business-impact figure (or "Restricted").
- A **DriverRanking** (ranked by EGP impact for revenue roles, by r for Support) and a numeric
  **CorrMatrix** (5 signals × 5 outcomes, intensity = strength).
- The four modeled correlations: ERP sync lag→delayed invoices (EGP 1.24M, ~18m), API p95→checkout
  drop-off (EGP 184K, ~4m), unknown-item rate→lost basket (EGP 47K, ~1h), POS sync gap→phantom
  stockouts (EGP 92K, ~35m).

---

## Shared primitives (recreate as reusable components)

### `console/charts.jsx` — data-viz (inline SVG, no deps)
`Sparkline` (area+line) · `KpiCard` (icon chip + value + delta + sparkline) · `ComboChart` (dual-axis
bars+line) · `Donut` (with legend) · `Panel` (card + header + action) · `LineChart` (multi-series +
optional confidence band) · `ExceptionList` · `ActivityFeed`.

### `console/widgets.jsx` — layout & table machinery
`SectionTitle` · `Tabs` (underline, navy active) · `TreeNode` (expandable hierarchy, gold marker on
active) · `BarMeter` · `Gauge` (radial) · `HeatGrid` · `DetailDrawer` · `KV` · `Toolbar` ·
`SearchInput` · `Checkbox` · `SortHeader` · `BulkBar` · `useTableState` (search + sort + selection) ·
`useLive(ms)` (interval tick, pauses when tab hidden) · `jitter(base,pct,tick,seed)` · `LivePulse` ·
`Pager` · `Avatar`.

### `console/screens.jsx`
`PageHeader` (title + subtitle + actions) and `Table` (the core dense table surface) live here — used
by most screens. Also `Overview`.

### Other support files
`command.jsx` [`CommandPalette`] — the ⌘K palette. `extras.jsx` [`ToastHost`, `Cheatsheet`] — toast
host (`window.rtcToast(msg, tone)`) + `?` keyboard cheatsheet. `tweaks-panel.jsx` — the in-prototype
Tweaks panel (a prototyping/demo tool; not part of the product UI).

### Design-system components consumed (map to your real ones)
`Button` (navy; one `primary` per context), `Badge` (status pill), `Icon` (24×24 stroke set),
`Card`/`CardHeader`, `Input`/`Field`, `Banner` (persistent alerts, with `requestId`), `NavEntry`,
`ScopeHeader`.

---

## Interactions & Behavior
- **Routing**: `route` state, persisted to `localStorage["rtc-route"]`. Sidebar/command-palette set it.
- **Command palette (⌘K)**: fuzzy nav to any route + actions (theme, density, motion, language, sign
  out, switch tenant). **Keyboard**: `⌘K` palette; `?` cheatsheet; `g` then a digit jumps to a route;
  `t` toggles theme; `Esc` closes overlays. (Don't use these handlers when focus is in an input.)
- **Scope switching**: re-fetches context; switching tenant resets store to "All stores".
- **Theme**: dark/light via the toggle; persisted; defaults dark.
- **Live data**: `useLive` ticks every 2.6s (paused when tab hidden); `jitter` wobbles live KPIs and
  the trailing chart point. `.rtc-live-val` flashes on change.
- **Motion**: route entrance `.rtc-screen` (~240ms translateY+fade). Decorative motion (topology flow,
  halos, shimmer, toast) is gated off by `data-motion="off"` and `prefers-reduced-motion` (→ 0ms).
  Durations 80–320ms ease-out; **no layout-property animation, no bounce, no page-load choreography.**
- **Hover**: backgrounds shift to a raised tint (active nav uses navy-subtle); text goes
  full-strength; primary buttons deepen. **Never** add a drop shadow on hover.
- **Focus**: 3px ring — navy on primary, teal on inputs, red on destructive, gold-ring on scope
  elements. Every interactive target ≥ 36×36px.
- **Toasts**: `window.rtcToast(message, tone)` → `ToastHost`. Errors are **persistent Banners**, never
  toasts; every error states what happened, who can fix it, how — and carries a mono `request_id`.
- **Responsive**: KPI strips wrap (6→3→2), 3-column command layouts collapse progressively, master/
  detail panes stack, dense tables scroll-x rather than clip. See the media queries in the HTML
  `<style>` block (class hooks `.rtc-warroom`, `.rtc-mclose`, `.rtc-obx`, `.rtc-corr`, etc.).
- **RTL / bilingual**: `lang="ar"` swaps to IBM Plex Sans Arabic + `dir="rtl"`; chrome strings are
  translated (`STR`, `NAV_AR`); screen bodies stay English (a common bilingual-admin pattern). Use
  logical CSS properties (`inset-inline-*`, `margin-inline-*`).

## State Management
| State | Where | Persistence |
|---|---|---|
| `route` | `ConsoleApp` | `localStorage["rtc-route"]` |
| `theme` | `ConsoleApp` | `localStorage["rtc-theme"]` (default dark) → `<html data-theme>` |
| `scope` `{tenant, store}` | `ConsoleApp` | in-memory; drives every screen + scope header |
| `authed` | `ConsoleApp` | in-memory (sign-in gate) |
| `cmdOpen` / `cheatOpen` | `ConsoleApp` | in-memory overlays |
| tweaks (`density`, `motion`, `accent`, `lang`) | `useTweaks` | persisted; set `data-density`/`data-motion`/`lang`/`dir` + `--color-accent` |
| `role` (Observability) | `Observability` | `localStorage["rtc-obs-role"]`, default `platform`; **validate on read** |
| per-screen table state | `useTableState` | in-memory (query/sort/selection) |

Production data needs: auth/session + RBAC claims; per-tenant/per-store metric series; catalog &
inventory; sync/outbox queue; incident & alert feeds; audit log; billing/usage; and time-series pairs
for correlation analysis. **All authorization-filtered to the session role.**

## Design Tokens
Consume the variables, not raw hex. Full source in **`design_tokens/*.css`** (dual-theme; dark is the
default `:root`, `[data-theme="light"]` remaps roles).

- **Brand / interactive**: `--color-primary #1f4e7a` (hover `#163d61`), `--color-accent #2e7da3`,
  `--color-primary-subtle #0e1e30` (light `#e4edf5`).
- **Gold authority** (logo · scope header · active-nav marker only): `--color-gold-marker #c8a24a`
  (always bright), `--color-gold-strong #6f5320` (text-bearing), `--color-gold-soft #2a2010`
  (light `#f4ecd6`).
- **Surfaces (dark)**: bg `#0d1520` · surface `#131e2e` · raised `#1a2840` · sunken `#0a1018` ·
  overlay `#1e2d42`. **(light)**: `#f4f7fa` · `#ffffff` · `#eef2f7` · `#e7edf3`.
- **Borders (dark)**: `#2a3d55` / strong `#3a5270` (light `#d4dde7` / `#aebccb`).
- **Text (dark)**: `#e8eef5` / muted `#8a9db5` / disabled `#4a5e78` (light `#16202e` / `#566578` /
  `#9aa8b8`).
- **Status** (theme-agnostic fills): success `#1f8a5b` · warning `#b87600` · danger `#b32e36` · info
  `#1e6f8c`. **on-text (dark)**: `#52b986` · `#d49030` · `#d16168` · `#50a2c0` (each with a `*-surface`
  tint; light variants in `colors.css`).
- **Spacing (4px grid)**: 1=4 · 2=8 · 3=12 · 4=16 · 5=24 · 6=32 · 7=48 · 8=64 · 9=96 px.
- **Radius**: sm 4 · md 6 · control 10 · card 12 · dialog 16 · pill 9999.
- **Type** (IBM Plex Sans UI · IBM Plex Sans Arabic · IBM Plex Mono for IDs/refs/numbers): display
  700 30/1.25 · headline 600 20/1.3 (-0.01em) · title 600 16/1.375 · body 400 14/1.5 · label 600
  13/1.25 · caption 400 12/1.4 · mono 400 13/1.5. Tabular-nums in tables/values. **Never all-caps
  content**; eyebrows may use small uppercase 0.04–0.06em.
- **App-shell rails**: topbar 56 · scope 40 · sidebar 240 (collapsed 60) · control-h 36.
- **Elevation/motion**: flat by default; shadow only for structural layering, never on hover (use a
  raised background tint). See `elevation.css`. Reduced-motion → 0ms.

## Assets
- **Icons**: shared stroke set — 24×24 viewBox, `fill:none`, 1.75 stroke (1.5 accent), round caps/
  joins, `currentColor`; one `<Icon name=… size=…/>` primitive (nav 18px, headers/empty 24px). Used
  glyphs include: overview, stores, catalog, unknown, operators, audit, settings, activity, gauge,
  alert, signal, link, clock, bell, sign-out, sun, moon, chevron, check, info, tower, plus, search,
  help. Use your codebase's icon component; don't inline ad-hoc SVGs.
- **Charts/visualizations**: all hand-rolled inline SVG — no external charting dependency required.
- The brand **tower mark** (gold stroke) is the only persistent gold in the chrome. No raster images,
  no gradients, no glassmorphism in app UI.

## Files
- `Retail Tower Console.html` — entry (load order + global styles/animations/responsive rules).
- `console/` — all 31 source files (orchestrator `app.jsx`, shell, 23 screens, `command.jsx`,
  `extras.jsx`, `signin.jsx`, `charts.jsx`, `widgets.jsx`, `screens.jsx`, `tweaks-panel.jsx`).
- `design_tokens/` — `colors.css`, `typography.css`, `spacing.css`, `elevation.css` (exact token
  values; the bound design system carries the full set + `styles.css` + the component bundle).

**Start here:** `console/app.jsx` (routing + global state) → `console/shell.jsx` (chrome) →
`console/charts.jsx` + `console/widgets.jsx` (primitives) → then individual screen files. The most
behavior-rich screen is `console/observability.jsx`.
