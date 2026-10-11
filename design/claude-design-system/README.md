# Retail Tower Design System — Claude Design bundle

Source bundle for the **Retail Tower Design System** project in Claude Design
(claude.ai), published with `/design-sync`. Work item: **RT-392**.

> **Target, not shipped.** This bundle expresses the approved Retail Tower UX/UI
> Constitution (UX-01…UX-13): light-first Mineral Daylight + Tower Teal, Arabic-first,
> RTL by structure. It is **not** what Admin-Console renders today. The production
> console still ships the retired dark / navy / Tower Gold / Inter identity in
> `src/styles/tokens.css` until bounded migration slices change it (DESIGN.md §10).
> Nothing in this folder is imported by the app.

## Rules for generating new screens

Read these before designing any Retail Tower Admin screen from this system.

1. **Arabic first, RTL by structure.**
   - Every screen is `lang="ar" dir="rtl"`, using logical CSS only.
   - Show one locale at a time; never "عربي (English)".
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
4. **Tables are work surfaces.**
   - Full-bleed semantic tables, never inside rounded cards.
   - Tabular, LTR-isolated numbers.
   - Selection is separate from opening a row.
   - Detail opens in a drawer at inline-end.
5. **One primary action per region.**
   - Buttons name the action («حفظ المتجر»).
   - Destructive actions are never the default and sit in a separate zone.
   - Confirmation dialogs state scope and consequence, with the safe option focused first.
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
   - No charts, KPI tiles or data palettes (UX-13). An overview shows attention items and next destinations, not a KPI wall.
   - No dark theme.

## Authority

1. **The Constitution in Confluence (RETAIL)**: UX-01…UX-13 plus the Final Audit &
   Gap Map. The most specific module owns its area (UX-02 colour, UX-03 type, UX-04
   layout, UX-09 navigation, UX-10 tables, UX-11 accessibility/RTL, UX-12 copy, UX-13
   data visualisation).
2. **Owner decision, RT-392 (2026-10-11).** The colour values come from the POS
   `main@543688f` light token set. They are the starting values for the shared
   Mineral Daylight + Tower Teal system.
3. **[`DESIGN.md`](../../DESIGN.md)** explains how the Constitution applies to this repo.

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

- **Type role sizes** equal the current shipped Admin scale until the Inter → Dubai
  slice ratifies them. The 12px floor is fixed.
- **Dubai font** is referenced as an installed font (Windows ships it). Embedding it
  in Claude Design depends on the RT-392 licence check. Until that is done,
  non-Windows viewers see `Segoe UI` / `Tahoma` / system fallbacks.
- **Arabic role labels** for `owner` / `tenant_admin` / `store_manager` are not in
  the UX-12 glossary yet. The shells therefore show the user's name, not a role
  label.
- **Platform Console** is a frame only. Its navigation items are illustrative until
  RT-391 (Platform Control Center, Planning) decides the information architecture
  and the platform-admin session model.

## Deliberately excluded

- **Retired identity:** gold, navy as action or brand, Inter, the dark theme,
  English UI copy.
- **POS-only parts:** the POS dark rail and the POS dark theme.
- **Icons:** Fluent System Icons are pending the RT-263 fit/licensing PoC. The
  bundle ships no icon set.
- **Charts, KPIs and data-visualisation palettes:** UX-13 has no ratified palette,
  and status colours must never be reused as a chart palette.
- **Machine-readable sources of the old identity:**
  - DESIGN.md frontmatter;
  - `.impeccable/design.json`;
  - `PRODUCT.md` Principle 6;
  - `design_handoff_retail_tower_console/**`;
  - `docs/design/*/tokens.css`;
  - `src/styles/tokens.css`.

## Re-sync checklist

1. Edit `colors_and_type.css`, `preview/_card.css` or the cards. Keep every card
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
   3. `finalize_plan` with `localDir` set to this folder. The owner reviews the path
      list here.
   4. `write_files`.
   5. `report_validate`.
4. Keep syncs incremental: no wholesale replace and no deletes unless the plan lists
   them. A push is visible to the whole org.
