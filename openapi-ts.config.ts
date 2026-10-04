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
 *   - settlement/settlement.yaml (payer accounts, receivables, claims) — 017/018/019
 *   - erpnext-reconciliation/reconciliation.yaml (ERPNext negative on-hand
 *       read + `triggerReconciliationRun` refresh) — RT-178
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
 */
export const DATA_PULSE_2_PIN = "7597a8741d754ce61d28977cc634633d4ed12f80" as const;

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
 * the TypeScript namespace the source is emitted under.
 */
export const OPENAPI_SOURCE_SPECS = [
  { name: "Auth", path: "packages/contracts/openapi/auth.openapi.yaml" },
  { name: "Context", path: "packages/contracts/openapi/context.openapi.yaml" },
  { name: "Tenants", path: "packages/contracts/openapi/tenants.openapi.yaml" },
  { name: "Stores", path: "packages/contracts/openapi/stores.openapi.yaml" },
  { name: "Memberships", path: "packages/contracts/openapi/memberships.openapi.yaml" },
  { name: "Audit", path: "packages/contracts/openapi/audit.openapi.yaml" },
  { name: "UnknownItems", path: "packages/contracts/openapi/catalog/unknown-items.yaml" },
  // Settlement boundary (017/018/019): payer accounts, receivables, claims,
  // apply-payment, reconciliation. Consume-only; specs author no YAML.
  { name: "Settlement", path: "packages/contracts/openapi/settlement/settlement.yaml" },
  // ERPNext reconciliation (RT-178): the negative on-hand read pair plus the
  // `triggerReconciliationRun` refresh. Consume-only; no YAML authored here.
  {
    name: "ErpnextReconciliation",
    path: "packages/contracts/openapi/erpnext-reconciliation/reconciliation.yaml",
  },
] as const;

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

function readPinnedSource(dataPulseRepo: string, sourcePath: string): string {
  return execFileSync("git", ["-C", dataPulseRepo, "show", `${DATA_PULSE_2_PIN}:${sourcePath}`], {
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
  const sourceList = OPENAPI_SOURCE_SPECS.map((spec) => `// - ${spec.path}`).join("\n");
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
  execFileSync("git", ["-C", dataPulseRepo, "cat-file", "-e", `${DATA_PULSE_2_PIN}^{commit}`], {
    stdio: "ignore",
    windowsHide: true,
  });

  const tempDir = mkdtempSync(join(tmpdir(), "retail-tower-console-openapi-"));
  const generatedTypes = await Promise.all(
    OPENAPI_SOURCE_SPECS.map(async (spec) => {
      const sourceFilePath = join(tempDir, `${spec.name.toLowerCase()}.openapi.yaml`);
      writeFileSync(sourceFilePath, readPinnedSource(dataPulseRepo, spec.path), "utf8");
      return generateSourceTypes(sourceFilePath);
    }),
  );

  writeFileSync(resolve(repoRoot, OUTPUT_PATH), composeSchema(generatedTypes), "utf8");
  console.log(`Generated ${OUTPUT_PATH} from Data-Pulse-2 @ ${DATA_PULSE_2_PIN}`);
}

if (process.argv[1] && resolve(process.argv[1]) === thisFilePath) {
  await generateClientSchema();
}
