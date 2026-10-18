# RT-696 — Admin icon registry (RT-263 IC-3): before / after captures

Evidence for the owner's visual sign-off on the Fluent System Icons swap in the Admin Console.
The design source is POS `docs/design/vnext/25-rt263-icon-registry-fluent-poc.md` (§3 names,
§4 fit, §6 sizes, §8 IC-3 row). The rules now live in `DESIGN.md` §4.

**Before** is `main` at `dce8626`. **After** is this branch. Both are the production build
(`pnpm build && pnpm preview --port 4173`) with a mocked API, 1280×800, Chromium, captured by
[`capture.mjs`](capture.mjs):

```sh
node docs/design/rt263-icon-registry/capture.mjs <out-dir> <before|after>
```

"Forced" is `forced-colors: active` (Chromium's emulation, which renders the light
system palette).

## What to look at

| Scene | Path | Glyphs that change |
|---|---|---|
| `shell-nav` | `/stores` | every nav glyph (Overview → `dashboard`, Tenants → `tenant`, Stores → `store`, Operators → `people`, Audit → `audit`), the scope caret (`disclosure`), Sign out (`signOut`) |
| `scope-menu` | `/stores`, menu open | the active-scope `✓` → `confirm` |
| `back-link` | `/tenants/t1` | the back link `←` → `back` (mirrored in Arabic) |
| `drawer` | `/operators`, Invite open | the Drawer `✕` → `close` |
| `no-access` | `/`, no memberships | the NoAccess lock → `lock` (24 grid, centred in the same 40px slot) |

Points that need the owner's eye (doc 25 §4.3):

- **Weight.** Fluent Regular is lighter: a 1.0px line at 20px against today's 1.46px.
- **Size.** Nav glyphs move from 18px to the 20 grid; search, caret, check, close and back sit on
  the 16 grid; the NoAccess lock is 24px instead of 40px (the slot keeps its 40px box).
- **Sign out** now follows reading direction: the arrow leaves the door toward the inline end in
  English and mirrors in Arabic. Before, it never mirrored.
- **Audit** uses Fluent's separate RTL asset in Arabic (the list ticks move to the right).

## Pairs

| Scene | Locale | Colours | Before | After |
|---|---|---|---|---|
| shell-nav | en | light | [before](captures/shell-nav-en-light-before.png) | [after](captures/shell-nav-en-light-after.png) |
| shell-nav | en | forced | [before](captures/shell-nav-en-forced-before.png) | [after](captures/shell-nav-en-forced-after.png) |
| shell-nav | ar | light | [before](captures/shell-nav-ar-light-before.png) | [after](captures/shell-nav-ar-light-after.png) |
| shell-nav | ar | forced | [before](captures/shell-nav-ar-forced-before.png) | [after](captures/shell-nav-ar-forced-after.png) |
| scope-menu | en | light | [before](captures/scope-menu-en-light-before.png) | [after](captures/scope-menu-en-light-after.png) |
| scope-menu | en | forced | [before](captures/scope-menu-en-forced-before.png) | [after](captures/scope-menu-en-forced-after.png) |
| scope-menu | ar | light | [before](captures/scope-menu-ar-light-before.png) | [after](captures/scope-menu-ar-light-after.png) |
| scope-menu | ar | forced | [before](captures/scope-menu-ar-forced-before.png) | [after](captures/scope-menu-ar-forced-after.png) |
| back-link | en | light | [before](captures/back-link-en-light-before.png) | [after](captures/back-link-en-light-after.png) |
| back-link | en | forced | [before](captures/back-link-en-forced-before.png) | [after](captures/back-link-en-forced-after.png) |
| back-link | ar | light | [before](captures/back-link-ar-light-before.png) | [after](captures/back-link-ar-light-after.png) |
| back-link | ar | forced | [before](captures/back-link-ar-forced-before.png) | [after](captures/back-link-ar-forced-after.png) |
| drawer | en | light | [before](captures/drawer-en-light-before.png) | [after](captures/drawer-en-light-after.png) |
| drawer | en | forced | [before](captures/drawer-en-forced-before.png) | [after](captures/drawer-en-forced-after.png) |
| drawer | ar | light | [before](captures/drawer-ar-light-before.png) | [after](captures/drawer-ar-light-after.png) |
| drawer | ar | forced | [before](captures/drawer-ar-forced-before.png) | [after](captures/drawer-ar-forced-after.png) |
| no-access | en | light | [before](captures/no-access-en-light-before.png) | [after](captures/no-access-en-light-after.png) |
| no-access | en | forced | [before](captures/no-access-en-forced-before.png) | [after](captures/no-access-en-forced-after.png) |
| no-access | ar | light | [before](captures/no-access-ar-light-before.png) | [after](captures/no-access-ar-light-after.png) |
| no-access | ar | forced | [before](captures/no-access-ar-forced-before.png) | [after](captures/no-access-ar-forced-after.png) |

## Limits

- The gated nav entries (`product`, `unknownItem`) show only in dev builds, and the role-gated
  entries (`sale`, `inventory`, `cash`, `connection`, `terminal`) only for their roles, so they
  are not in these captures. Unit tests render every registry glyph at every declared grid.
- Fonts are whatever the capture machine has (Dubai is not installed here). The captures compare
  glyphs, not typography.
