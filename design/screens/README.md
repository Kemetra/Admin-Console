# Retail Tower Admin Console: reviewed screen designs

Static PNG exports of the screen designs made in the **Retail Tower Design System** project in Claude Design (claude.ai/design). They are a design record, not production UI, and nothing in `src/` imports them. Every name, ID, time, count and amount in them is mock data.

## Provenance

- **Source:** Claude Design project `53e2ffd3-a314-4094-899d-aff63deca985`, folder `export/screens/`. Each image was read back with DesignSync and checked before it was committed: PNG signature, closing `IEND` chunk, and a full decode at its stated size. None is truncated.
- **Exported:** 12 October 2026, at 1440px wide. Claude Design split long screens top to bottom into parts (`-a`, `-b`, …) so each file stays under 180 KB; read the parts in order.
- **Design system:** the screens use the bundle in [`../claude-design-system/`](../claude-design-system/) as synced after #94.
- **Decisions applied:** RT-391 D1–D5; RT-414 decisions 1–4 as merged in Backend-Core #741 (purpose enum, renewal cap of 8 hours, owner and tenant-admin audit visibility, `ticket_ref` pattern); and the owner decisions of 12 October 2026. D-AUD-07 (charts), D-AUD-08 (status words) and DS-R17 (design-only actions) are recorded in the [design-system README](../claude-design-system/README.md). The one-action break-glass scope and the suspended-tenant rule are on RT-414 (comment 11711), where the suspended-tenant rule awaits contract confirmation. D-AUD-01 (only the platform team resolves an unknown outcome) and D-AUD-02 (the owner workspace is a role-gated group inside the Platform Console) are recorded in the audit trail: `templates/design-audit/DESIGN-AUDIT.md` and `FOLLOW-UPS.md` in the Claude Design project.
- **Status:** reviewed with the owner in Claude Design. These images are not an implementation sign-off: backend contracts that the screens depend on are listed in `FOLLOW-UPS.md`, and controls without a service are shown `aria-disabled` with a «تصميم فقط» reason.

## Known gaps

- **Not shown:** mobile (390px) and laptop (1280px) frames, dark theme beyond the Stores family, and English beyond the Stores family. The templates support them.
- **Re-authentication method for break-glass** (FOLLOW-UPS #11) and `perm_owner_console` (#30) are still open; the screens say «لم تُحدَّد بعد» where they apply.

## Index

| Files | Screen and states | Claude Design template |
|---|---|---|
| `01-stores-ar-ready.png`<br>`02-stores-ar-loading.png`<br>`03-stores-ar-empty.png`<br>`04-stores-ar-error.png`<br>`05-stores-ar-details.png` | Stores directory, Arabic: ready, loading, empty, error, store details | `templates/stores/Stores.dc.html` |
| `06-stores-dark-ready.png`<br>`07-stores-dark-loading.png`<br>`08-stores-dark-empty.png`<br>`09-stores-dark-error.png`<br>`10-stores-dark-details.png` | Stores directory, dark theme: same five states | `templates/stores-dark/StoresDark.dc.html` |
| `11-stores-en-ready.png`<br>`12-stores-en-loading.png`<br>`13-stores-en-empty.png`<br>`14-stores-en-error.png`<br>`15-stores-en-details.png` | Stores directory, English: same five states | `templates/stores-en/StoresEnglish.dc.html` |
| `16-store-create.png` | Store create | `templates/store-create/StoreCreate.dc.html` |
| `17-store-edit.png` | Store edit | `templates/store-edit/StoreEdit.dc.html` |
| `18-no-access.png` | No access | `templates/no-access/NoAccess.dc.html` |
| `19-store-details-denied.png` | Store details, access denied | `templates/store-details-denied/StoreDetailsDenied.dc.html` |
| `20-support-session-start-a.png`<br>`20-support-session-start-b.png`<br>`21-support-session-active-a.png`<br>`21-support-session-active-b.png`<br>`22-support-session-expiring-a.png`<br>`22-support-session-expiring-b.png`<br>`23-support-session-renewed-a.png`<br>`23-support-session-renewed-b.png`<br>`24-support-session-expired-a.png`<br>`24-support-session-expired-b.png`<br>`25-tenant-not-available-a.png`<br>`25-tenant-not-available-b.png` | Support session (RT-391 D1/D2, RT-414): start, active, expiring, renewed, expired, tenant not available | `templates/platform-dashboard/PlatformDashboard.dc.html` |
| `26-break-glass-active-a.png`<br>`26-break-glass-active-b.png`<br>`27-break-glass-reauth-a.png`<br>`27-break-glass-reauth-b.png`<br>`28-break-glass-reason-a.png`<br>`28-break-glass-reason-b.png`<br>`29-break-glass-confirm-a.png`<br>`29-break-glass-confirm-b.png` | Break-glass, one action: active, re-authentication, reason, confirm (design only) | `templates/platform-dashboard/PlatformDashboard.dc.html` |
| `30-support-platform-search.png`<br>`31-support-session-search.png`<br>`32-support-sale-rejected-a.png`<br>`32-support-sale-rejected-b.png`<br>`33-support-sale-unknown-a.png`<br>`33-support-sale-unknown-b.png`<br>`34-support-sale-queued-a.png`<br>`34-support-sale-queued-b.png`<br>`35-support-device-offline-outbox-a.png`<br>`35-support-device-offline-outbox-b.png`<br>`36-support-not-found.png` | Support search: platform directory, session search, sale rejected, sale outcome unknown, sale queued, device offline with outbox, not found | `templates/support-search/SupportSearch.dc.html` |
| `37-attention-default-a.png`<br>`37-attention-default-b.png`<br>`37-attention-default-c.png`<br>`38-attention-empty.png`<br>`39-attention-source-disconnected-a.png`<br>`39-attention-source-disconnected-b.png`<br>`39-attention-source-disconnected-c.png`<br>`39-attention-source-disconnected-d.png`<br>`39-attention-source-disconnected-e.png` | Needs attention: default, empty, source disconnected | `templates/needs-attention/NeedsAttention.dc.html` |
| `40-platform-dashboard-default-a.png`<br>`40-platform-dashboard-default-b.png` | Platform dashboard, default | `templates/platform-dashboard/PlatformDashboard.dc.html` |
| `41-occ-overview-a.png`<br>`41-occ-overview-b.png`<br>`42-occ-incident-a.png`<br>`42-occ-incident-b.png`<br>`43-occ-observability-a.png`<br>`43-occ-observability-b.png` | Owner command center: overview, incident investigation, observability | `templates/owner-command-center/OwnerCommandCenter.dc.html` |
| `44-tenant-dashboard-default-a.png`<br>`44-tenant-dashboard-default-b.png` | Tenant dashboard, default | `templates/tenant-dashboard/TenantDashboard.dc.html` |
| `45-app-shell-owner.png` | App shell, owner role | `templates/app-shell/AppShell.dc.html` |
| `46-support-session-cap-reached-a.png`<br>`46-support-session-cap-reached-b.png` | Support session at the 8-hour renewal cap (RT-414 decision 2) | `templates/platform-dashboard/PlatformDashboard.dc.html` |

72 files, 7.6 MB in total; the largest is under 180 KB.
