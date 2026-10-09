// RT-337: pinned Admin Console release artifact.
//
// `.github/workflows/release-artifact.yml` executes this file with Node 22 type
// stripping after `pnpm build`. It refuses a build that would break same-origin
// hosting (RT-315), checks the `dist/` layout, and writes `dist/version.json`.
// Packaging (tar + SHA-256) and publishing stay in the workflow. Kept at the
// repo root next to openapi-ts.config.ts, so no extra scripts directory.

import { execFileSync } from "node:child_process";
import { appendFileSync, existsSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnv } from "vite";

/** Short-SHA length used in artifact names and release tags. */
export const SHORT_SHA_LENGTH = 12;

/** Shape of the publicly served `/version.json`. Never add secrets or hostnames. */
export interface VersionInfo {
  app: "retail-tower-console";
  sha: string;
  builtAt: string;
  backendContractPin: string;
}

const FULL_SHA = /^[0-9a-f]{40}$/;
const CONTRACT_PIN = /^[0-9a-f]{7,40}$/;
const ISO_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/;

function requireFullSha(sha: string): string {
  if (!FULL_SHA.test(sha)) {
    throw new Error(`sha must be a 40-character lowercase hex commit id, got "${sha}"`);
  }
  return sha;
}

export function buildVersionInfo(input: {
  sha: string;
  builtAt: string;
  backendContractPin: string;
}): VersionInfo {
  if (!ISO_UTC.test(input.builtAt)) {
    throw new Error(`builtAt must be an ISO-8601 UTC timestamp, got "${input.builtAt}"`);
  }
  if (!CONTRACT_PIN.test(input.backendContractPin)) {
    throw new Error(
      `backend contract pin must be a hex commit id, got "${input.backendContractPin}"`,
    );
  }
  return {
    app: "retail-tower-console",
    sha: requireFullSha(input.sha),
    builtAt: input.builtAt,
    backendContractPin: input.backendContractPin,
  };
}

export function releaseTag(sha: string): string {
  return `admin-console-${requireFullSha(sha).slice(0, SHORT_SHA_LENGTH)}`;
}

export function artifactName(sha: string): string {
  return `${releaseTag(sha)}.tar.gz`;
}

function isForbidden(file: string): boolean {
  const base = file.slice(file.lastIndexOf("/") + 1);
  return file.endsWith(".map") || base.startsWith(".env");
}

/** Problems with a built `dist/`, given its files as POSIX paths relative to `dist/`. */
export function checkDistLayout(files: readonly string[]): string[] {
  const problems: string[] = [];
  if (!files.includes("index.html")) problems.push("dist/index.html is missing");
  if (!files.some((f) => f.startsWith("assets/"))) problems.push("dist/assets/ contains no files");
  if (files.includes("version.json")) {
    problems.push("dist/version.json already exists; it must be written by the release step only");
  }
  for (const file of files) {
    if (isForbidden(file)) problems.push(`forbidden file in artifact: ${file}`);
  }
  return problems;
}

/**
 * Vite inlines `VITE_API_BASE_URL` into the bundle at build time. Any value,
 * even an empty one, would replace the same-origin default in
 * src/generated/client.ts, so a release build must not set it.
 */
export function sameOriginProblems(env: Readonly<Record<string, string | undefined>>): string[] {
  return env.VITE_API_BASE_URL === undefined
    ? []
    : ["VITE_API_BASE_URL must not be set for a release build (same-origin hosting, RT-315)"];
}

/**
 * The `VITE_*` values `vite build` (mode production) inlines: root `.env`,
 * `.env.local`, `.env.production` and `.env.production.local` plus
 * `process.env`. Checking `process.env` alone would miss a committed env file.
 */
export function releaseBuildEnv(root: string): Record<string, string> {
  return loadEnv("production", root, "VITE_");
}

function listFiles(dir: string): string[] {
  return (readdirSync(dir, { recursive: true }) as string[])
    .filter((entry) => statSync(join(dir, entry)).isFile())
    .map((entry) => entry.split(sep).join("/"));
}

function fail(problems: readonly string[]): never {
  for (const problem of problems) console.error(`release-artifact: ${problem}`);
  process.exit(1);
}

async function main(): Promise<void> {
  const repoRoot = dirname(fileURLToPath(import.meta.url));
  const distDir = resolve(repoRoot, "dist");
  if (!existsSync(distDir)) fail(["dist/ not found; run `pnpm build` first"]);

  const problems = [
    ...sameOriginProblems(releaseBuildEnv(repoRoot)),
    ...checkDistLayout(listFiles(distDir)),
  ];
  if (problems.length > 0) fail(problems);

  // Imported here, not at module top, so the pure helpers above stay free of
  // the generator's openapi-typescript dependency.
  const { DATA_PULSE_2_PIN } = await import("./openapi-ts.config.ts");
  const sha =
    process.env.GITHUB_SHA ??
    execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  const info = buildVersionInfo({
    sha,
    builtAt: new Date().toISOString(),
    backendContractPin: DATA_PULSE_2_PIN,
  });

  writeFileSync(join(distDir, "version.json"), `${JSON.stringify(info, null, 2)}\n`, "utf8");
  console.log(`Wrote dist/version.json for ${info.sha} (contract pin ${info.backendContractPin})`);

  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(
      process.env.GITHUB_OUTPUT,
      `artifact=${artifactName(sha)}\ntag=${releaseTag(sha)}\n`,
      "utf8",
    );
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
