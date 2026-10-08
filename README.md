<div align="center">

<h1 align="center">
  <img src="docs/assets/readme/hero.svg" alt="Retail Tower OS, Admin-Console track: one product, four development tracks, with AI woven through all of them" width="100%"/>
</h1>

<p align="center">
  <a href="docs/product/retail-tower-console-charter.md"><img alt="Retail Tower OS" src="https://img.shields.io/badge/Retail%20Tower-OS-0f766e?labelColor=0a0f24&style=flat-square"></a>
  <a href="#-ai-is-native-to-the-architecture-and-the-design"><img alt="AI embedded by design" src="https://img.shields.io/badge/AI-embedded%20by%20design-a78bfa?labelColor=0a0f24&style=flat-square"></a>
  <a href=".specify/memory/constitution.md"><img alt="Platform: frontend-only" src="https://img.shields.io/badge/platform-frontend--only-14b8a6?labelColor=0a0f24&style=flat-square"></a>
  <a href="src/generated"><img alt="API: generated client only" src="https://img.shields.io/badge/API-generated%20client%20only-60a5fa?labelColor=0a0f24&style=flat-square"></a>
  <a href="specs/001-console-foundation/api-readiness.md"><img alt="Contracts: Backend-Core authority" src="https://img.shields.io/badge/contracts-Backend--Core%20authority-f87171?labelColor=0a0f24&style=flat-square"></a>
  <a href="LICENSE"><img alt="License: MIT" src="https://img.shields.io/badge/license-MIT-34d399?labelColor=0a0f24&style=flat-square"></a>
</p>

<p align="center">
  <a href="package.json"><img alt="Node.js 22+" src="https://img.shields.io/badge/node-%E2%89%A522-339933?logo=nodedotjs&logoColor=white&labelColor=0a0f24&style=flat-square"></a>
  <a href="package.json"><img alt="pnpm 9.15" src="https://img.shields.io/badge/pnpm-9.15-f69220?logo=pnpm&logoColor=white&labelColor=0a0f24&style=flat-square"></a>
  <a href="tsconfig.json"><img alt="TypeScript strict" src="https://img.shields.io/badge/TypeScript-strict-3178c6?logo=typescript&logoColor=white&labelColor=0a0f24&style=flat-square"></a>
  <a href="package.json"><img alt="React 19" src="https://img.shields.io/badge/React-19-61dafb?logo=react&logoColor=black&labelColor=0a0f24&style=flat-square"></a>
  <a href="vite.config.ts"><img alt="Vite 6" src="https://img.shields.io/badge/Vite-6-646cff?logo=vite&logoColor=white&labelColor=0a0f24&style=flat-square"></a>
</p>

<p align="center">
  <a href="#-one-project-four-tracks"><b>Tracks</b></a> &nbsp;·&nbsp;
  <a href="#-ai-is-native-to-the-architecture-and-the-design"><b>AI</b></a> &nbsp;·&nbsp;
  <a href="#current-implementation-status"><b>Status</b></a> &nbsp;·&nbsp;
  <a href="#-synchronization-with-retail-tower-os"><b>Contracts</b></a> &nbsp;·&nbsp;
  <a href="#getting-started"><b>Get started</b></a> &nbsp;·&nbsp;
  <a href="docs/README.md"><b>Docs</b></a>
</p>

</div>

> **Retail Tower OS** is the product; this repository, [`Kemetra/Admin-Console`](https://github.com/Kemetra/Admin-Console), is its admin/operator track, the browser frontend that keeps its own surface name, **Retail Tower Console**. It consumes Backend-Core OpenAPI contracts through a generated client and must not own backend business logic, database schema, SQL migrations, POS terminal code, worker jobs, secrets, or deployment infrastructure. It never calls ERPNext/Frappe directly.

> **Naming.** Backend-Core is [`Kemetra/Backend-Core`](https://github.com/Kemetra/Backend-Core). Older specs, code comments and config in this repo still say "Data-Pulse-2" / "DP2" (for example the `dp2_session` cookie and the `DATA_PULSE_2_PIN` constant); that is the same backend. Likewise POS-Pulse is [`Kemetra/POS`](https://github.com/Kemetra/POS) and the ERPNext adapter is [`Kemetra/ERPNext-Connector`](https://github.com/Kemetra/ERPNext-Connector).

---

## 🧩 One project, four tracks

<p align="center">
  <img src="docs/assets/readme/tracks.svg" alt="Data flow: POS and Admin-Console talk to Backend-Core, which feeds the ERPNext-Connector, the only path to ERPNext. An AI layer runs through all four tracks." width="100%"/>
</p>

| Track | Repository | Owns |
| --- | --- | --- |
| **Backend-Core** | [`Kemetra/Backend-Core`](https://github.com/Kemetra/Backend-Core) | APIs · data · workers · tenant/store context · sync operations |
| **POS** | [`Kemetra/POS`](https://github.com/Kemetra/POS) | Windows cashier terminal · offline state · receipts |
| **Admin-Console** ◀ you are here | [`Kemetra/Admin-Console`](https://github.com/Kemetra/Admin-Console) | Operator web UI · catalog · inventory views · sync ops |
| **ERPNext-Connector** | [`Kemetra/ERPNext-Connector`](https://github.com/Kemetra/ERPNext-Connector) | The only ERPNext/Frappe adapter · DocType mapping · posting |

<sub>One architecture, one set of contracts, one AI-embedded design. <a href="https://github.com/Kemetra/Orchestrator"><code>Kemetra/Orchestrator</code></a> is the technical handbook, not a track.</sub>

---

## 🧠 AI is native to the architecture and the design

<p align="center">
  <img src="docs/assets/readme/ai-embedded.svg" alt="AI-integrated: the AI sits outside the boundary and reaches the system through a side channel. AI-embedded: the AI runs through every layer inside the boundary, under the same rules." width="100%"/>
</p>

<table>
<tr>
<td width="25%" valign="top"><b>🔒 Same boundary</b><br/><sub>Same generated client over Backend-Core contracts and the same server-enforced role and scope checks as every operator. No side door, no direct database or ERPNext path.</sub></td>
<td width="25%" valign="top"><b>🧾 Auditable</b><br/><sub>Actions are audited in Backend-Core and keep their provenance, so AI-driven decisions can be traced and reviewed in the Console.</sub></td>
<td width="25%" valign="top"><b>🏢 Tenant-safe</b><br/><sub>Scope stays per tenant and store, enforced by the backend (<a href=".specify/memory/constitution.md">constitution</a>). Intelligence never crosses it.</sub></td>
<td width="25%" valign="top"><b>🧑‍⚖️ Human-governed</b><br/><sub>Operators keep authority. Suggestions are acted on only through the same authenticated operator actions.</sub></td>
</tr>
</table>

> AI-embedded describes the architectural and design direction. **No AI feature is implemented in this repository today**: there is no model, assistant, or AI-driven code under `src`. The only AI-related material is design intent, an "AI Studio" concept screen in the [vision set](docs/design/_vision/README.md) that is explicitly marked as having no slice yet. What is shipped is tracked in [Current implementation status](#current-implementation-status).

---

## 🔗 Synchronization with Retail Tower OS

The Console is a **contract-only** admin surface. It reads and writes operational data through
Backend-Core and never touches ERPNext/Frappe directly. Management screens read **down** from
Backend-Core; operator actions go **up** to Backend-Core, which orchestrates everything beyond it.

<p align="center">
  <img src="docs/assets/architecture/retail-tower-sync-flow.svg" alt="Animated Retail Tower OS synchronization diagram, console focus" width="100%"/>
</p>

```text
Admin-Console ──▶ Backend-Core ──▶ ERPNext-Connector ──▶ ERPNext / Frappe
POS ────────────▶ Backend-Core            ▲ only Backend-Core and the connector sit on this path
```

### Where the Console sits: full ecosystem view

The diagram below places all five Retail Tower OS repositories under a shared control-plane band.
The Console is the highlighted **admin edge node** (marked **★ THIS REPO**): a browser surface that
talks only to Backend-Core, never to ERPNext directly.

<p align="center">
  <img src="docs/assets/architecture/retail-tower-ecosystem.svg" alt="Animated five-repository Retail Tower OS ecosystem diagram with the Retail Tower Console node highlighted as the admin edge node" width="100%"/>
</p>

<p align="center"><sub>Live, animated 3D-styled SVG. Motion honors <code>prefers-reduced-motion</code> and degrades to a static rendering on GitHub. The diagram predates the Kemetra repository rename and may still show legacy repo names.</sub></p>

Full detail: [docs/architecture/sync-overview.md](docs/architecture/sync-overview.md) ·
Program technical handbook: [Orchestrator](https://github.com/Kemetra/Orchestrator).

---

## Live console control map

[![Retail Tower Console live control map preview](docs/assets/architecture/retail-tower-console-live-map-preview.svg)](docs/architecture/retail-tower-console-live-map.html)

Open the [interactive Three.js console map](docs/architecture/retail-tower-console-live-map.html) through a local static server or docs host. The map is backed by [topology JSON](docs/architecture/retail-tower-console-live-map.json), while the README stays GitHub-safe with a static SVG preview. It was authored at planning time, so treat it as a topology sketch rather than a record of what is implemented.

---

## Current implementation status

> **Source of truth.** GitHub `main` is the technical truth for what is implemented; active work and priorities are tracked in Jira (project **RT**). The `Status:` headers inside `specs/*/spec.md` and the "gated" labels in [`api-readiness.md`](specs/001-console-foundation/api-readiness.md) were written at spec time and often lag the code (for example, spec 017 still reads "Proposed / Draft" although its screens are on `main`). The table below is derived from what exists on `main`: routes, screens, generated-client operations, and tests.

The Vite/React SPA is past the scaffold. It ships sign-in and active-context handling, tenant/store management, operator/admin management, audit search, the unknown-items review queue, settlement screens (payer accounts, receivables, claims, remittance reconciliation, apply-payment), and an ERPNext negative-stock view that reads through Backend-Core.

| Surface | Route | State on `main` | Backend-Core contract (generated client) | Spec |
| --- | --- | --- | --- | --- |
| Sign-in, active tenant/store context, app shell (RF-1) | `/signin` · `/` | Implemented. Password sign-in only; Overview is a placeholder that shows the active tenant and store name | `auth` · `context` | [`003`](specs/003-rf1-auth-shell) |
| Tenant and store management (RF-2) | `/tenants` · `/stores` (+ `new`, `:id`, `:id/edit`) | Implemented: list, detail, create, edit, soft delete | `tenants` · `stores` | [`004`](specs/004-rf2-tenant-store-mgmt) |
| Operator/admin management (RF-5) | `/operators` · public `/accept-invitation` | Implemented: member list, invite, edit, revoke, accept invitation | `tenants` (members) · `memberships` | [`005`](specs/005-rf5-operator-admin) |
| Audit search (RF-6) | `/audit` | Implemented: cursor-paginated search and read-only inspect | `audit` | [`006`](specs/006-rf6-audit-search) |
| Unknown-items review queue (RF-4a) | `/unknown-items` | Implemented: list, inspect, dismiss. Link and create-product (RF-4b) are not built. The sidebar still shows this entry as gated, so the route is reachable by URL only | `catalog/unknown-items` | [`007`](specs/007-rf4a-unknown-items) |
| Payer accounts | `/payer-accounts` | Implemented: list and create. No sidebar entry yet | `settlement` | [`017`](specs/017-console-customer-and-payer-accounts) |
| Receivables, claims, remittance, apply-payment | `/receivables` | Implemented: list, submit claim, reconcile remittance, apply payment. No sidebar entry yet | `settlement` | [`018`](specs/018-console-receivables-and-insurance-claims) · [`019`](specs/019-console-settlement-reconciliation) |
| ERPNext stock discrepancies (RT-178) | `/stock-discrepancies` · `/stock-discrepancies/:storeId` | Implemented: negative on-hand per store and item, plus a "request fresh snapshot" action. Sidebar entry is shown only to the roles the API allows | `erpnext-reconciliation` | tracked in Jira RT |
| Catalog management (RF-3) | none | Not built; no sidebar route | none consumed | [`api-readiness.md`](specs/001-console-foundation/api-readiness.md) |
| Settings / connectors (RF-7) | none | Not built | none consumed | [`016`](specs/016-rf-connectors-settings) (vision stub) |
| Overview dashboard, data quality, inventory, sales, monitoring, alerts, reports | none | Not built; spec folders `009`–`015` are vision stubs only | none consumed | [`009`](specs/009-rf-overview-dashboard)–[`015`](specs/015-rf-reports-analytics) |
| Provider-based login | none | Not built; spec-only draft | none consumed | [`008`](specs/008-provider-auth-login) |
| Observability instrumentation (error tracking, session replay) | none | Not built; spec-only draft | none consumed | [`020`](specs/020-console-observability-instrumentation) |

Wiring and tooling, all verified in code:

| Area | State | Evidence |
| --- | --- | --- |
| Generated API client | Generated from nine Backend-Core OpenAPI sources at a pinned commit (`auth`, `context`, `tenants`, `stores`, `memberships`, `audit`, `catalog/unknown-items`, `settlement`, `erpnext-reconciliation`); regeneration needs a local Backend-Core checkout | [`openapi-ts.config.ts`](openapi-ts.config.ts) · [`src/generated/schema.d.ts`](src/generated/schema.d.ts) |
| Hand-written API calls | Only through the generated client wrappers; a boundary test enforces this | [`src/lib`](src/lib) · [`tests/unit/boundary.test.ts`](tests/unit/boundary.test.ts) |
| Tests | 53 Vitest unit test files and 18 Playwright e2e spec files under `tests/` | [`tests/unit`](tests/unit) · [`tests/e2e`](tests/e2e) |
| CI | One workflow on pull requests and pushes to `main`: `pnpm install --frozen-lockfile`, `build`, `lint`, unit tests, then e2e, on Node 22 | [`.github/workflows/ci.yml`](.github/workflows/ci.yml) |
| Backend contracts | Owned upstream by Backend-Core | [`specs/001-console-foundation/contracts`](specs/001-console-foundation/contracts) |
| POS terminal behavior | Owned by `Kemetra/POS` | [Constitution](.specify/memory/constitution.md) |

Not verified by this README: that the unit and e2e suites currently pass, and the live behavior of any screen against a running Backend-Core. Re-verify against `main` and CI before relying on this table.

---

## What you can verify today

| Claim | Repo-backed evidence |
| --- | --- |
| The console is frontend-only | [Constitution principle 1](.specify/memory/constitution.md) · [boundary test](tests/unit/boundary.test.ts) |
| Backend-Core owns backend contracts | [Constitution principle 2](.specify/memory/constitution.md) · [contract boundary docs](specs/001-console-foundation/contracts) |
| The browser reaches the backend only through the generated client | [Constitution principle 8](.specify/memory/constitution.md) · [`src/generated`](src/generated) |
| POS terminal behavior is owned elsewhere | [Constitution principle 3](.specify/memory/constitution.md) |
| Work is issue-governed; `main` is the technical truth | [Operating instructions](CLAUDE.md) · [Constitution](.specify/memory/constitution.md) (the Maestro slice-dispatch workflow in `docs/agent-os` is historical) |
| Package, lockfile, dependency, and CI changes remain approval-gated | [Constitution principle 9](.specify/memory/constitution.md) |
| No secrets or deployment assumptions belong here | [Constitution principle 10](.specify/memory/constitution.md) |

---

## Console surface

Route families keep the original RF numbering from the [foundation plan](specs/001-console-foundation/plan.md). Settlement and stock-discrepancy surfaces were added later and carry no RF number.

| | Family | Scope | Posture on `main` |
| :--: | --- | --- | --- |
| <img src="docs/assets/icons/rf1-auth.svg" width="34" alt=""/> | RF-1 | Auth shell and active context | ✅ Implemented: sign-in, scope gate, app shell |
| <img src="docs/assets/icons/rf2-tenant-store.svg" width="34" alt=""/> | RF-2 | Tenant and store management | ✅ Implemented: list, detail, create, edit, soft delete |
| <img src="docs/assets/icons/rf3-catalog.svg" width="34" alt=""/> | RF-3 | Catalog management | Not built |
| <img src="docs/assets/icons/rf4-unknown-items.svg" width="34" alt=""/> | RF-4a | Unknown items review UI | ✅ Implemented: list, inspect, dismiss (RF-4b link/create not built) |
| <img src="docs/assets/icons/rf5-operators.svg" width="34" alt=""/> | RF-5 | Operator/admin management | ✅ Implemented: member list, invite, edit, revoke, public accept |
| <img src="docs/assets/icons/rf6-audit-search.svg" width="34" alt=""/> | RF-6 | Audit and operational search | ✅ Implemented: cursor-paginated search and read-only inspect |
| <img src="docs/assets/icons/rf7-settings.svg" width="34" alt=""/> | RF-7 | Settings/system management | Not built |
| | none | Settlement: payer accounts, receivables, claims, remittance, apply-payment | ✅ Implemented (routes `/payer-accounts`, `/receivables`) |
| | none | ERPNext stock discrepancies (read via Backend-Core) | ✅ Implemented (route `/stock-discrepancies`) |

---

## Repository map

| Path | Purpose |
| --- | --- |
| `src` | React SPA: `auth`, `context`, `shell`, `tenants`, `stores`, `operators`, `audit`, `unknown-items`, `payers`, `receivables`, `settlement-reconciliation`, `stock-discrepancies`, shared `components`, `lib` (generated-client wrappers) and `generated` (client types) |
| `tests` | Vitest unit tests (`tests/unit`) and Playwright e2e specs (`tests/e2e`) |
| `specs` | Spec Kit artifacts, `001`–`020`: foundation and scaffold (`001`–`002`), RF-1/2/5/6 slices (`003`–`006`), RF-4a (`007`), provider login draft (`008`), vision stubs (`009`–`016`), settlement children (`017`–`019`), observability draft (`020`). Design records, not the authority for current behavior; see [Current implementation status](#current-implementation-status) |
| `.specify/memory/constitution.md` | Binding project boundary and implementation rules |
| `docs/product` | Product charter and cross-repo boundaries |
| `docs/design` · `DESIGN.md` · `PRODUCT.md` · `design_handoff_retail_tower_console` | Design system, vision screens and handoff reference |
| `docs/agent-os` | Historical Agent OS material (Maestro playbook, slice schema, older standing rules written in planning-first mode). Current work rules are in [`CLAUDE.md`](CLAUDE.md) |
| `docs/architecture` | Sync overview, live control map and topology data |
| `docs/assets` | Brand, architecture previews and route-family icons used in this README |
| `.github/workflows` | CI workflow |

### What this repo owns

Admin web frontend: browser UX, routes, layout, navigation, frontend state, components, generated API client consumption, and Console product positioning. In operational terms: tenant/store operational UI, catalog UI, inventory views, sales search, synchronization operations, and support/admin surfaces, as the work items for them open.

### What this repo does not own

Backend APIs and business logic, OpenAPI source contracts, database schema, SQL migrations, POS terminal code, worker jobs, any ERPNext/Frappe call or mapping, secrets, or deployment infrastructure. Package, lockfile, dependency, and CI changes are made only inside explicitly approved work items.

---

## Getting started

This repo uses **pnpm** (`pnpm@9.15.0`, Node `>=22`). Common checks:

```bash
pnpm install         # install dependencies
pnpm dev             # run the Vite dev server
pnpm build           # type-check (tsc --noEmit) + production build
pnpm lint            # Biome check
pnpm test            # Vitest run with coverage
pnpm test:e2e        # Playwright end-to-end tests
pnpm generate:client # regenerate the typed client from pinned contracts (needs a Backend-Core checkout)
```

`pnpm generate:client` reads the OpenAPI sources from a local Backend-Core git checkout at the commit pinned in [`openapi-ts.config.ts`](openapi-ts.config.ts). It looks in `../Data-Pulse-2` by default (the legacy directory name); set `DATA_PULSE_2_REPO` to point at your checkout. The generated output is committed, so day-to-day development does not need this step.

Then review:

| Need | Read |
| --- | --- |
| Product scope | [`docs/product`](docs/product) |
| Governance | [Operating instructions](CLAUDE.md) · [Constitution](.specify/memory/constitution.md) |
| Foundation plan | [`specs/001-console-foundation/plan.md`](specs/001-console-foundation/plan.md) |
| API dependency posture (historical, spec-time) | [`specs/001-console-foundation/api-readiness.md`](specs/001-console-foundation/api-readiness.md) |
| Design system | [`DESIGN.md`](DESIGN.md) · [`PRODUCT.md`](PRODUCT.md) |
| Implemented slices | [`003`](specs/003-rf1-auth-shell) · [`004`](specs/004-rf2-tenant-store-mgmt) · [`005`](specs/005-rf5-operator-admin) · [`006`](specs/006-rf6-audit-search) · [`007`](specs/007-rf4a-unknown-items) · [`017`](specs/017-console-customer-and-payer-accounts) · [`018`](specs/018-console-receivables-and-insurance-claims) · [`019`](specs/019-console-settlement-reconciliation) |

---

## Development agreement

The unit of work is a Jira issue (project RT); start from `origin/main`, keep changes to the issue's scope, and do not change dependency manifests, lockfiles, generated code, or CI workflows without explicit approval. GitHub `main` is the technical source of truth. See [`CLAUDE.md`](CLAUDE.md) and the [Constitution](.specify/memory/constitution.md).

---

## License

MIT. See [LICENSE](LICENSE).
