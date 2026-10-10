# Retail Tower Console documentation

Documentation index for Retail Tower Console, the scaffolded browser admin frontend
for Retail Tower OS. The [root README](../README.md) is the canonical entry
point; this page is the deep-dive map.

## Start here

| Audience | First reads |
| --- | --- |
| Product & operations | [Root README](../README.md) · [Console charter](product/retail-tower-console-charter.md) · [Repo boundaries](product/repo-boundaries.md) |
| Engineering | [Foundation plan](../specs/001-console-foundation/plan.md) · [API readiness](../specs/001-console-foundation/api-readiness.md) · [Tooling/scaffold slice](../specs/002-tooling-and-scaffold) |
| Governance | [Constitution](../.specify/memory/constitution.md) · [Maestro playbook](agent-os/maestro-playbook.md) |

## Documentation map

| Document | Purpose |
| --- | --- |
| [Live control map](architecture/retail-tower-console-live-map.html) | Interactive Three.js planning topology backed by local JSON. |
| [Topology JSON](architecture/retail-tower-console-live-map.json) | Reviewable node and edge source for the live map. |
| [Console charter](product/retail-tower-console-charter.md) | Product purpose, ownership boundary, and initial console posture. |
| [Repo boundaries](product/repo-boundaries.md) | Cross-repo ownership lines between console, backend, and POS terminal. |
| [Release artifact](release/admin-console-artifact.md) | Pinned static bundle, `version.json` and checksum contract consumed by the same-origin host (RT-337). |
| [Arabic-first / RTL migration plan](design/arabic-first-rtl-migration-plan.md) | RT-266 planning: RTL/locale inventory, message catalog, formatters, UX-12 terms, bounded slice plan. Not implementation. |
| [Foundation plan](../specs/001-console-foundation/plan.md) | Route-family sequencing, gates, constraints, and implementation posture. |

## Documentation rules

- Keep wording truthful to the current planning-first, scaffold-merged state.
- Do not imply product UI, deployment files, or future dependency changes exist
  before their approved slices.
- When referencing the slice 002 generated client, cite the Data-Pulse-2 pin
  and preserve the generated-client-only boundary.
- Treat Data-Pulse-2 as the backend and OpenAPI authority.
- Treat POS-Pulse as the terminal runtime authority.
