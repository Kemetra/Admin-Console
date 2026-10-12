# Retail Tower Design System — Claude Design bundle

Source bundle for the **Retail Tower Design System** project in Claude Design
(claude.ai), published with `/design-sync`. Work item: **RT-392**.

> **Target identity, now shipped as tokens.** This bundle expresses the approved Retail
> Tower UX/UI Constitution (UX-01…UX-13): light-first Mineral Daylight + Tower Teal,
> Arabic-first, RTL by structure. Admin-Console ships the same identity in
> `src/styles/tokens.css` since RT-396 (#87, light tokens), RT-397 (#88, Dubai type)
> and RT-398 (#89, opt-in dark theme), and the Arabic-first locale in `src/i18n/`
> since RT-399 (#92). `tests/unit/tokens-identity.test.ts` keeps the shipped colour
> and type values equal to the ones here. The screens themselves are not rebuilt on the Claude Design layouts yet
> (Stores: RT-400). Nothing in this folder is imported by the app.

## Rules for generating new screens

Read these before designing any Retail Tower Admin screen from this system.

1. **Arabic first, RTL by structure.**
   - Every screen is `lang="ar" dir="rtl"` by default, using logical CSS only.
   - English is the second locale (`lang="en" dir="ltr"`, owner decision 2026-10-11).
     Show one locale at a time; never "عربي (English)".
   - Light is the default theme; `data-theme="dark"` switches to the approved dark
     values. The shell's top bar holds the language and theme switches.
   - Terminology follows `foundations-content.html`: «المؤسسة», «المتجر», «الصنف».
2. **Tokens only.**
   - Every colour comes from `colors_and_type.css`.
   - No new hues, no purple/indigo, no gradients, no glass, no glow.
   - Most pixels stay neutral. Teal means intent: the primary action, selection and focus.
3. **Status is text first.**
   - UNKNOWN outcome (payment, posting, any consequence whose result is unconfirmed) is
     danger, never neutral. A missing signal is different: label it «لا توجد إشارة» with a
     hollow neutral dot. It is never shown as healthy.
   - Use semantic colour only for its meaning: info = pending, success = proven, warning = degraded, danger = consequence or UNKNOWN.
   - Never use colour alone.
   - A healthy state stays quiet.
   - In status badges and status labels, each word means one thing in every console
     (owner decision 2026-10-12, D-AUD-08):
     - «لا توجد إشارة»: no signal, neutral hollow. Never «غير معروف — لا توجد إشارة».
     - «غير معروف» / «النتيجة غير معروفة»: an unknown outcome only, danger.
     - «موقوفة»: a suspended tenant, neutral hollow.
     - «معلّقة»: parked postings only, neutral hollow.
     - «بانتظار تحقق» and «قيد التحقيق»: info hollow (in progress, no consequence yet).
   - The rule covers status badges and labels, not prose or value cells. Shipped app
     copy that predates it (for example «غير معروف» for a missing stock snapshot,
     required by RT-178 AC2, and «معلّقة» for a pending invite) is an owner follow-up,
     not something to change from this bundle.
   - In a pipeline, a proven failure («رُفض») has a solid danger frame, and an unknown
     stage («النتيجة غير معروفة») has a dashed danger frame.
4. **Tables are work surfaces.**
   - Full-bleed semantic tables, never inside rounded cards.
   - Tabular, LTR-isolated numbers.
   - Selection is separate from opening a row.
   - Detail opens in a drawer at inline-end.
5. **One primary action per region.**
   - Buttons name the action («حفظ المتجر»).
   - Destructive actions are never the default and sit in a separate zone.
   - Confirmation dialogs state scope and consequence, with the safe option focused first.
   - A design-only action (no service or contract yet) is `aria-disabled` with a visible
     reason starting «تصميم فقط». A mock never shows a write that touches tenant data, a
     sale, a posting or a device as succeeding. Platform-internal workflow steps (take
     ownership, close with a reason) may run in a mock with an audit row (owner decision
     2026-10-12, DS-R17).
6. **State ladder, not toasts.**
   - Use indicator → inline notice → banner → outcome → blocking surface.
   - Messages read What → Safety → Action → Evidence.
   - Operational state never lives in a disappearing toast.
7. **Shell.**
   - The shell owns identity, scope and navigation; the screen owns the task.
   - Tenant Console and Platform Console share every token. They differ only in copy, identity label and scope-bar structure.
   - Navigation shows live, role-relevant destinations only.
8. **Not yet decided: don't invent.**
   - No icon set (RT-263 pending). Use text labels; if an icon is unavoidable, mark it as a placeholder.
   - Charts (owner decision 2026-10-12, D-AUD-07; UX-13 still has no data palette):
     - Allowed: a summary count band (numbers with labels), and status marks such as a
       24-segment status-history strip or a status distribution bar. Status marks use
       status colours for their status meaning only, and each has a legend, a written
       summary and a dashed «لا توجد إشارة» segment.
     - Not allowed until UX-13 ratifies a data palette: bar, line and sparkline charts,
       threshold lines and deploy-marker charts. Show the same numbers in a table or ledger.
     - Not charts: pipeline connectors and dependency maps.
   - An overview leads with attention items and next destinations, not a KPI wall.

## Authority

1. **The Constitution in Confluence (RETAIL)**: UX-01…UX-13 plus the Final Audit &
   Gap Map. The most specific module owns its area (UX-02 colour, UX-03 type, UX-04
   layout, UX-09 navigation, UX-10 tables, UX-11 accessibility/RTL, UX-12 copy, UX-13
   data visualisation).
2. **Owner decision, RT-392 (2026-10-11).** The colour values come from the POS
   `main@543688f` light token set. They are the starting values for the shared
   Mineral Daylight + Tower Teal system.
3. **Owner decisions, Platform Console design review (2026-10-12).** D-AUD-07 (charts,
   rule 8), D-AUD-08 (status words, rule 3) and DS-R17 (design-only actions, rule 5).
   They were made in the Claude Design audit of the RT-391 screens and do not change
   the Constitution text.
4. **[`DESIGN.md`](../../DESIGN.md)** explains how the Constitution applies to this repo.

If this bundle and the Constitution disagree, the Constitution wins. Fix the bundle.

## Contents

```
design/claude-design-system/
  README.md
  colors_and_type.css        tokens: the single source for every card and design
  components.css             the shipped class vocabulary (btn, field, badge, banner, table, shell, ...)
  preview/
    _card.css                card chrome only (@imports ../colors_and_type.css and ../components.css)
    foundations-*.html       color roles, contrast, type, content/terminology, space/density, shape/surfaces, motion
    components-*.html        buttons, fields, status, state ladder, table, drawer, confirm dialog, signatures
    patterns-*.html          Tenant Console shell, Platform Console frame, edit form, scope transition, no-access
```

Each card starts with a `<!-- @dsCard group name subtitle viewport -->` marker on
line 1. Claude Design builds the Design System pane from those markers.

## Approved colour values

| Role | Token | Value | Jurisdiction |
|---|---|---|---|
| Canvas | `--color-background` | `#f7f9fa` | mineral layer 0 |
| Work surface | `--color-surface` | `#ffffff` | tables, panels |
| Recessed | `--color-surface-sunken` | `#eef2f6` | headers, scope bar, read-only |
| Ink | `--color-text` | `#0f1d2e` | all primary text |
| Secondary ink | `--color-text-muted` | `#53647a` | meta text **and control boundaries** |
| Divider | `--color-border` | `#d8dfe7` | decorative hairlines only (1.34:1) |
| Tower Teal | `--color-primary` | `#0f766e` | intent: primary action, selection, focus |
| Teal emphasis | `--color-primary-emphasis` | `#0b5b55` | hover / pressed / teal text |
| Teal wash | `--color-primary-soft` | `#e6f4f1` | selected row, current context |
| Info / pending | `--color-info` | `#1b6ca8` | |
| Proven success | `--color-success` | `#15774d` | only once the outcome is proven |
| Degraded | `--color-warning` | `#a35a00` | |
| Danger / UNKNOWN | `--color-danger` | `#b3261e` | never softened to neutral |

**Dark theme values** (owner-approved 2026-10-11, RT-392; applied by
`[data-theme="dark"]` on `<html>` or any container, light stays the default).
`.design-sync/build-bundle.mjs` checks 32 text and boundary pairings per theme
against WCAG AA and fails the build on a miss. The lowest text pairing is dark
muted text on the selected-row wash at 6.21:1 (light: warning on sunken, 4.64:1).

| Token | Light | Dark |
|---|---|---|
| `--color-background` | `#f7f9fa` | `#0e161f` |
| `--color-surface` | `#ffffff` | `#16212d` |
| `--color-surface-sunken` | `#eef2f6` | `#111a24` |
| `--color-text` | `#0f1d2e` | `#e7edf3` |
| `--color-text-muted` | `#53647a` | `#9fb0c2` |
| `--color-border` | `#d8dfe7` | `#2a3846` |
| `--color-primary` | `#0f766e` | `#3fb8a8` |
| `--color-primary-emphasis` | `#0b5b55` | `#6fd0c2` |
| `--color-primary-soft` | `#e6f4f1` | `#12322f` |
| `--color-success` | `#15774d` | `#5cc995` |
| `--color-warning` | `#a35a00` | `#e9a84a` |
| `--color-danger` | `#b3261e` | `#ff8b7f` |
| `--color-info` | `#1b6ca8` | `#6db3ea` |

In dark, `--color-on-primary` is the dark background (text on a teal or danger fill is
dark), and the scrim and overlay shadow are alphas of the dark background.

The derived roles are aliases or alpha values of the colours above:
- `--color-on-primary`
- `--color-control-border`
- `--color-focus-ring`
- `--color-scrim` (ink at 45%)
- `--shadow-overlay`

**Do not add a colour value without a new owner decision.** The contrast card shows
the computed ratio for each text and boundary pairing the cards use; compute any new
pairing before using it.

## Provisional (not yet ratified)

- **Type role sizes** shipped in Admin-Console with the Inter → Dubai slice (RT-397,
  #88). Two size questions from #88 are still open with the owner: the page title
  size and the size of English text set in Dubai. The 12px floor is fixed.
- **Dubai font** is embedded in the Claude Design project (owner, 2026-10-11): four
  weights from dubaifont.com under `fonts/`, wired by `tokens/fonts.css`. The TTFs
  are not committed here (© Dubai Executive Council, all rights reserved; this repo
  is public). The owner accepted the dubaifont.com terms of use on 2026-10-11 (RT-392).
  Opened straight from this folder, the cards use an installed Dubai or
  the `Segoe UI` / `Tahoma` fallbacks.
- **Arabic role labels:** Admin-Console uses «المالك» (`owner`), «مسؤول المؤسسة»
  (`tenant_admin`) and «مدير المتجر» (`store_manager`) since RT-399 (#92). They are not
  in the UX-12 glossary yet, so the shell cards still show the user's name, not a role
  label.
- **Platform Console** is a frame only. RT-391 (Platform Control Center, Planning,
  closed 2026-10-12) settled where it lives and how support access works. Its plan
  has text wireframes only, with no approved screen designs:
  - **D5:** a `/platform` area inside Admin-Console, on this same design system;
  - **D1:** platform support access is read-only by default; tenant writes need a
    separate break-glass flow (re-authentication, a reason, audit);
  - **D2:** support sessions need a purpose from a controlled set, take an optional
    ticket reference, expire after 60 minutes with explicit renewal, and show in the
    tenant owner's audit history.

  The navigation items stay illustrative until slice P1-a reviews a real Platform
  Console design.

## Deliberately excluded

- **Retired identity:** gold, navy as action or brand, Inter, the old navy/gold dark
  default. (The approved dark theme above is a new, opt-in alternate, not that.)
- **POS-only parts:** the POS dark rail and the POS dark theme.
- **Icons:** Fluent System Icons are pending the RT-263 fit/licensing PoC. The
  bundle ships no icon set.
- **Data charts and data-visualisation palettes:** UX-13 has no ratified palette,
  and status colours must never be reused as a chart palette. Count bands and status
  marks are allowed under rule 8.
- **Machine-readable sources of the old identity** (DESIGN.md and
  `src/styles/tokens.css` moved to the target with RT-396–RT-398):
  - `.impeccable/design.json`;
  - `PRODUCT.md` Principle 6;
  - `design_handoff_retail_tower_console/**`;
  - `docs/design/*/tokens.css`.

## Re-sync checklist

1. Edit `colors_and_type.css` (tokens), `components.css` (the class vocabulary that
   designs receive) or the cards. `preview/_card.css` is card chrome only: a class
   edited there never reaches a generated design. Keep every card
   `lang="ar" dir="rtl"`. Use logical CSS, Western digits, `1,250.00 EGP`, UX-12
   terms and fictitious data only.
2. Run a self-check before syncing:
   - no `http://` or `https://` references;
   - a marker with all four attributes on line 1 of every card;
   - every hex value is in the approved table;
   - no near-empty cards;
   - every variant is visibly distinct.
3. Run `/design-sync`. This repo syncs off-script: `node .design-sync/build-bundle.mjs` builds `./ds-bundle`,
   then `node .ds-sync/package-validate.mjs ./ds-bundle` must exit 0 (see `.design-sync/NOTES.md`). Upload steps:
   1. `list_projects`.
   2. `get_project` must report `PROJECT_TYPE_DESIGN_SYSTEM`.
   3. `finalize_plan` with `localDir` set to `./ds-bundle` at the repo root (built
      above), never this folder: only the build has `styles.css`, `tokens/` and the
      README with the conventions header. The owner reviews the path list here.
   4. `write_files`.
   5. `report_validate`.
4. Keep syncs incremental: no wholesale replace and no deletes unless the plan lists
   them. A push is visible to the whole org.
