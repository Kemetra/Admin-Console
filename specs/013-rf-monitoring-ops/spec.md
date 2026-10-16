# Draft 013 — RF Monitoring / Pipeline Ops

**Current status (2026-10-16, RT-558):** Covered by RT-391 (Platform Control Center); tenant-scoped ERP posting/reconciliation status is spec 016 (RT-557).

> **VISION STUB — NOT YET SPECIFIED.** Seeded from a design vision mockup. No goals, contracts, data model, or tasks defined yet. Run `/speckit-specify` when ready to build.

**Status:** VISION-STUB / DRAFT. **Date:** 2026-06-13. **Owning repo:** Retail-Tower-Console.

## Vision reference

- No dedicated screen in the chosen design direction — pipeline-ops signals were folded
  into the Executive Overview ([`docs/design/_vision/vision-1/01-overview.png`](../../docs/design/_vision/vision-1/01-overview.png), "Integration Health" / "System Status") and Reconciliation surfaces.

> The console converged on a single design direction; this slice no longer has a
> standalone mockup. See [`docs/design/_vision/README.md`](../../docs/design/_vision/README.md). Revisit whether it warrants its own screen during `/speckit-specify`.

## Intent (one paragraph)

A pipeline-operations / monitoring screen showing the health and throughput of the
ingest pipeline: run status, success/failure rates, processing latency and volume
trends, a per-run/event log table, and a detail panel for inspecting a single run.
It is the operator's window into "is the pipeline healthy and keeping up."

## NOT YET SPECIFIED

Goals, non-goals, actors, acceptance criteria, data model, contracts, and tasks are
all undefined. This stub reserves the slice number and records the design intent only.
