/**
 * RT-677: the `contracts/backend-core/PIN` file format. Same grammar as POS
 * (RT-217, `scripts/contracts-pin.ts`), so one parser serves both consumers
 * (Backend-Core's consumer-impact check, RT-674, and the repin bot, RT-679).
 * Pure: no I/O.
 *
 * The PIN records which Backend-Core commit the generated client was built from
 * and the git blob SHA of every OpenAPI source file composed into it.
 *
 * Loaded by `openapi-ts.config.ts` under Node type stripping, so keep this file
 * free of enums, parameter properties and path aliases.
 */

/** Where the OpenAPI sources live in Backend-Core. */
export const BACKEND_CORE_REPO = "Kemetra/Backend-Core";
export const BACKEND_CORE_OPENAPI_ROOT = "packages/contracts/openapi";

export interface PinnedFile {
  /** Path relative to `source` (`packages/contracts/openapi/`). */
  readonly path: string;
  /** Git blob SHA-1 of the file's bytes at `commit`. */
  readonly blobSha: string;
}

export interface ContractsPin {
  readonly repo: string;
  readonly commit: string;
  readonly source: string;
  readonly files: readonly PinnedFile[];
}

const HEADER = [
  "# Backend-Core OpenAPI contracts the Admin-Console generated client is built from",
  "# (src/generated/schema.d.ts, RT-677). Rewritten by `pnpm generate:client --repin <ref>`.",
  "# Do not hand-edit: the generator checks every file below against its git blob SHA.",
];

const SHA1 = /^[0-9a-f]{40}$/;

// ─── path safety ─────────────────────────────────────────────────────────────

interface PathRule {
  readonly reason: string;
  readonly broken: (p: string) => boolean;
}

const DOT_SEGMENTS: ReadonlySet<string> = new Set(["", ".", ".."]);
const OPENAPI_FILE = /\.(ya?ml|json)$/;

const PATH_RULES: readonly PathRule[] = [
  { reason: "absolute", broken: (p) => p.startsWith("/") },
  { reason: "backslash", broken: (p) => p.includes("\\") },
  {
    reason: "empty, . or .. segment",
    broken: (p) => p.split("/").some((s) => DOT_SEGMENTS.has(s)),
  },
  { reason: "not .yaml/.yml/.json", broken: (p) => !OPENAPI_FILE.test(p) },
];

/** Reject anything that could escape the source directory or is not an OpenAPI file. */
export function assertSafeRelativePath(p: string): void {
  const rule = PATH_RULES.find((r) => r.broken(p));
  if (rule === undefined) return;
  throw new Error(`contracts PIN: unsafe or non-OpenAPI path "${p}" (${rule.reason})`);
}

// ─── PIN verification ────────────────────────────────────────────────────────

/**
 * Every way `pinned` disagrees with `actual` (the files and blob SHAs read from
 * Backend-Core at the PIN commit). Empty means the PIN is exactly right.
 */
export function comparePinFiles(
  pinned: readonly PinnedFile[],
  actual: readonly PinnedFile[],
): readonly string[] {
  const pinnedBySha = new Map(pinned.map((f) => [f.path, f.blobSha]));
  const actualPaths = new Set(actual.map((f) => f.path));
  const drifted = actual.flatMap((file) => describeDrift(file, pinnedBySha.get(file.path)));
  const stale = pinned
    .filter((file) => !actualPaths.has(file.path))
    .map((file) => `${file.path}: listed in the PIN but not composed by the generator`);
  return [...drifted, ...stale];
}

/** The problem (if any) with one composed file, given the blob SHA the PIN holds for it. */
function describeDrift(file: PinnedFile, pinnedSha: string | undefined): readonly string[] {
  if (pinnedSha === undefined) {
    return [`${file.path}: composed by the generator but not listed in the PIN`];
  }
  if (pinnedSha !== file.blobSha) {
    return [`${file.path}: PIN has blob ${pinnedSha} but Backend-Core has ${file.blobSha}`];
  }
  return [];
}

// ─── PIN format ──────────────────────────────────────────────────────────────

export function formatPin(pin: ContractsPin): string {
  const files = [...pin.files].sort((a, b) => a.path.localeCompare(b.path));
  return [
    ...HEADER,
    `repo: ${pin.repo}`,
    `commit: ${pin.commit}`,
    `source: ${pin.source}`,
    ...files.map((f) => `file: ${f.path} ${f.blobSha}`),
    "",
  ].join("\n");
}

interface PinDraft {
  repo?: string;
  commit?: string;
  source?: string;
  readonly files: PinnedFile[];
}

interface PinField {
  readonly key: string;
  readonly value: string;
}

function parseFileEntry(field: PinField): PinnedFile {
  const parts = field.value.split(/\s+/);
  const [path, blobSha] = parts as [string, string | undefined];
  if (parts.length !== 2 || !SHA1.test(blobSha ?? "")) {
    throw new Error(`contracts PIN: malformed file line "file: ${field.value}"`);
  }
  assertSafeRelativePath(path);
  return { path, blobSha: blobSha as string };
}

const FIELD_READERS: Readonly<Record<string, (draft: PinDraft, field: PinField) => void>> = {
  repo: (draft, field) => {
    draft.repo = field.value;
  },
  commit: (draft, field) => {
    draft.commit = field.value;
  },
  source: (draft, field) => {
    draft.source = field.value;
  },
  file: (draft, field) => {
    draft.files.push(parseFileEntry(field));
  },
};

const PIN_LINE = /^([a-z]+):\s+(\S.*)$/;

/** A `key: value` field, or null for a blank / comment line. */
function parseField(raw: string): PinField | null {
  const line = raw.trim();
  if (line === "" || line.startsWith("#")) return null;
  const match = PIN_LINE.exec(line);
  if (match === null) throw new Error(`contracts PIN: unparseable line "${line}"`);
  return { key: match[1] as string, value: (match[2] as string).trim() };
}

function readField(draft: PinDraft, field: PinField): void {
  const reader = Object.hasOwn(FIELD_READERS, field.key) ? FIELD_READERS[field.key] : undefined;
  if (reader === undefined) throw new Error(`contracts PIN: unknown key "${field.key}"`);
  reader(draft, field);
}

const PIN_CHECKS: ReadonlyArray<{
  readonly message: string;
  readonly ok: (d: PinDraft) => boolean;
}> = [
  { message: "repo is required", ok: (d) => d.repo !== undefined },
  { message: "source is required", ok: (d) => d.source !== undefined },
  { message: "commit must be a full SHA", ok: (d) => SHA1.test(d.commit ?? "") },
  { message: "no files pinned", ok: (d) => d.files.length > 0 },
  {
    message: "duplicate file entry",
    ok: (d) => new Set(d.files.map((f) => f.path)).size === d.files.length,
  },
];

export function parsePin(text: string): ContractsPin {
  const draft: PinDraft = { files: [] };
  for (const raw of text.split(/\r?\n/)) {
    const field = parseField(raw);
    if (field !== null) readField(draft, field);
  }
  const failed = PIN_CHECKS.find((check) => !check.ok(draft));
  if (failed !== undefined) throw new Error(`contracts PIN: ${failed.message}`);
  return {
    repo: draft.repo as string,
    commit: draft.commit as string,
    source: draft.source as string,
    files: draft.files,
  };
}
