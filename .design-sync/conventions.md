# Retail Tower Design System: conventions for generated screens

This is the target identity from the Retail Tower UX/UI Constitution: light-first Mineral Daylight + Tower Teal, Arabic-first, RTL by structure.

**This bundle has no React components.** `window.RetailTowerDS` is empty. Build screens from plain HTML/JSX elements styled with the token and class vocabulary below. Never invent class names or hex values.

## Setup

- Root: `<html lang="ar" dir="rtl">`. Load `styles.css`; it imports `tokens/colors_and_type.css` (tokens) and `tokens/components.css` (classes). No provider or wrapper is needed.
- The CSS uses logical properties only. Without `dir="rtl"`, the layout renders mirrored and wrong for Arabic.
- Font: `var(--font-sans)` (Dubai; installed on Windows, falls back elsewhere). Keep text at 12px or larger.

## Styling idiom: tokens + classes

- **Colours:** `--color-background`, `--color-surface`, `--color-surface-sunken`, `--color-text`, `--color-text-muted`, `--color-border` (dividers only), `--color-primary` / `-emphasis` / `-soft` (Tower Teal = intent), `--color-info`, `--color-success`, `--color-warning`, `--color-danger`.
- **Space:** `--space-1`…`--space-9` (4–96px).
- **Radius:** `--radius-control` (8), `--radius-object` (12), `--radius-overlay` (16), `--radius-pill`.
- **Type:** `--text-display`, `--text-screen-title`, `--text-section-title`, `--text-body`, `--text-control`, `--text-meta`, `--text-money-total`.
- **Motion:** `--duration-contact`, `--duration-signal`, `--duration-continuity`, `--ease-standard`.

| Need | Classes |
|---|---|
| Buttons | `btn` + `btn--primary` (one per region), `btn--secondary`, `btn--quiet`, `btn--danger`. `btn--danger-commit` is for confirm dialogs only. Busy: `aria-busy="true"` + `spinner`. Blocked: `aria-disabled="true"` + a visible reason. |
| Fields | `field` > `label.field__label` (+ `field__req`), then `input.input` or `select.select`, then `field__hint` / `field__error`, linked via `aria-describedby`. |
| Status | `badge` + `is-neutral` / `is-info` / `is-success` / `is-warning` / `is-danger`, with `dot` or `dot--hollow`. `dot--live` only during real activity. |
| States | `notice`; `banner` (`banner__title`, `banner__body`, `banner__evidence`, `banner__action`); `blocking`. |
| Tables | `table` (full-bleed, never inside a card), `col-num`, `tr.is-selected`, `table__continuation`, `table-meta`, `skeleton`. |
| Shell | `shell` > `shell__top` (`shell__product`), `shell__scope` (`scope-item`), `shell__nav` (`nav-item` + `signal` on `aria-current="page"`), `shell__main`. |
| Overlays | `scrim`, `drawer` (`drawer__head`, `drawer__body`, `drawer__foot`), `dialog` (`dialog__actions`), `menu` / `menu__item` (radio group). |
| Forms | `form`, `form__section`, `form__row`, `form__actions`, `form__dirty`, `error-summary`. |
| Data | `num` (money, quantities), `machine` (IDs, codes), `ledger` / `ledger__total`, `sr-only`. |

## Where the truth lives

`tokens/colors_and_type.css` and `tokens/components.css`. The reference cards are under `preview/`, for example `preview/patterns-shell-tenant.html` and `preview/foundations-content.html` (wording rules).

## Rules

- **Language:** Arabic only, one locale at a time.
- **Terms:**
  - «المؤسسة» = tenant
  - «المتجر» = store, never «الفرع»
  - «الصنف» = item
  - «المستخدم» = user
- **Buttons** name the action: «حفظ المتجر», not «موافق».
- **Money:** `1,250.00 EGP` inside `.num`, Western digits. Dates read «7 أكتوبر 2026، 13:42».
- **Status:**
  - Never colour alone.
  - An UNKNOWN outcome is danger.
  - A missing signal is «لا توجد إشارة» (hollow neutral).
  - Healthy stays quiet.
- **Messages:** what happened, what is safe, what to do, then the evidence (a `.machine` reference).
- **Not allowed:** charts or KPI tiles, icons, toasts, dark theme, gradients, new colours.
- **Consoles:** the Tenant and Platform consoles share every token and differ only in copy and scope bar.

```html
<div class="shell__main">
  <h2>المتاجر</h2>
  <div class="banner is-warning" role="status">
    <span class="banner__title">تعذّر تحديث فروق المخزون من ERPNext.</span>
    <span class="banner__body">آخر بيانات مؤكدة معروضة أدناه، ويمكنك متابعة العمل.</span>
    <button class="btn btn--secondary banner__action">تحديث البيانات</button>
  </div>
  <table class="table">
    <thead><tr><th>المتجر</th><th>الحالة</th><th class="col-num">قيمة المخزون</th></tr></thead>
    <tbody><tr><td>متجر الواحة</td><td><span class="badge is-neutral"><span class="dot"></span>نشط</span></td><td class="col-num"><span class="num">98,410.50 EGP</span></td></tr></tbody>
  </table>
</div>
```
