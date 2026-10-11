# design-sync notes: Retail Tower Design System (RT-392)

## Why this sync is off-script

- **Owner decision, 2026-10-11:** sync the Constitution *target* identity as **tokens + CSS vocabulary + reference cards**, with **no React components** for now.
  - Admin-Console is a private app (`retail-tower-console`, no library entry).
  - Its shipped components still render the retired dark/navy/gold/Inter identity.
  - Converting them would teach the design agent the identity RT-392 replaces.
- Revisit when the light-first token migration lands in `src/`. Then the real components render the target and can go through the standard converter (package shape, `componentSrcMap` over `src/components`).
- **Builder:** `node .design-sync/build-bundle.mjs` writes `./ds-bundle` from `design/claude-design-system/`. It replaces `package-build.mjs`; do not run the converter.
  - It normalises line endings to LF on read. This machine has `core.autocrlf=true` and the repo has no `.gitattributes`, so a fresh checkout has CRLF files; the output is the same either way.
  - It fails if `conventions.md` names a token or class that `colors_and_type.css` / `components.css` do not define (the name check).
- **Gate:** `node .ds-sync/package-validate.mjs ./ds-bundle` must exit 0. `.ds-sync/` is gitignored; `/design-sync` stages it at the start of a run, so the gate exists only during a sync.
- **Upload root:** `DesignSync(finalize_plan)` with `localDir: "./ds-bundle"`, never `design/claude-design-system/`.

## Layout

| Path | Contents | Reaches designs? |
|---|---|---|
| `styles.css` | imports `tokens/colors_and_type.css` and `tokens/components.css` | yes (this closure only) |
| `preview/*.html` + `preview/_card.css` | 20 hand-authored cards; chrome imports `../styles.css` | no (cards only) |
| `components/` | empty, by design: the tokens-only contract | — |
| `_ds_bundle.js` | empty IIFE (`window.RetailTowerDS = {}`) with the `@ds-bundle` header | — |
| `README.md` | `.design-sync/conventions.md` (header) plus a generated card index | — |

- **Why a flat `preview/`:** it matches the owner's existing hand-authored "POS Pulse Design System" project, which the app registered.
- **Why not `components/`:** the validator counts cards there as components (`count mismatch`), and the agent would read them as React components.
- **CSS split:** `components.css` is the shipped vocabulary. `preview/_card.css` holds card chrome only (body padding, `.ds-*`, `.stage`, framed `.shell`).
  - Overlays (`.drawer`, `.dialog`, `.scrim`) are `position: fixed` in the vocabulary. Cards contain them with `.stage .x { position: absolute }`.
  - Never move chrome into `components.css`: every generated design would inherit it.

## Verification (the validator does not render `preview/`)

- `package-validate.mjs` walks only `components/` for cards, so it reports "0/0 previews".
- **Automated in the repo:** only the builder's own checks (line-1 markers, the chrome import, the name check).
- **Manual, not committed:** the render checks below were run by hand with scratch scripts on each sync. Redo them on every sync that changes CSS or cards.
  - Serve the bundle: `python -m http.server 8765 --bind 127.0.0.1` inside `ds-bundle/`.
  - **Playwright** with the repo's `@playwright/test`, against the served `ds-bundle`. Each card is checked for:
    - a line-1 `@dsCard` marker with all 4 attributes;
    - no 4xx responses;
    - tokens resolved;
    - card chrome applied;
    - no overflow beyond the marker viewport;
    - `CSS1Compat`.
  - **Design probe:** a page loading `styles.css` only and using the conventions snippet, with the scrim and drawer placed *before* a table. Checks:
    - body padding is 0 and classes are styled;
    - `document.elementFromPoint` at the sticky table header returns the overlay, not the `th` (stacking order).
  - **Visual grading:** sheets reviewed for Styled / Complete / Plausible.
- **2026-10-11 result:** 20/20 cards OK, all graded good, probe OK.
- **2026-10-11 follow-up (overlay z-index):** the probe returned `TH` before the fix and the overlay after it; 20/20 cards still OK.

## Decisions and known warnings

- **`[FONT_MISSING] "Dubai"`: accepted substitute.** Owner OK, 2026-10-11.
  - Dubai renders where it is installed (it ships with Windows). Elsewhere it falls back to Segoe UI / Tahoma / system-ui.
  - The licence check for embedding a Dubai woff2 is still open in RT-392. When cleared, add the woff2 + `@font-face` to the bundle (`fonts/` + an import in `styles.css`) and drop this note.
- **`_ds_sync.json absent`:** expected for this off-script layout. There is no anchor, so every sync re-verifies everything (20 cards, cheap).
- **`Cascadia Code`** was removed from `--font-mono` in the target tokens (2026-10-11). Consolas covers Windows; this cleared a second `[FONT_MISSING]`.

## Re-sync risks

- `README.md` is stitched at build time from `conventions.md`. Every class or token it names must exist in `components.css` or `colors_and_type.css`; the builder enforces this and fails on a miss.
  - It only reads table-row code spans, `.class` spans, `element.class` spans and `class="…"` attributes. A class mentioned in prose outside those forms is not checked.
- **Overlays** are `position: fixed` with `z-index` 100 (scrim) and 101 (drawer, dialog). A new positioned layer in `components.css` must stay below 100.
- **Card viewports** are hard-coded in each marker. A content change that grows a card needs its `viewport` height raised (the check reports `size=…/WxH`).
- **Colour values** are the RT-392 approved table only. Any new value needs a new owner decision.
- **Open owner decisions** that may change cards:
  - green dot for a steady healthy connection;
  - whether store time zone is editable after creation.
- The **Platform Console frame** is an RT-391 concept. Its navigation is illustrative; re-check it when RT-391 decides the IA.
