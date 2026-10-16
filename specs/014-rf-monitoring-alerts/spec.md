# Draft 014 — RF Monitoring & Alerts

**Current status (2026-10-16, RT-558):** Covered by RT-391 (Platform Control Center).

> **VISION STUB — NOT YET SPECIFIED.** Seeded from a design vision mockup. No goals, contracts, data model, or tasks defined yet. Run `/speckit-specify` when ready to build.

**Status:** VISION-STUB / DRAFT. **Date:** 2026-06-13. **Owning repo:** Retail-Tower-Console.

## Vision reference

- No dedicated screen in the chosen design direction — alert signals surface via the
  Executive Overview ([`docs/design/_vision/vision-1/01-overview.png`](../../docs/design/_vision/vision-1/01-overview.png), "Operational Exceptions" / "Recent Activity") and the Audit Logs surface.

> The console converged on a single design direction; this slice no longer has a
> standalone mockup. See [`docs/design/_vision/README.md`](../../docs/design/_vision/README.md). Revisit whether it warrants its own screen during `/speckit-specify`.

## Intent (one paragraph)

An alerts/notifications surface: active alerts and their severity, alert volume and
trend, an alert feed/table, and a detail panel for triaging an individual alert. It
complements the pipeline-ops view by focusing on what needs human attention now,
rather than overall throughput health.

> Note: distinct from 013 (pipeline ops) — this slice is alert-centric. Confirm the
> boundary between the two during `/speckit-specify`; they may merge.

## NOT YET SPECIFIED

Goals, non-goals, actors, acceptance criteria, data model, contracts, and tasks are
all undefined. This stub reserves the slice number and records the design intent only.
