# Draft 010 — RF Data Quality

**Current status (2026-10-16, RT-558):** Covered by RT-391 (Platform Control Center).

> **VISION STUB — NOT YET SPECIFIED.** Seeded from a design vision mockup. No goals, contracts, data model, or tasks defined yet. Run `/speckit-specify` when ready to build.

**Status:** VISION-STUB / DRAFT. **Date:** 2026-06-13. **Owning repo:** Retail-Tower-Console.

## Vision reference

- No dedicated screen in the chosen design direction — data-quality signals were folded
  into the Executive Overview ([`docs/design/_vision/vision-1/01-overview.png`](../../docs/design/_vision/vision-1/01-overview.png)) and Reconciliation surfaces.

> The console converged on a single design direction; this slice no longer has a
> standalone mockup. See [`docs/design/_vision/README.md`](../../docs/design/_vision/README.md). Revisit whether it warrants its own screen during `/speckit-specify`.

## Intent (one paragraph)

A data-quality dashboard surfacing the health of ingested data: completeness/validity
score, record counts, anomaly and rejection indicators, per-source quality breakdowns,
and trend over time. It lets an operator see at a glance whether the data feeding the
console can be trusted, and where the gaps are.

## NOT YET SPECIFIED

Goals, non-goals, actors, acceptance criteria, data model, contracts, and tasks are
all undefined. This stub reserves the slice number and records the design intent only.
