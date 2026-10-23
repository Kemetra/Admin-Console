# RT-781 AC 5 evidence — support session open / renew / expire on the RT-414 runtime (rt9 lab, 2026-10-23)

Evidence-only branch, never merged. Console build `567f102` served same-origin through a local proxy; Backend-Core lab image `rt9-api:79537b34` (contains RT-414 `0283ab3f`; contract identical to PIN `24196757`).

- `781-01-open-bar.jpg` — open (expires 12:44:53Z)
- `781-02-renewed-bar.jpg` — renewed via the bar (expires 12:45:37Z)
- `781-03-expired-bar.jpg`, `781-04-expired-tenant.jpg` — expired bar and calm body (12:46:45Z)
- `data/` — DB/audit reads before, after renew, after expiry, and the reverts
- `tools/` — the lab proxies (https; http with the documented Origin rewrite) and the owner-run password script

Lab-only setup and reverts are described in the RT-781 Jira comment of 2026-10-23.
