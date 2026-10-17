// D-2 / C-4: Generated OpenAPI client toolchain configuration and runner.
//
// `pnpm generate:client` executes this file with Node 22 type stripping. It
// reads Data-Pulse-2 OpenAPI sources from the pinned git commit, generates
// openapi-typescript output for each source, and composes the path types into
// `src/generated/schema.d.ts`. Keeping the runner here avoids adding an
// extra scripts directory outside the slice 002 scaffold surface.

import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import openapiTS, { astToString, COMMENT_HEADER } from "openapi-typescript";

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
 */
export const DATA_PULSE_2_PIN = "3499d17ca4f62a49100004bd93ba6cc3b7f90184" as const;

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
 * overrides `DATA_PULSE_2_PIN` for that one source (a temporary hold only; none
 * is held today).
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

const thisFilePath = fileURLToPath(import.meta.url);
const repoRoot = dirname(thisFilePath);

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

function readPinnedSource(dataPulseRepo: string, sourcePath: string, pin: string): string {
  return execFileSync("git", ["-C", dataPulseRepo, "show", `${pin}:${sourcePath}`], {
    encoding: "utf8",
    windowsHide: true,
  });
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

function composeSchema(generatedTypesBySource: readonly string[]): string {
  const sourceList = OPENAPI_SOURCE_SPECS.map((spec) =>
    spec.pin ? `// - ${spec.path} (held @ ${spec.pin})` : `// - ${spec.path}`,
  ).join("\n");
  const namespaceBlocks = OPENAPI_SOURCE_SPECS.map(
    (spec, index) =>
      `export namespace ${spec.name}Schema {\n${indent(stripOpenApiTypescriptHeader(generatedTypesBySource[index]))}\n}`,
  ).join("\n\n");
  const intersection = (member: string): string =>
    OPENAPI_SOURCE_SPECS.map((spec) => `${spec.name}Schema.${member}`).join(" & ");

  return `${COMMENT_HEADER}// Source: Data-Pulse-2 @ ${DATA_PULSE_2_PIN}
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

async function generateClientSchema(): Promise<void> {
  const dataPulseRepo = resolveDataPulseRepo();
  for (const pin of new Set(OPENAPI_SOURCE_SPECS.map(pinOf))) {
    execFileSync("git", ["-C", dataPulseRepo, "cat-file", "-e", `${pin}^{commit}`], {
      stdio: "ignore",
      windowsHide: true,
    });
  }

  const tempDir = mkdtempSync(join(tmpdir(), "retail-tower-console-openapi-"));
  const generatedTypes = await Promise.all(
    OPENAPI_SOURCE_SPECS.map(async (spec) => {
      const sourceFilePath = join(tempDir, `${spec.name.toLowerCase()}.openapi.yaml`);
      writeFileSync(
        sourceFilePath,
        readPinnedSource(dataPulseRepo, spec.path, pinOf(spec)),
        "utf8",
      );
      return generateSourceTypes(sourceFilePath);
    }),
  );

  writeFileSync(resolve(repoRoot, OUTPUT_PATH), composeSchema(generatedTypes), "utf8");
  console.log(`Generated ${OUTPUT_PATH} from Data-Pulse-2 @ ${DATA_PULSE_2_PIN}`);
}

if (process.argv[1] && resolve(process.argv[1]) === thisFilePath) {
  await generateClientSchema();
}
