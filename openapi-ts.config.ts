// D-2 / C-4: Generated OpenAPI client toolchain configuration and runner.
//
// `pnpm generate:client` executes this file with Node 22 type stripping. It
// reads Data-Pulse-2 OpenAPI sources from the pinned git commit, generates
// openapi-typescript output for each source, and composes the path types into
// `src/generated/schema.d.ts`. Keeping the runner here avoids adding an
// extra scripts directory outside the slice 002 scaffold surface.
//
//   pnpm generate:client                 regenerate at the pinned commit
//   pnpm generate:client --repin <ref>   resolve <ref> in DATA_PULSE_2_REPO,
//                                        rewrite contracts/backend-core/PIN, regenerate

import { type ExecFileSyncOptionsWithStringEncoding, execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import openapiTS, { astToString, COMMENT_HEADER } from "openapi-typescript";
import {
  BACKEND_CORE_OPENAPI_ROOT,
  BACKEND_CORE_REPO,
  type ContractsPin,
  type PinnedFile,
  comparePinFiles,
  formatPin,
  parsePin,
} from "./src/lib/contracts-pin.ts";

const thisFilePath = fileURLToPath(import.meta.url);
const repoRoot = dirname(thisFilePath);

/** Where the Backend-Core pin lives (RT-677); same grammar as POS. */
export const PIN_FILE_PATH = "contracts/backend-core/PIN" as const;

/**
 * Data-Pulse-2 pin (C-4). The generator reads OpenAPI sources from this
 * commit. Sources live in `packages/contracts/openapi/` upstream:
 *   - auth.openapi.yaml     (signIn, signOut, refreshSession)
 *   - context.openapi.yaml  (getActiveContext, switch/clear context)
 *   - tenants.openapi.yaml  (listTenants, readTenant, createTenant, updateTenant, softDeleteTenant, listMembers) — RF-2/RF-5
 *   - stores.openapi.yaml   (listStores, readStore, createStore, updateStore, softDeleteStore) — RF-2
 *   - memberships.openapi.yaml (createInvitation, updateMembership, revokeMembership, acceptInvitation) — RF-5
 *   - audit.openapi.yaml    (listAuditEvents) — RF-6
 *   - catalog/unknown-items.yaml (tenantAdminListUnknownItems,
 *       tenantAdminInspectUnknownItem, tenantAdminDismissUnknownItem are the
 *       three RF-4a runtime-merged ops; posCapture/link/create-product/reopen/
 *       bulk-dismiss are also in the document but are out of RF-4a scope) — RF-4a
 *   - settlement/settlement.yaml (payer accounts; 2.0.0) — 017
 *   - erpnext-reconciliation/reconciliation.yaml (ERPNext negative on-hand
 *       read + `triggerReconciliationRun` refresh) — RT-178
 *   - connector/connector-admin.yaml (tenantAdminListConnectorInstances),
 *     erpnext-connector/connector-health.yaml (listConnectorHealth) and
 *     erpnext-sync-ops/console-sync-ops.yaml (consoleGetSyncOpsSummary,
 *     consoleListPostingBacklog, consoleListReconciliationRuns) — RT-560
 *     (spec 016 Phase A); added at the existing pin, no re-pin
 *   - devices.openapi.yaml (consoleListDevices, consoleGetDevice; the
 *     lifecycle writes are wrapped from RT-372) — RT-371
 *   - console-sales.openapi.yaml (consoleListSales, consoleGetSale) — RT-587
 *     (spec 012 sales search and sale detail)
 *
 * The pin is UNCHANGED across slices; new slices add their contract source and
 * regenerate at the same SHA (regeneration, not a re-pin).
 *
 * EXCEPTION — first deliberate re-pin (017 G-client, 2026-06-17): bumped
 * 62d0906 -> 9874d44 to add the settlement source. "Regenerate at the same SHA"
 * was IMPOSSIBLE here because `settlement/settlement.yaml` did NOT exist at
 * 62d0906 (035 landed later). Verified safe: the 7 existing sources are
 * BYTE-IDENTICAL at 62d0906's contracts and at 9874d44 (no drift in
 * auth/context/tenants/stores/memberships/audit/unknown-items), so the existing
 * generated client is unchanged — the bump is purely additive (Settlement
 * namespace). `9874d44` matches the pin recorded in
 * specs/017-.../api-readiness.md (settlement.yaml authority @ cb4a7e5; 9874d44
 * is a later no-op LOC-badge chore with identical contracts).
 *
 * SECOND deliberate re-pin (RT-178, 2026-10-04): bumped 9874d44 -> 7597a87
 * (Backend-Core PR #687 / RT-177 merge) to add the ERPNext reconciliation source
 * (`listErpnextNegativeOnHandStores`, `listErpnextNegativeOnHand`, and the
 * existing `triggerReconciliationRun`). `erpnext-reconciliation/reconciliation.yaml`
 * carries the RT-177 operations only from 7597a87. Unlike the first re-pin, the
 * 8 existing sources DID drift between the two SHAs (validation constraints,
 * `additionalProperties: false`, `x-runtime-*` annotations, settlement money
 * patterns + a 429 response); the regenerated client absorbs them.
 *
 * THIRD deliberate re-pin (RT-477 / RT-18, 2026-10-16): bumped 7597a87 ->
 * 2b03ad2 (Backend-Core main) to pick up `Store.timezone` (RT-401, PR #746;
 * stores.openapi.yaml) and the admin shift-close read API (RT-383, PRs #737 /
 * #740; `shift-closes.openapi.yaml`, added to the composed sources below).
 *
 * FOURTH deliberate re-pin (RT-371, 2026-10-16): bumped 2b03ad2 -> ba22a81
 * (Backend-Core PR #781 / RT-365 runtime) to add the device registry source
 * (`devices.openapi.yaml`, contract #777). Drift across the composed sources:
 * `shift-closes.openapi.yaml` 1.1.0-draft (RT-384) is additive (optional
 * properties and filters); every other source except Settlement is
 * byte-identical. Settlement was HELD at the previous pin (2b03ad2) until RT-421.
 *
 * Settlement HOLD REMOVED (RT-421, 2026-10-17): the per-source override on
 * Settlement is deleted together with the 018/019 callers it protected.
 * Settlement now reads at the global pin ba22a81, which already carries
 * settlement.yaml 2.0.0. Backend-Core main (fc64f4ad, RT-418 payer routes)
 * differs from ba22a81 in this file only by `x-runtime-status` markers and
 * prose (no wire change), so the generated Settlement types are identical at
 * either SHA; the global pin is deliberately NOT bumped here (that would pull
 * unrelated devices drift, RT-366). The next slice to need a newer contract
 * bumps it.
 *
 * FIFTH deliberate re-pin (RT-587, 2026-10-17): bumped ba22a81 -> a959959
 * (Backend-Core main, after RT-562 #783 / RT-418 #787 / RT-366 #785) for the
 * console sales read (`console-sales.openapi.yaml`, contract #780, added to the
 * composed sources below). Drift across the composed sources: console-sales and
 * Settlement change only `x-runtime-status` markers and prose (no wire change);
 * `devices.openapi.yaml` gains the RT-366 impact preview (`consoleGetDeviceImpact`
 * and a 409 payload), additive and not wrapped here. Every other source is
 * byte-identical.
 *
 * SIXTH deliberate re-pin (RT-389 and RT-372, 2026-10-17): bumped a959959 ->
 * 3499d17 (Backend-Core main, after RT-387 #797 shift variance policy runtime,
 * RT-367 #789 / #798 pairing codes and RT-368 #799 / #802 retire). RT-389 adds
 * the shift variance policy source (`cash-variance-policy.openapi.yaml`,
 * contract RT-384) to the composed sources below; RT-372 wraps the new Devices
 * operations for the device lifecycle flows (`consoleRetireDevice`,
 * `consoleIssuePairingCode`, `consoleListPairingCodes`,
 * `consoleCancelPairingCode`). Drift across the composed sources between
 * a959959 and 3499d17: only `devices.openapi.yaml` 1.3.0-draft moved, and
 * additively, except that `consoleListDevices` no longer lists retired devices
 * by default (`trust_state=retired` still does). Every other source is
 * byte-identical, `console-sales` included.
 *
 * PIN FILE (RT-677, 2026-10-18): the pin no longer lives in this file as a
 * literal. It is `contracts/backend-core/PIN` (the same grammar as POS, RT-217),
 * holding the commit plus the git blob SHA of every composed source, so
 * Backend-Core's consumer-impact check and the repin bot can read it without
 * parsing TypeScript. The generator verifies each source's blob SHA against the
 * PIN before generating, and `pnpm generate:client --repin <ref>` rewrites the
 * PIN, then regenerates. Moving the pin did not move it: still 3499d17.
 *
 * SEVENTH deliberate re-pin (RT-678, 2026-10-18, a person in the loop, not the
 * repin bot of RT-679): bumped 3499d17 -> 35114fd (Backend-Core main, 30 commits
 * ahead, through the RT-674 consumer-impact check #820). Done with
 * `pnpm generate:client --repin 35114fd...`. Of the 16 composed sources only two
 * changed; both are additive and no caller needed a code change:
 *   - `audit.openapi.yaml` (RT-567 / RT-687): `listAuditEvents` gains the
 *     optional `kind` filter (`read` | `change`) and a documented 400; the
 *     `AuditEvent` response gains a `kind` field the server always sets; the
 *     `action` filter is documented as a literal prefix and the order as newest
 *     first. The console does not read or send `kind` yet.
 *   - `settlement/settlement.yaml` (RT-572): new `consoleUpdatePayerAccount`
 *     (`PATCH /api/v1/settlement/payer-accounts/{payerRef}`) with its request
 *     schema and 404/409 responses. Nothing wraps it yet.
 * The other 14 composed sources are byte-identical. Backend-Core also changed
 * `console-telemetry`, `pos-terminal-pairing`, `pos-sales` and
 * `erpnext-connector/stock-view`; none is composed here, so the generated
 * client does not see them.
 *
 * NEW SOURCE, SAME PIN (RT-673, 2026-10-18): `console-telemetry.openapi.yaml`
 * (RT-632 #817/#818) is now composed so the Console reads
 * `consoleGetTelemetryConfig` through the generated client. 35114fd already
 * holds it, so the commit did not move: `pnpm generate:client --repin 35114fd...`
 * only added its blob SHA to the PIN.
 *
 * EIGHTH deliberate re-pin (RT-723, 2026-10-19): bumped 35114fd -> aa994f4
 * (Backend-Core main, RT-620 #852), superseding repin bot PR #139, and composed
 * six new console sources: `catalog/erpnext-item-map.yaml`,
 * `catalog/erpnext-warehouse-map.yaml`, `catalog/product-reconciliation.yaml`,
 * `catalog/tracking-profile.yaml`, `sale-sync-ops/sale-sync-ops.yaml` and
 * `inventory/inventory.yaml`. None is wrapped yet. Drift across the 17
 * existing sources is additive: RT-620 documents the console rate-limit 429
 * (`TooManyRequests`) on every cookieAuth operation of 15 of them, and RT-685
 * changes only prose in `console-telemetry.openapi.yaml`. `auth.openapi.yaml`
 * is byte-identical. No caller needed a code change.
 *
 * NINTH deliberate re-pin (RT-737, 2026-10-19): bumped aa994f4 -> c2a3bb6
 * (Backend-Core main, through RT-729 #855) and composed the console catalog
 * read source `catalog/console-catalog.yaml` (RT-729, contract-only upstream;
 * nothing wraps it yet). Drift across the 23 existing sources is additive and
 * touches two of them:
 *   - `inventory/inventory.yaml` 1.5.0-draft (RT-731 #854 / #856):
 *     `listStockMovements` gains the optional `scope` filter (`adhoc` | `all`)
 *     and is documented newest first (`occurredAt DESC, id DESC`) with an
 *     opaque keyset `cursor`. Nothing in the console calls it, so no caller
 *     relied on the old order.
 *   - `catalog/product-reconciliation.yaml` 1.2.0-draft (RT-733 #857):
 *     `BacklogItem.suggestionMappingVersion` and
 *     `ProductReconciliationResult.mappingId` / `mappingVersion`.
 * The other 21 sources are byte-identical. No caller needed a code change.
 *
 * TENTH deliberate re-pin (RT-665, 2026-10-19): bumped c2a3bb6 -> 62f8699
 * (Backend-Core main, through RT-662 #865) and composed the AI entitlements
 * source `ai-entitlements.openapi.yaml` (1.0.0-draft, contract-only upstream:
 * the runtime is RT-664). RT-665 wraps only `consoleGetTenantAiEntitlements`;
 * the owner opt-out write is composed but not called. Drift across the 24
 * existing sources is additive and touches two of them:
 *   - `catalog/console-catalog.yaml` 1.1.0-draft (RT-738 #860 / #862, runtime
 *     RT-730 #858): adds seven console catalog writes (create / update /
 *     retire product, add / retire identifier, upsert / retire store
 *     override) and drops the `x-runtime-status: contract-only` markers now
 *     that the runtime serves the reads. Nothing wraps them; the three reads
 *     are unchanged on the wire.
 *   - `erpnext-sync-ops/console-sync-ops.yaml` 1.2.0-draft (RT-565 #866):
 *     `SyncOpsSummary` gains a required `asOf` and `postingFreshness` in the
 *     response. The console reads the summary but not these fields, and the
 *     RT-565 runtime may not serve them yet, so no caller depends on them.
 * Backend-Core also added `console-sales-summary` and `pos-approvers`; neither
 * is composed here. The other 22 sources are byte-identical. No caller needed
 * a code change.
 *
 * ELEVENTH deliberate re-pin (RT-779, 2026-10-21): bumped 62f8699 -> 6bd8a53
 * (Backend-Core main, through RT-639 #878, after the RT-414 support-session
 * runtime #876) and composed `platform-support-sessions.openapi.yaml`
 * (1.2.0-draft, RT-777 S1a; its four operations carry no `x-runtime-status`
 * marker at 6bd8a53). Nothing wraps them yet: the /platform gate is RT-780.
 * Drift across the 25 existing sources is additive and touches five of them:
 *   - `inventory/inventory.yaml` 1.6.0-draft (RT-435): `createStatusMove`,
 *     `createRelocation`, `getReturnLandingPolicy` and `setReturnLandingPolicy`
 *     (not wrapped here); `StockMovement.integrationState` gains `erp_neutral`,
 *     which the stock movement table shows as "Unknown" until it gets a label.
 *   - `auth.openapi.yaml` (RT-623): a documented 429 with `Retry-After` on the
 *     public auth routes (sign-in and password reset). Only the sign-in countdown
 *     reads it (`src/lib/client.ts`, `src/auth/signin-flow.ts`); it now always
 *     gets a value, 1 to 3600 seconds.
 *   - `cash-variance-policy.openapi.yaml` (RT-639): the device-token rotate
 *     hint response headers on the POS device read, which is not wrapped here.
 *   - `ai-entitlements.openapi.yaml` and `erpnext-sync-ops/console-sync-ops.yaml`:
 *     the `x-runtime-status: contract-only` markers and prose only, no wire change.
 * The other 20 sources are byte-identical. No caller needed a code change.
 */
export const BACKEND_CORE_PIN: ContractsPin = parsePin(
  readFileSync(resolve(repoRoot, PIN_FILE_PATH), "utf8"),
);

/** The pinned Backend-Core commit (the `commit:` line of the PIN file). */
export const DATA_PULSE_2_PIN: string = BACKEND_CORE_PIN.commit;

/**
 * The OpenAPI sources composed into the generated client, one entry per
 * upstream contract. Each is namespaced in the output (overlapping component
 * names across documents) and intersected into `paths`/`components`/`operations`.
 *
 * - RF-1 boundary: auth + context
 *   (specs/001-console-foundation/contracts/rf1-auth-context.md).
 * - RF-2 boundary: tenants + stores
 *   (specs/004-rf2-tenant-store-mgmt/contracts/rf2-tenant-store.md).
 * - RF-4a boundary: catalog/unknown-items (the review-queue read surface;
 *   specs/007-rf4a-unknown-items/contracts/rf4a-unknown-items.md).
 *
 * `path` is relative to the Data-Pulse-2 repo root at the pinned SHA; `name` is
 * the TypeScript namespace the source is emitted under; an optional `pin`
 * overrides `DATA_PULSE_2_PIN` for that one source. Since RT-677 the single-commit
 * PIN file cannot describe a hold, so the generator refuses one (re-pin instead).
 */
/** One composed OpenAPI source; `pin` is an optional per-source hold. */
export interface OpenApiSourceSpec {
  readonly name: string;
  readonly path: string;
  readonly pin?: string;
}

export const OPENAPI_SOURCE_SPECS: readonly OpenApiSourceSpec[] = [
  { name: "Auth", path: "packages/contracts/openapi/auth.openapi.yaml" },
  { name: "Context", path: "packages/contracts/openapi/context.openapi.yaml" },
  { name: "Tenants", path: "packages/contracts/openapi/tenants.openapi.yaml" },
  { name: "Stores", path: "packages/contracts/openapi/stores.openapi.yaml" },
  { name: "Memberships", path: "packages/contracts/openapi/memberships.openapi.yaml" },
  { name: "Audit", path: "packages/contracts/openapi/audit.openapi.yaml" },
  { name: "UnknownItems", path: "packages/contracts/openapi/catalog/unknown-items.yaml" },
  // Settlement boundary (017): payer accounts only. settlement.yaml 2.0.0
  // (Backend-Core #779, RT-417) retired the receivable/claim/remittance/
  // apply-payment operations (018/019); RT-421 removed their screens and
  // wrappers, so the temporary per-source hold is gone and Settlement reads at
  // the global pin. Consume-only; specs author no YAML.
  { name: "Settlement", path: "packages/contracts/openapi/settlement/settlement.yaml" },
  // ERPNext reconciliation (RT-178): the negative on-hand read pair plus the
  // `triggerReconciliationRun` refresh. Consume-only; no YAML authored here.
  {
    name: "ErpnextReconciliation",
    path: "packages/contracts/openapi/erpnext-reconciliation/reconciliation.yaml",
  },
  // Admin shift-close read API (RT-383 / RT-18): `consoleListShiftCloses`,
  // `consoleGetShiftClose`. Consume-only; no YAML authored here.
  { name: "ShiftCloses", path: "packages/contracts/openapi/shift-closes.openapi.yaml" },
  // ERP connection & sync status, Phase A (RT-560 / spec 016). Regenerated at
  // the same pin (no re-pin): connector instances (018), connector health (020)
  // and the console sync-ops read model (025). Read-only consumption; the
  // credential lifecycle and heartbeat ops are in the documents but not wrapped.
  { name: "ConnectorAdmin", path: "packages/contracts/openapi/connector/connector-admin.yaml" },
  {
    name: "ConnectorHealth",
    path: "packages/contracts/openapi/erpnext-connector/connector-health.yaml",
  },
  { name: "SyncOps", path: "packages/contracts/openapi/erpnext-sync-ops/console-sync-ops.yaml" },
  // Console device registry (RT-365 contract #777 / runtime #781; RT-371): the
  // fleet list and device detail reads. Consume-only; no YAML authored here.
  { name: "Devices", path: "packages/contracts/openapi/devices.openapi.yaml" },
  // Console sales read (RT-561 contract #780 / RT-562 runtime #783; RT-587,
  // spec 012): `consoleListSales`, `consoleGetSale`. Read-only consumption;
  // no YAML authored here.
  { name: "ConsoleSales", path: "packages/contracts/openapi/console-sales.openapi.yaml" },
  // Shift variance policy (RT-384 contract #778 / RT-387 runtime #797; RT-389):
  // the tenant default and store override reads, revision lists and publishes.
  // The POS device read in the same document is not wrapped here.
  {
    name: "CashVariancePolicy",
    path: "packages/contracts/openapi/cash-variance-policy.openapi.yaml",
  },
  // Console Sentry tunnel (RT-632 contract #817 / runtime #818; RT-673): only
  // `consoleGetTelemetryConfig` is wrapped. The SDK posts envelopes to the
  // tunnel itself, so `consoleForwardTelemetryEnvelope` is not called here.
  {
    name: "ConsoleTelemetry",
    path: "packages/contracts/openapi/console-telemetry.openapi.yaml",
  },
  // Console sources for the ERP mapping, sale sync-ops, product reconciliation
  // and inventory read views (RT-723). Composed only: nothing wraps them yet,
  // the screens that call them are follow-ups. Consume-only; no YAML authored here.
  { name: "ErpnextItemMap", path: "packages/contracts/openapi/catalog/erpnext-item-map.yaml" },
  {
    name: "ErpnextWarehouseMap",
    path: "packages/contracts/openapi/catalog/erpnext-warehouse-map.yaml",
  },
  {
    name: "ProductReconciliation",
    path: "packages/contracts/openapi/catalog/product-reconciliation.yaml",
  },
  { name: "TrackingProfile", path: "packages/contracts/openapi/catalog/tracking-profile.yaml" },
  { name: "SaleSyncOps", path: "packages/contracts/openapi/sale-sync-ops/sale-sync-ops.yaml" },
  { name: "Inventory", path: "packages/contracts/openapi/inventory/inventory.yaml" },
  // Console catalog read (RT-729 contract #855; RT-737): product list, product
  // detail and categories. Composed only: nothing wraps it yet, the runtime
  // is RT-730 and the screens are follow-ups. Consume-only; no YAML authored here.
  { name: "ConsoleCatalog", path: "packages/contracts/openapi/catalog/console-catalog.yaml" },
  // AI entitlements (RT-662 contract #865; RT-665): the protected tenant read
  // `consoleGetTenantAiEntitlements`. Only the read is wrapped. The owner opt-out
  // write (`consolePutTenantAiFeatureOptOut`) is composed but not called, and the
  // server-internal `check` shapes have no path. Consume-only; no YAML authored here.
  { name: "AiEntitlements", path: "packages/contracts/openapi/ai-entitlements.openapi.yaml" },
  // Platform support sessions (RT-777 S1a / RT-779; contract #741, runtime #876):
  // `openSupportSession`, `getCurrentSupportSession`, `renewSupportSession`,
  // `endSupportSession` for the /platform pilot path. Composed only: the /platform
  // gate (RT-780) and the screens that call them are follow-ups. Consume-only;
  // no YAML authored here.
  {
    name: "PlatformSupportSessions",
    path: "packages/contracts/openapi/platform-support-sessions.openapi.yaml",
  },
];

/** Upstream source paths (kept for back-compat / documentation references). */
export const OPENAPI_SOURCES = OPENAPI_SOURCE_SPECS.map((s) => s.path);

/**
 * Where openapi-typescript writes the schema types (D-7). Committed,
 * not .gitignore'd, so CI is reproducible without running the generator.
 */
export const OUTPUT_PATH = "src/generated/schema.d.ts" as const;

/**
 * Console-originated requests use the dp2_session cookie automatically
 * (C-2). No Authorization: Bearer plumbing. openapi-fetch sends
 * credentials same-origin; see src/generated/client.ts.
 */
export const CREDENTIALS_MODE = "include" as const;

const DATA_PULSE_2_REPO_ENV = "DATA_PULSE_2_REPO" as const;

function resolveDataPulseRepo(): string {
  const configuredRepo = process.env[DATA_PULSE_2_REPO_ENV];
  const candidate = configuredRepo
    ? resolve(configuredRepo)
    : resolve(repoRoot, "..", "Data-Pulse-2");

  if (!existsSync(join(candidate, ".git"))) {
    throw new Error(
      `Data-Pulse-2 repo not found at ${candidate}. Set ${DATA_PULSE_2_REPO_ENV} to the repo root.`,
    );
  }

  return candidate;
}

/** The SHA a source is read at: its own `pin` (a temporary hold), else the global pin. */
export function pinOf(spec: OpenApiSourceSpec): string {
  return spec.pin ?? DATA_PULSE_2_PIN;
}

const GIT_OPTIONS: ExecFileSyncOptionsWithStringEncoding = {
  encoding: "utf8",
  stdio: ["ignore", "pipe", "pipe"],
  windowsHide: true,
};

function git(dataPulseRepo: string, args: readonly string[]): string {
  // `git` is resolved from PATH on purpose: this is a developer/CI tool run from the
  // caller's own shell (as release-artifact.ts does), so PATH is theirs to trust.
  return execFileSync("git", ["-C", dataPulseRepo, ...args], GIT_OPTIONS); // NOSONAR S4036
}

function readPinnedSource(dataPulseRepo: string, sourcePath: string, pin: string): string {
  return git(dataPulseRepo, ["show", `${pin}:${sourcePath}`]);
}

/**
 * Every composed source. A per-source hold reads a different commit, which the
 * single-commit PIN cannot describe (and consumers of the PIN would be misled),
 * so a hold is refused rather than silently left out of the PIN: re-pin instead.
 */
function pinnedSpecs(): readonly OpenApiSourceSpec[] {
  const held = OPENAPI_SOURCE_SPECS.filter((spec) => spec.pin !== undefined);
  if (held.length > 0) {
    throw new Error(
      `${PIN_FILE_PATH} cannot describe per-source pin holds (${held.map((s) => s.name).join(", ")}); re-pin instead of holding`,
    );
  }
  return OPENAPI_SOURCE_SPECS;
}

/** The blob SHA of every pinned source in Backend-Core at `commit`. */
function readBlobShas(dataPulseRepo: string, pin: ContractsPin, commit: string): PinnedFile[] {
  const prefix = `${pin.source}/`;
  return pinnedSpecs().map((spec) => {
    if (!spec.path.startsWith(prefix)) {
      throw new Error(`${spec.path} is outside the PIN source root ${pin.source}`);
    }
    try {
      return {
        path: spec.path.slice(prefix.length),
        blobSha: git(dataPulseRepo, ["rev-parse", "--verify", `${commit}:${spec.path}`]).trim(),
      };
    } catch {
      throw new Error(`${spec.path} does not exist in Backend-Core at ${commit}`);
    }
  });
}

/** Fail unless the repo holds exactly the PIN's contracts: right commit, right blobs. */
function verifyPin(dataPulseRepo: string, pin: ContractsPin): void {
  if (pin.repo !== BACKEND_CORE_REPO || pin.source !== BACKEND_CORE_OPENAPI_ROOT) {
    throw new Error(
      `${PIN_FILE_PATH} must pin ${BACKEND_CORE_REPO} ${BACKEND_CORE_OPENAPI_ROOT}, found ${pin.repo} ${pin.source}`,
    );
  }
  try {
    git(dataPulseRepo, ["cat-file", "-e", `${pin.commit}^{commit}`]);
  } catch {
    throw new Error(`Backend-Core commit ${pin.commit} not found in ${dataPulseRepo}`);
  }
  const problems = comparePinFiles(pin.files, readBlobShas(dataPulseRepo, pin, pin.commit));
  if (problems.length > 0) {
    throw new Error(
      `${PIN_FILE_PATH} does not match Backend-Core @ ${pin.commit}:\n  ${problems.join("\n  ")}\nRun 'pnpm generate:client --repin <ref>' to rewrite it.`,
    );
  }
}

/** The PIN for `ref` in `dataPulseRepo`, with fresh blob SHAs. Does not write it. */
function resolveRepin(dataPulseRepo: string, current: ContractsPin, ref: string): ContractsPin {
  let commit: string;
  try {
    commit = git(dataPulseRepo, ["rev-parse", "--verify", `${ref}^{commit}`]).trim();
  } catch {
    throw new Error(`--repin: cannot resolve "${ref}" to a commit in ${dataPulseRepo}`);
  }
  return { ...current, commit, files: readBlobShas(dataPulseRepo, current, commit) };
}

async function generateSourceTypes(sourceFilePath: string): Promise<string> {
  const ast = await openapiTS(pathToFileURL(sourceFilePath));
  return `${COMMENT_HEADER}${astToString(ast)}`;
}

function stripOpenApiTypescriptHeader(generatedTypes: string): string {
  return generatedTypes.startsWith(COMMENT_HEADER)
    ? generatedTypes.slice(COMMENT_HEADER.length).trim()
    : generatedTypes.trim();
}

function indent(text: string): string {
  return text
    .split("\n")
    .map((line) => (line.length === 0 ? line : `    ${line}`))
    .join("\n");
}

function composeSchema(generatedTypesBySource: readonly string[], pinCommit: string): string {
  const sourceList = OPENAPI_SOURCE_SPECS.map((spec) =>
    spec.pin ? `// - ${spec.path} (held @ ${spec.pin})` : `// - ${spec.path}`,
  ).join("\n");
  const namespaceBlocks = OPENAPI_SOURCE_SPECS.map(
    (spec, index) =>
      `export namespace ${spec.name}Schema {\n${indent(stripOpenApiTypescriptHeader(generatedTypesBySource[index]))}\n}`,
  ).join("\n\n");
  const intersection = (member: string): string =>
    OPENAPI_SOURCE_SPECS.map((spec) => `${spec.name}Schema.${member}`).join(" & ");

  return `${COMMENT_HEADER}// Source: Data-Pulse-2 @ ${pinCommit}
// Sources:
${sourceList}
//
// The upstream OpenAPI files are separate documents with overlapping component
// names, so this file namespaces each generated source and composes their path
// maps for openapi-fetch.

${namespaceBlocks}

export type paths = ${intersection("paths")};
export type components = ${intersection("components")};
export type operations = ${intersection("operations")};
`;
}

async function generateClientSchema(dataPulseRepo: string, pin: ContractsPin): Promise<void> {
  const pinOfSpec = (spec: OpenApiSourceSpec): string => spec.pin ?? pin.commit;
  for (const held of new Set(OPENAPI_SOURCE_SPECS.map(pinOfSpec))) {
    git(dataPulseRepo, ["cat-file", "-e", `${held}^{commit}`]);
  }

  const tempDir = mkdtempSync(join(tmpdir(), "retail-tower-console-openapi-"));
  const generatedTypes = await Promise.all(
    OPENAPI_SOURCE_SPECS.map(async (spec) => {
      const sourceFilePath = join(tempDir, `${spec.name.toLowerCase()}.openapi.yaml`);
      writeFileSync(
        sourceFilePath,
        readPinnedSource(dataPulseRepo, spec.path, pinOfSpec(spec)),
        "utf8",
      );
      return generateSourceTypes(sourceFilePath);
    }),
  );

  writeFileSync(resolve(repoRoot, OUTPUT_PATH), composeSchema(generatedTypes, pin.commit), "utf8");
  console.log(`Generated ${OUTPUT_PATH} from Data-Pulse-2 @ ${pin.commit}`);
}

/** `--repin <ref>` or nothing; anything else is a typo worth failing on. */
function parseCliArgs(argv: readonly string[]): { readonly repinRef?: string } {
  if (argv.length === 0) return {};
  const [flag, ref, ...rest] = argv;
  if (flag !== "--repin" || ref === undefined || ref.startsWith("--") || rest.length > 0) {
    throw new Error("usage: pnpm generate:client [--repin <ref>]");
  }
  return { repinRef: ref };
}

async function main(argv: readonly string[]): Promise<void> {
  const { repinRef } = parseCliArgs(argv);
  const dataPulseRepo = resolveDataPulseRepo();
  let pin = BACKEND_CORE_PIN;
  if (repinRef !== undefined) {
    pin = resolveRepin(dataPulseRepo, BACKEND_CORE_PIN, repinRef);
    writeFileSync(resolve(repoRoot, PIN_FILE_PATH), formatPin(pin), "utf8");
    console.log(`Re-pinned ${PIN_FILE_PATH}: ${BACKEND_CORE_PIN.commit} -> ${pin.commit}`);
  }
  verifyPin(dataPulseRepo, pin);
  await generateClientSchema(dataPulseRepo, pin);
}

if (process.argv[1] && resolve(process.argv[1]) === thisFilePath) {
  await main(process.argv.slice(2));
}
