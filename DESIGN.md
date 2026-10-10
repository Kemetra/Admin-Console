---
name: Retail Tower Console
description: >-
  Admin Console design baseline, rebaselined to the Retail Tower UX/UI Constitution
  (UX-01…UX-13, Final Audit 2026-10-07). Target: light-first Mineral Daylight + Tower Teal,
  one shared semantic color system with POS, Arabic-first (Dubai) type voice, RTL by structure.
  The token block below records the CURRENT SHIPPED tokens (src/styles/tokens.css), which stay
  technical truth until a bounded Jira slice migrates them. They are not the target.
status: current-shipped-tokens
# CURRENT SHIPPED TOKENS — a SUBSET of src/styles/tokens.css on main (colors, type, radius,
# spacing); tokens.css is authoritative and also holds the surface, shadow (incl. the gold
# ring), motion and shell tokens. A single dark token set:
# there is no light theme, no [data-theme] switch and no theme toggle in production.
# Gold / navy / Inter below are migration debt (see "Migration debts"), not design intent.
colors:
  bg: "#0d1520"
  surface: "#131e2e"
  surface-raised: "#1a2840"
  surface-sunken: "#0a1018"
  surface-overlay: "#1e2d42"
  border: "#2a3d55"
  border-strong: "#3a5270"
  text: "#e8eef5"
  text-muted: "#8a9db5"
  text-disabled: "#4a5e78"
  primary: "#1f4e7a" # navy action fill — retired as a target (UX-02: teal = intent)
  primary-hover: "#163d61"
  primary-subtle: "#0e1e30"
  accent: "#2e7da3" # interactive accent; most (not all) current focus rings
  gold: "#c8a24a" # Tower Gold — retired as a target (UX-02: no secondary brand accent)
  gold-soft: "#2a2010"
  gold-muted: "#8a6a2a"
  success: "#1f8a5b"
  warning: "#b87600"
  danger: "#b32e36"
  info: "#1e6f8c"
  success-on-dark: "#52b986"
  warning-on-dark: "#d49030"
  danger-on-dark: "#c84d55"
  info-on-dark: "#50a2c0"
typography:
  fontFamily: "Inter Variable, Inter, Segoe UI, system-ui, -apple-system, sans-serif" # retired as a target (UX-03: Dubai)
  monoFamily: "ui-monospace, Cascadia Code, JetBrains Mono, Consolas, monospace"
  display: "1.875rem"
  headline: "1.25rem"
  title: "1rem"
  body: "0.875rem"
  label: "0.8125rem"
  caption: "0.75rem"
  mono: "0.8125rem"
rounded:
  sm: "4px"
  md: "6px"
  control: "10px"
  card: "12px"
  dialog: "16px"
  pill: "9999px"
spacing:
  s1: "4px"
  s2: "8px"
  s3: "12px"
  s4: "16px"
  s5: "24px"
  s6: "32px"
  s7: "48px"
  s8: "64px"
  s9: "96px"
---

# Design System: Retail Tower Console

> **Version 2.0 — Constitution rebaseline (RT-265, 2026-10-10).** Supersedes v1.0 ("The Lit
> Command Desk": dark default, navy action, Tower Gold authority, Inter). v1.0 is retired as
> design intent and kept only in git history. Authority for future Admin UI is the
> Retail Tower UX/UI Constitution in Confluence (RETAIL space). This file explains how that
> authority applies to this repository. It does not restate every rule, and it does not claim
> that any target below is shipped.

## 1. Precedence

1. **The Constitution governs future Admin UI.** UX-01…UX-13 plus the
   [Final Audit & Implementation Gap Map](https://rahmaqanater.atlassian.net/wiki/spaces/RETAIL/pages/24510466)
   (2026-10-07) are the design authority. The most specific module owns its jurisdiction
   (UX-02 color, UX-03 type/icons, UX-04 layout, UX-09 navigation, UX-10 tables, UX-11
   accessibility/RTL, UX-12 copy/localization, UX-13 data visualization).
2. **Shipped tokens remain technical truth until a bounded slice changes them.** GitHub `main`
   (`src/styles/tokens.css` and component CSS) is what production renders today. A new surface
   consumes the existing role tokens (`--color-*`, `--space-*`, `--radius-*`, `--text-*`) and
   must not hardcode hex. It must not deepen deprecated identity either: no new gold usage,
   no new navy-as-brand usage, no new dark-only assumptions.
3. **Migration happens per bounded Jira slice**, never as one "implement the Constitution"
   change. Each slice re-verifies `main`, names the Constitution rules it implements, and
   supplies visual, accessibility and runtime evidence for the surface it touches.
4. **Brand yields to accessibility.** UX-02 brand and semantic colors yield to UX-11
   forced-colors and high-contrast requirements. Meaning never depends on a branded color.

### Superseded / reference-only in this repository

| Artifact | Status |
| --- | --- |
| `DESIGN.md` v1.0 (dark default, Tower Gold authority, navy action, Inter, English/LTR shell) | **Superseded** by this version. |
| `PRODUCT.md` — Design Principle 6 ("dark by default … light alternate") and the dark-*default* note under Anti-references | **Superseded** by UX-02 light-first. The rest of PRODUCT.md (users, purpose, principles 1–5) stands. Reconciling PRODUCT.md is a separate docs change. |
| `design_handoff_retail_tower_console/` — screens, charts, theme, KPI coloring, dual-axis patterns, route map, chart palette | **Reference/prototype only** (Final Audit; UX-13 prototype disposition). Nothing in it is production authority unless a Constitution-backed issue adopts it. |
| `docs/design/_vision/`, `docs/design/rf1-auth-shell/`, `docs/design/rf6-audit-search/` mockups and their `tokens.css` | Historical slice references. They are not the target identity. |

## 2. Product character (UX-01, UX-09)

The Console is an **adaptive operational workbench**. It is not a scaled-up POS, a card
dashboard or a marketing surface. POS navigates tasks; the Admin Console navigates the system.
Every screen answers *where am I acting, and what is true* before anything else. Identity
comes through behavior: state handling, selection grammar, data geometry and surface
hierarchy. It does not come from ornament, logos or a second accent color.

Admin may use more **Responsive** motion than POS (UX-06). Expressive motion is rare and
never on operational truth. `prefers-reduced-motion` collapses durations to instant, but
focus, copy, status and border/icon feedback stay intact.

## 3. Color (UX-02, UX-13)

**Target direction: Mineral Daylight + Tower Teal, light-first.**

- **Theme.** The Admin Console defaults to **light**. A dark theme is **deferred**: no forced
  dark sidebar or dark shell to create personality. Components consume semantic role tokens
  so a future dark or high-contrast theme can remap roles without changing what a component
  means.
- **Brand anchor.** Tower Teal `#0F766E` (the current POS teal) is the working primary anchor,
  shared with POS. POS and Admin use **one semantic color system and the same token
  families**, differing in expression density, not palette.
- **No secondary brand accent.** Tower Gold is retired, along with navy as the action and brand
  color. Do not introduce purple, coral, orange or another permanent accent; a future need
  must be demonstrated by Admin or data-visualization work.
- **Neutrals.** Low-chroma mineral neutrals with a subtle blue-green relationship to Tower
  Teal. Avoid both clinical cold gray and warm beige. *Exact mineral-neutral values are a
  later token-implementation decision (UX-02); this file does not invent them.*

### Color jurisdiction

| Role | Meaning | Notes |
| --- | --- | --- |
| Teal (intent) | Primary action, selection, focus/interaction language, active brand identity | Not decoration. Brand teal is **not** success green. |
| Blue | Information / pending | |
| Green | Proven success | Only for outcomes that are proven. |
| Amber | Caution / degraded | |
| Red | Danger / consequence / **UNKNOWN** | UNKNOWN is never softened into neutral. |

- **Priority:** critical truth → primary action → current context/selection → brand identity
  → decoration. When an important operational state exists, its semantic color beats brand
  color ("Brand Yields to Truth").
- **Meaning redundancy:** color never carries operational meaning alone. Text, an icon, a
  shape/border or another cue is always present (UX-02, UX-11).
- **Low saturation budget:** most pixels stay neutral, so saturated brand and status color
  keeps its meaning. No gradients on tables, forms, operational buttons or status surfaces.
- **Data color ≠ status color (UX-13):** chart categorical, sequential and diverging palettes
  are a separate token family, never reused success/warning/danger/info. Up/down is never
  automatically green/red. No production data-viz token family exists yet.

### Visual signatures (grammar, not wallpaper)

- **Mineral Layering:** depth comes from canvas → surface → recessed → overlay tonal layers.
- **Signal Line:** a restrained **inline-start** indicator marking current context/selection in
  navigation, rows or workflow context. It uses logical positioning so it flips in RTL.
- **Pulse Dot:** a small state primitive for genuinely live states. It is static unless real
  activity is occurring, and motion respects reduced-motion.
- **Precision Ledger:** label/value alignment, tabular numerals, separators and anchored totals
  for money and operational relationships, instead of one card per value.

## 4. Typography and icons (UX-03)

- **One Arabic-first UI voice shared with POS: Dubai** (the incumbent). IBM Plex Sans Arabic is
  the long-term challenger and Noto Sans Arabic UI the density benchmark. **No speculative
  font migration:** a change of primary font needs rendered same-screen A/B evidence. Moving
  the Admin Console off Inter onto Dubai is a bounded implementation slice; it is not done.
- **Type has jurisdiction.** UI sans owns language. Tabular numerals own money, quantities and
  KPI values. **Monospace is only for machine data**: IDs, request refs, SKUs, codes and
  evidence strings. It is never used as a "technical" aesthetic.
- **Semantic type roles (target vocabulary):** `display` (rare), `screen-title`,
  `section-title`, `body`, `body-strong`, `control`, `meta`, `money-hero`, `money-total`,
  `numeric-row`, `machine`, `kbd`. Exact values are token decisions for the migration slice.
- **Readability floor: 12px.** No operator-readable text below 12px, which rules out the
  current 10px `.nav-gate` badge in new work. Arabic body keeps generous line-height.
  Hierarchy comes from placement, spacing, weight and alignment before size.
- **Icons: Fluent System Icons** is the leading family, via a **semantic icon registry**
  (`icon.store`, `icon.inventory`, `icon.sync`, `icon.posting`, …) instead of raw vendor
  names in product code. This is **pending the icon fit/licensing/bundle PoC (RT-263)**; until
  then the existing stroke icon set in `src/components/Icon.tsx` stays.
  - One icon grammar; never mix families.
  - Regular forms by default; filled only for persistent selected states.
  - Icons reinforce and text decides. Destructive, financial and recovery actions stay
    text-visible.
  - Icons inherit `currentColor`.
  - Mirror directional icons in RTL (back, forward, undo). Never mirror object icons (printer,
    store, trash).

## 5. Layout, density and shape (UX-04, UX-10)

- **Spacing:** the existing 4px-derived scale (4/8/12/16/24/32/48/64/96, `--space-1…9`) with
  semantic use for micro, component, region and page rhythm. No arbitrary values.
- **Density:** Comfortable / Operational / Compact, chosen by context and not a user setting
  yet. Dense inside a region, breathing room between regions. Under pressure, compress space
  before meaning and reflow before shrinking.
- **Data stretches; reading constrains.** Tables, grids and timelines take the available width.
  Reading and form surfaces use a constrained measure (about 60–65ch).
- **Tables are full-bleed work surfaces, never inside cards.** Surface grammar:
  - **Work Surface:** flat, minimal radius, no shadow.
  - **Section:** heading, spacing and an optional divider; not automatically a container.
  - **Panel:** tone or divider is enough.
  - **Card:** only for a genuine independent, selectable or actionable object.
  - **Drawer:** attached, with real elevation.
  - **Dialog:** the strongest elevation.
- **Shape (target):** 8px controls, 12px genuine contained objects, 16px independent overlays.
  Round the object, not the page. Pills only for true status, counts or tags, never ordinary
  buttons. *Current shipped radii (10px control) stay until the token slice changes them.*
- **Borders and tone before shadows.** Work surfaces, sections, cards and panels are shadowless.
  Popovers, drawers and dialogs may use restrained elevation.
- **One primary scroll owner** per workspace. A drawer may own its own scroll. Overflow belongs
  to the data surface, not the app shell.
- **Table grammar (UX-10):**
  - Semantic `<table>` by default. A grid model only when real cell navigation exists.
  - Rows hold data and controls hold actions. Selection is not navigation.
  - Column tiers (must-survive / contextual / metadata). Remove low-priority columns before
    meaning.
  - Numbers tabular, consistently precise and direction-isolated.
  - Sort and filter the **dataset**, never just the loaded viewport.
  - Scope changes reset filters that are no longer valid.
  - Filtered-empty and dataset-empty are different states.
  - Deliberate continuation (cursor/load-more). **Keep proven rows when a continuation fails**,
    with inline retry at the boundary.
  - Never stitch different snapshots together. Count only what the contract knows.
  - Bulk scope is explicit and countable.
  - Inspect in a drawer without losing place.
  - Virtualize only on measured evidence.

## 6. Navigation and scope (UX-09)

- **Location ≠ Scope ≠ State.** Product location, Tenant/Store scope and workflow state are
  separate axes. The shell owns persistent identity, scope and primary navigation; the
  screen owns the task.
- **Scope change is a context transition, not a filter click.** It must never silently discard
  unsaved form work; the user gets an explicit save / discard / stay path. Deep links never
  silently mutate scope.
- **Navigation has a capacity budget.** Actions and utilities are not destinations, and
  production navigation never advertises dead destinations. The current RF-* dev-gated
  entries are engineering affordances, not approved production UX.
- **Role-aware navigation:** destinations that don't belong to a role are normally hidden.

## 7. Accessibility, RTL and focus (UX-11)

- **Accessibility is operational reliability.** Every essential action is keyboard-operable.
  Use native HTML before ARIA.
- **Focus is a first-class state:** obvious, distinguishable from hover, selection and location,
  and never obscured by sticky regions or drawers. **The primary focus signal is an outline,
  not a box-shadow**, so it survives forced-colors. Focus returns to the invoker, or to the
  next meaningful owner when the invoker vanished.
- **Modal semantics require modal behavior:** `aria-modal="true"` means a Tab/Shift+Tab trap,
  a safe Escape, intentional initial focus, and focus restore on close.
- **Forced colors are an operating environment, not a brand theme.** Focus, selected, blocked,
  danger and status meaning must survive Windows contrast themes independently of brand color
  and shadow.
- **RTL is structure, not styling.** Declare `lang`/`dir` at the document, app or surface
  boundary. Use **logical properties by default** (`margin-inline-start`, `inset-inline-end`,
  `border-inline-start`, `text-align: start`). Isolate machine data (amounts, SKUs, emails,
  request IDs) with `dir="ltr"` or `<bdi>`. Visual order and Tab order tell the same story.
- **Targets:** the Admin Console may be denser than the POS 44px floor while staying above the
  accessibility floor. The current controls use 36px.
- **Evidence follows the touched surface:** static checks, component tests, a keyboard-only
  walk, axe where applicable, forced-colors captures and reduced-motion validation.

## 8. Content and localization (UX-12)

- **Arabic is the primary authored product language. One locale at a time**: never duplicate
  "Arabic (English)" on controls. English may exist as a separate locale and as
  machine/proper terminology (ERPNext, EGP, SKU, API, IDs).
- **Terminology (UI ← internal):**

  | UI term | Internal / evidence term | Note |
  | --- | --- | --- |
  | «المؤسسة» | Tenant | |
  | «الكيان القانوني» | Legal Entity | |
  | «المتجر» | Store | Never «الفرع». Business-authored names like «فرع المعادي» are kept as authored. |
  | «الصنف» | Retail Item / `tenant_product` | |
  | «الكتالوج» | Catalog | |
  | «المستخدم» | operator (generic identity) | Unless a specific role is known. |

  Code names (`operator`, `tenant_product`, `projection`) never leak into normal copy. ERPNext
  Item is never presented as the product authority.
- **Copy grammar.**
  - Name the action, not the button type. Verbs keep a stable meaning: حفظ / إضافة / تأكيد /
    إلغاء / حذف / إزالة / تحديث.
  - Errors read What → Safety → Action → Evidence.
  - Never recommend a retry that can't resolve the state.
  - **Machine codes drive copy; they are not copy.** A missing translation never shows a raw
    key or backend English.
- **Numbers and money.** Western digits in Arabic UI (`ar-EG-u-nu-latn`). Money is
  `1,250.00 EGP`: grouped, two decimals, LTR-isolated. Arithmetic is unchanged. Use
  noun-first counters («الأصناف: 11»). Pluralize whole phrases via CLDR categories, never
  `{n} + noun`.
- **Time.** Human Arabic dates with Western digits and 24-hour time for operations, in the
  **Store's** business timezone. Audit and evidence keep exact timezone-explicit (UTC)
  timestamps. Relative time orients; absolute time proves.

## 9. Components — current shipped vocabulary

These classes exist on `main` and new work reuses them until a migration slice replaces them.
**Bold** items are the deprecated identity each slice must not extend.

- **Buttons:** `.btn-primary` (**navy fill**), `.btn-secondary`, `.btn-ghost`,
  `.btn-destructive`. Keep one primary per context. In the target, primary becomes Tower Teal.
- **Badge** `.badge` (`--active` / `--suspended` / `--pending` / **`--gold`**). Status badges
  always carry text, so status is never color alone.
- **Banner** `.rtc-alert--{danger,warning,success,info}`: persistent operational state, not a
  toast.
- **Inputs** `.input` and `.field`. Errors use `aria-invalid` plus inline text.
- **DataTable** (`src/components/DataTable.tsx`), **Drawer** (focus-trapped dialog), and
  **ListState** (loading / empty).
- **Shell** (`src/shell/`): topbar, a **gold scope header** and a sidebar with a **gold active
  marker**. In the target, the scope bar is a neutral mineral surface with the teal Signal Line
  for current context. Gold is removed.

**Known debt in these components. Do not copy it.**
- **Focus:** `.btn-*` and `.input` focus is `outline: none` plus a box-shadow ring, and
  the DataTable row focus is a **gold** inset box-shadow. That is box-shadow-only focus, which
  §7 and §11 forbid. It is being replaced by an outline baseline in **RT-267**; new work uses
  an outline.
- **Gold sites beyond the scope header and nav marker:**
  - the active nav icon;
  - the sign-in brand mark and `TowerMark`;
  - the scope-button focus ring;
  - the DataTable row focus;
  - `.badge--gold`;
  - `--shadow-gold-ring`.

  All are retired by the light-first token migration (§10).

## 10. Migration debts

Each debt is tracked separately. Do not fold them into feature work.

| Debt | Constitution rule | Ticket |
| --- | --- | --- |
| Arabic-first locale + RTL: `lang`/`dir`, logical CSS, message catalog, UX-12 terminology, formatters | UX-11, UX-12 | **RT-266** (planning), then sliced implementation |
| Forced-colors support and outline-based focus baseline | UX-11 | **RT-267** |
| Complete Store scope switcher (All Stores → authorized Store) + dirty-context guard | UX-09 | **RT-268** (with RT-354 — scope menu cannot switch store) |
| Audit search keeps loaded rows when a later page fails + inline continuation retry | UX-10 | **RT-269** |
| Remove RF-* dev-gated entries from production navigation | UX-09 | **RT-270** |
| Semantic icon registry + Fluent System Icons fit / licensing / bundle PoC | UX-03 | **RT-263** |
| Light-first token migration: Mineral Daylight neutrals + Tower Teal roles; retire Tower Gold, navy action and the dark default | UX-02, UX-04 (radius 8/12/16) | **No ticket — owner to create** |
| Admin type migration Inter → Dubai (with Arabic line-height and the 12px floor) | UX-03 | **No ticket — owner to create** |
| Reconcile `PRODUCT.md` Principle 6 and the anti-reference note with light-first | UX-02 | **No ticket — owner to decide** (docs-only) |

## 11. Do's and Don'ts

**Do**
- Use role tokens, never raw hex, so the light-first token slice can remap roles in one place.
- Put tables directly on the work surface; reserve cards for genuine objects.
- Give every state a non-color cue (text, icon, shape) and verify it in forced-colors.
- Use logical CSS properties in any line you write or rewrite.
- Isolate machine data (`dir="ltr"` / `<bdi>`) and keep it monospace.
- Keep operational state in persistent banners; respect `prefers-reduced-motion`.

**Don't**
- Add new gold, new navy-as-brand or dark-only surfaces; that deepens retired identity.
- Use a box-shadow as the only focus indicator, or `outline: none` without an outline
  replacement.
- Use success/warning/danger/info as a chart palette, or color alone for meaning.
- Put a table inside a rounded card, or nest cards.
- Animate truth values (count-ups, rolling money), add bounce easing or page-load choreography.
- Copy design-handoff prototype themes, KPI coloring or dual-axis charts into production.
- Introduce a new package (including Tailwind or an icon or i18n library) without an
  authorizing Jira issue.
