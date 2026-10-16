# Roadmap: Console Mirror — Retail Tower Console

> **HISTORICAL — superseded (RT-558, 2026-10-16).** §1–§5 below describe the console as it stood at the 002 scaffold (mid-2026) and are kept for reference only. They are **not** current status and do **not** gate work.
>
> - **Work authority:** Jira project **RT** (Retail Tower). Each Jira issue carries its own scope, Work Mode and acceptance criteria.
> - **Current state, roadmap and decisions:** Confluence space **RETAIL**.
> - **Naming:** `Data-Pulse-2` is now **`Kemetra/Backend-Core`**; `Retail-Tower-Console` is now **`Kemetra/Admin-Console`**. Contracts still come from Backend-Core OpenAPI, consumed through `src/generated/`.
> - The "NOT green-lit" note in §1 and the operating rule in §5 no longer apply. RF product UI has shipped through approved spec slices and Jira work (see the table below).

## Current state on `main` (verified at `d6e666d`)

Taken from `src/App.tsx`, `src/shell/*Routes.tsx` and `src/shell/AppShell.tsx`. This is a point-in-time snapshot; GitHub `main` is the source of truth.

| Surface | Route(s) | Nav entry | Notes |
| --- | --- | --- | --- |
| RF-1 Auth / session / context | `/signin`, `/accept-invitation` (public); protected shell for all routes below | — | Shell has locale and theme switches. |
| Overview | `/` | Yes | Placeholder: title and active scope only. The dashboard is RT-555 (spec 009). |
| RF-2 Tenants | `/tenants`, `/tenants/new`, `/tenants/:tenantId`, `/tenants/:tenantId/edit` | Yes | |
| RF-2 Stores | `/stores`, `/stores/new`, `/stores/:storeId`, `/stores/:storeId/edit` | Yes | Store time zone shown (RT-477). |
| RF-5 Operators | `/operators` | Yes | |
| RF-6 Audit | `/audit` | Yes | |
| Stock discrepancies | `/stock-discrepancies`, `/stock-discrepancies/:storeId` | Role-gated | RT-178. |
| Shift closes | `/shift-closes`, `/shift-closes/:shiftId` | Role-gated | RT-18 variance review. |
| RF-4a Unknown items | `/unknown-items` | No | URL-reachable. Shown only as a disabled "RF-4" placeholder in dev builds. |
| 017 Payer accounts | `/payer-accounts` | No | URL-reachable. |
| 018 Receivables | `/receivables` | No | URL-reachable; apply-payment (019) is in-surface, no own route. |
| RF-3 Catalog | — | Dev-only placeholder | Not built. |
| RF-7 Settings / connectors | — | No | Not built; connectors are RT-557 (spec 016). |

---

> *The original document follows unchanged except for the §1, §3 and §5 headings, which are marked historical.*

> **Planning / roadmap document (historical).** This was a sequencing artifact at scaffold time, not an approval to implement RF product UI.

The admin console (`Retail-Tower-Console`) is the UI for **Retail Tower OS**. It owns **no** business logic. Under Constitution Principle IV (contract-first), every console screen is a **shadow** of a backend OpenAPI contract: a screen can only be built once the matching `[GATED]` contract is merged in the backend (`Data-Pulse-2`). This roadmap therefore mirrors the backend spec sequence one-to-one.

> **Console constitution rule:** this document references backend contracts **by path / operationId only**. It does **not** copy OpenAPI field shapes — the contract in `Data-Pulse-2/packages/contracts/openapi/` is the single source of truth.

---

## 1. (Historical) Accuracy note at scaffold time — RF product UI was not yet green-lit

The 002 console scaffold (`002-tooling-and-scaffold`, stack: React 19 · Vite 6 · TypeScript · Vitest · Playwright · Biome · GitHub Actions · pnpm) is now merged on `origin/main` in `7ac4dfb` (PR #11). It authorizes only the frontend tooling scaffold, placeholder shell, smoke tests, CI workflow, and generated-client storage location.

It does **not** authorize RF-1 through RF-7 product UI. Each RF slice still needs its own approved spec, plan, task list, API dependency map, and validation gates before RF-specific source code is created.

> **Generated-client note.** The committed `src/generated/schema.d.ts` is generated from Data-Pulse-2 `auth.openapi.yaml` and `context.openapi.yaml` pinned to `62d0906`. RF implementation slices should re-run `pnpm generate:client` before relying on newly changed upstream contracts.

> **Naming-collision warning.** Console **FR-008** (this scaffold-authorization gate) is **unrelated** to backend spec **008 Sales / Transaction Capture**. Same number, different meaning. "Not green-lit" here refers to the FR-008 gate — it is **not** a statement that the console is waiting on backend Sales 008.

---

## 2. Per-RF readiness (from the console `api-readiness.md`)

Source: `Retail-Tower-Console/specs/001-console-foundation/api-readiness.md` (line anchors below).

| RF family | Verdict | Anchor |
| --- | --- | --- |
| **RF-1** auth / session / context | Stable | api-readiness.md 152-168 |
| **RF-2** tenant / store | Stable | api-readiness.md 172-181 |
| **RF-3** catalog | **Blocked, verified-absent** | api-readiness.md 184-190 |
| **RF-4a** list / dismiss / inspect | Draft (no SC-verification) | api-readiness.md 196-204 |
| **RF-4b** reconciliation | Draft (promoted from blocked FR-012) | api-readiness.md 206-211 |
| **RF-5** operator / admin (A6 boundary clean) | Stable | api-readiness.md 234-241 |
| **RF-6** audit-query + search | Stable (POS-event sub-row draft) | api-readiness.md 246-251 |
| **RF-7** settings | **Blocked, verified-absent** | api-readiness.md 255-261 |

---

## 3. (Historical) Build now (through the gates) vs blocked-on-backend

**Eligible for the next RF-specific gate process** (stable backend contracts already merged where noted) — still subject to per-slice approvals before RF-specific source code is created:

- **RF-1** auth / session / context — stable.
- **RF-2** tenant / store — stable.
- **RF-5** operator / admin — stable, A6 boundary clean.
- **RF-6** audit-query + search — stable (POS-event sub-row still draft).
- **RF-4a / RF-4b** review-queue list/dismiss/inspect + reconciliation — **draft** (shadow the shipped 005/007 contracts); buildable as drafts, but RF-4a has no SC-verification yet.

**Blocked on backend** (no merged contract to shadow):

- **RF-3** catalog — *verified-absent*. Unblocks only when the backend **Catalog-Management API** (parallel track, unnumbered) ships its `[GATED]` contract.
- **RF-7** settings — *verified-absent*. **No backend spec exists yet** to unblock it; do not assume one.

---

## 4. Contract -> RF mapping (the shadow sequence)

Each future console RF family lights up when its backend contract merges. This is the same ordered list as the backend roadmap (`Data-Pulse-2/docs/ROADMAP-ERP.md`).

| Backend spec / contract (Data-Pulse-2) | Console RF family it unblocks |
| --- | --- |
| Catalog-Management API (parallel track, unnumbered) | **RF-3** catalog management |
| **008** Sales / Transaction Capture | Future sales/transaction views (no RF family defined yet) |
| **009** Inventory & Stock Movements | Future inventory views |
| **010** Payments & Tender Reconciliation | Future payments / tender views |
| **012** Reporting / Analytics read-models | Future reporting / dashboard views |
| (none yet) | **RF-7** settings — no backend spec yet |

Notes on the chain (detail lives in the backend doc, not here):

- Backend **008** is the keystone and sits behind a money + temporal decision-slice gate; **009** and **010** are a parallel tier depending only on 008; **011** purchasing depends on 009; **012** reporting depends on all of them.
- **RF-3** does **not** wait on 008 — the Catalog-Management API is an independent parallel track.
- The live end-to-end sales loop additionally needs `POS-Pulse` to emit sale transactions against the backend 008 contract (it currently emits only a closed catalogue of audit events + unknown-item captures). That is a backend/POS dependency, not a console blocker.

---

## 5. (Historical) Operating rule — no longer in force

At scaffold time the rule was: do not create RF-specific product UI, route guards, context-provider behavior, or feature logic — including the otherwise-ready RF-1/2/5/6 surfaces — until that RF slice clears the five readiness gates. The slice 002 scaffold is already merged; the next implementation slice in the foundation plan is `003-rf1-auth-shell`, and it should re-run client generation before relying on generated types.
