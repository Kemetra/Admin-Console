// RT-679: opens or updates the one bot PR that repins the Backend-Core contracts.
//
// Run by `.github/workflows/contracts-repin.yml` AFTER `pnpm generate:client --repin`
// has rewritten contracts/backend-core/PIN and src/generated/schema.d.ts in the
// working tree, and after `pnpm build && pnpm test` have run (their outcome is
// passed in as CONFORMANCE). It never runs in ci.yml.
//
//   node --disable-warning=ExperimentalWarning --experimental-strip-types scripts/contracts-repin-pr.ts
//
// Environment:
//   GH_TOKEN             the GitHub App token (a GITHUB_TOKEN cannot open the PR or trigger CI)
//   GITHUB_REPOSITORY    owner/repo (set by Actions)
//   CONFORMANCE          pass | fail: the build + unit test outcome on the regenerated client
//   VERIFY_LOG           optional path of that build/test output, tailed into a failing PR body
//
// Rules (plan 2026-10-18, Task 2/4):
//   - push (force) only when every commit on the bot branch is the bot's; otherwise comment
//   - on `fail` the PR is a draft labelled `contracts-break`; a later `pass` marks it ready
//   - an unchanged branch is not re-pushed, so a quiet day does not re-run CI
//
// Loaded under Node type stripping: no enums, parameter properties or path aliases.

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { OUTPUT_PATH, PIN_FILE_PATH } from "../openapi-ts.config.ts";
import {
  type BranchAction,
  type ContractsPin,
  decideBranchAction,
  diffPins,
  hasPinChanges,
  parsePin,
  pinFingerprint,
  renderRepinPrBody,
} from "../src/lib/contracts-pin.ts";

const BRANCH = "bot/backend-core-repin";
const BASE = "main";
const BREAK_LABEL = "contracts-break";
const BOT_LOGIN = "kemetra-contracts-bot[bot]";
/** `<app user id>+<slug>[bot]@users.noreply.github.com`: GitHub links the commits to the App. */
const BOT_EMAIL = "344346299+kemetra-contracts-bot[bot]@users.noreply.github.com";
/** Stands in for a null commit author login in the compare output. */
const UNLINKED = "<unlinked>";
const SUMMARY_MAX_LINES = 60;
const SUMMARY_MAX_CHARS = 4000;

interface OpenPr {
  readonly number: number;
  readonly isDraft: boolean;
  readonly labels: readonly { readonly name: string }[];
}

type Tool = "git" | "gh";

/** Everything one run needs to open or update the PR. */
interface RepinRun {
  readonly repo: string;
  readonly pin: ContractsPin;
  readonly title: string;
  readonly body: string;
  /** True when build/test failed: the PR is a draft labelled `contracts-break`. */
  readonly draft: boolean;
}

function run(tool: Tool, args: readonly string[]): string {
  try {
    // `git` and `gh` are resolved from PATH on purpose: this runs on a GitHub-hosted runner.
    return execFileSync(tool, args, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim(); // NOSONAR S4036
  } catch (error) {
    const stderr = (error as { stderr?: unknown }).stderr;
    const detail = typeof stderr === "string" && stderr.trim() !== "" ? `: ${stderr.trim()}` : "";
    throw new Error(`${tool} ${args.join(" ")} failed${detail}`);
  }
}

const git = (...args: string[]): string => run("git", args);
const gh = (...args: string[]): string => run("gh", args);

function requireEnv(name: string): string {
  const value = process.env[name];
  if (value === undefined || value === "") throw new Error(`${name} is not set`);
  return value;
}

function readConformance(): "pass" | "fail" {
  const value = requireEnv("CONFORMANCE");
  if (value !== "pass" && value !== "fail") {
    throw new Error(`CONFORMANCE must be "pass" or "fail", got "${value}"`);
  }
  return value;
}

/** The end of the build/test output: where the first failure is easiest to find. */
function failureSummary(logPath: string | undefined): string | undefined {
  if (logPath === undefined || logPath === "") return undefined;
  try {
    const tail = readFileSync(logPath, "utf8").trimEnd().split(/\r?\n/).slice(-SUMMARY_MAX_LINES);
    return tail.join("\n").slice(-SUMMARY_MAX_CHARS);
  } catch {
    return undefined;
  }
}

/** The bot branch tip on origin, or null when the branch does not exist yet. */
function remoteBranchHead(): string | null {
  const out = git("ls-remote", "--heads", "origin", `refs/heads/${BRANCH}`);
  return out === "" ? null : (out.split(/\s+/)[0] ?? null);
}

/** Author logins of the commits ahead of main on the bot branch ([] when it does not exist). */
function branchAuthors(job: RepinRun): readonly (string | null)[] {
  let out: string;
  try {
    out = gh(
      "api",
      "--paginate",
      `repos/${job.repo}/compare/${BASE}...${BRANCH}`,
      "--jq",
      `.commits[] | (.author.login // "${UNLINKED}")`,
    );
  } catch (error) {
    if (/HTTP 404/.test((error as Error).message)) return [];
    throw error;
  }
  return out
    .split(/\r?\n/)
    .filter((line) => line !== "")
    .map((login) => (login === UNLINKED ? null : login));
}

function findOpenPr(job: RepinRun): OpenPr | null {
  const out = gh(
    "pr",
    "list",
    "--repo",
    job.repo,
    "--head",
    BRANCH,
    "--base",
    BASE,
    "--state",
    "open",
    "--json",
    "number,isDraft,labels",
  );
  const prs = JSON.parse(out) as readonly OpenPr[];
  return prs[0] ?? null;
}

function ensureBreakLabel(job: RepinRun): void {
  gh(
    "label",
    "create",
    BREAK_LABEL,
    "--repo",
    job.repo,
    "--force",
    "--color",
    "D93F0B",
    "--description",
    "Backend-Core repin broke the build or tests",
  );
}

/** Commit the repin on the bot branch and push it; false when origin already has this exact tree. */
function pushRepin(job: RepinRun, lease: string | null): boolean {
  git("config", "user.name", BOT_LOGIN);
  git("config", "user.email", BOT_EMAIL);
  git("checkout", "-B", BRANCH);
  git("add", "--", PIN_FILE_PATH, OUTPUT_PATH);
  if (git("status", "--porcelain", "--", PIN_FILE_PATH, OUTPUT_PATH) === "") {
    console.log("Nothing to commit: the working tree already matches main.");
    return false;
  }
  git("commit", "-m", job.title);
  if (lease !== null) {
    git("fetch", "--depth", "1", "origin", BRANCH);
    // The commit line and the generated header move with every Backend-Core commit, so
    // compare the contract blobs: an open PR that already pins them needs no new push.
    const branchPin = parsePin(git("show", `FETCH_HEAD:${PIN_FILE_PATH}`));
    if (!hasPinChanges(diffPins(branchPin, job.pin))) {
      console.log(`${BRANCH} already pins these contract files; not pushing.`);
      return false;
    }
  }
  // The lease is the tip seen before the author check: a human push in between fails the push.
  git("push", `--force-with-lease=${BRANCH}:${lease ?? ""}`, "origin", BRANCH);
  console.log(`Pushed ${BRANCH}.`);
  return true;
}

function writeBodyFile(text: string): string {
  const file = join(mkdtempSync(join(tmpdir(), "contracts-repin-")), "body.md");
  writeFileSync(file, text, "utf8");
  return file;
}

function createPr(job: RepinRun): void {
  const args = ["pr", "create", "--repo", job.repo, "--base", BASE, "--head", BRANCH];
  args.push("--title", job.title, "--body-file", writeBodyFile(job.body));
  if (job.draft) args.push("--draft", "--label", BREAK_LABEL);
  console.log(`Opened ${gh(...args)}`);
}

function syncPrState(job: RepinRun, pr: OpenPr): void {
  const target = [String(pr.number), "--repo", job.repo];
  const hasLabel = pr.labels.some((l) => l.name === BREAK_LABEL);
  if (job.draft) {
    if (!pr.isDraft) gh("pr", "ready", ...target, "--undo");
    if (!hasLabel) gh("pr", "edit", ...target, "--add-label", BREAK_LABEL);
    return;
  }
  if (pr.isDraft) gh("pr", "ready", ...target);
  if (hasLabel) gh("pr", "edit", ...target, "--remove-label", BREAK_LABEL);
}

/**
 * `pushed` false means the branch kept its earlier commit, so the title (which names the
 * commit) stays. The body is rewritten whenever it could be stale: a new push, or a
 * build/test verdict that flipped since the PR was last written.
 */
function upsertPr(job: RepinRun, pushed: boolean): void {
  const pr = findOpenPr(job);
  if (pr === null) {
    createPr(job);
    return;
  }
  const target = [String(pr.number), "--repo", job.repo];
  if (pushed) gh("pr", "edit", ...target, "--title", job.title);
  if (pushed || pr.isDraft !== job.draft) {
    gh("pr", "edit", ...target, "--body-file", writeBodyFile(job.body));
  }
  syncPrState(job, pr);
  console.log(`Updated PR #${pr.number}.`);
}

/** Tell the PR a repin is waiting but a person owns the branch now (once per target commit). */
function commentBlocked(job: RepinRun): void {
  const pr = findOpenPr(job);
  if (pr === null) {
    throw new Error(
      `${BRANCH} has commits that are not the bot's and no open PR to comment on; ` +
        `resolve or delete the branch (new target ${job.pin.commit})`,
    );
  }
  const target = [String(pr.number), "--repo", job.repo];
  // Keyed on the contract set, not the commit: a new Backend-Core commit that moves no
  // contract must not add another comment to a PR a person owns.
  const key = createHash("sha256").update(pinFingerprint(job.pin)).digest("hex");
  const marker = `<!-- contracts-repin:${key} -->`;
  if (gh("pr", "view", ...target, "--json", "comments").includes(marker)) {
    console.log(`PR #${pr.number} already has the comment for these contracts.`);
    return;
  }
  const text = [
    marker,
    `Backend-Core has moved on to \`${job.pin.commit.slice(0, 7)}\`, but \`${BRANCH}\` has commits that are not the bot's, so the bot did not force-push over them.`,
    "",
    `To pick the newer contracts up, merge \`${BASE}\` and run \`pnpm generate:client --repin ${job.pin.commit}\` on this branch, or close this PR and delete the branch so the bot opens a fresh one.`,
  ].join("\n");
  gh("pr", "comment", ...target, "--body-file", writeBodyFile(text));
  console.log(`Commented on PR #${pr.number}.`);
}

function main(): void {
  const conformance = readConformance();
  const before = parsePin(git("show", `HEAD:${PIN_FILE_PATH}`));
  const after = parsePin(readFileSync(PIN_FILE_PATH, "utf8"));
  const diff = diffPins(before, after);
  // The PIN commit and the generated header move with every Backend-Core commit; only a
  // moved blob is a contract change worth a PR (and a CI run).
  if (!hasPinChanges(diff)) {
    console.log(`No pinned contract file changed at ${after.commit.slice(0, 7)}; nothing to do.`);
    return;
  }
  const job: RepinRun = {
    repo: requireEnv("GITHUB_REPOSITORY"),
    pin: after,
    title: `chore(contracts): repin Backend-Core contracts to ${after.commit.slice(0, 7)}`,
    body: renderRepinPrBody({
      before,
      after,
      diff,
      conformance,
      failureSummary: failureSummary(process.env.VERIFY_LOG),
    }),
    draft: conformance === "fail",
  };

  const lease = remoteBranchHead();
  const action: BranchAction = decideBranchAction(branchAuthors(job), BOT_LOGIN);
  if (action === "comment") {
    commentBlocked(job);
    return;
  }

  if (job.draft) ensureBreakLabel(job);
  upsertPr(job, pushRepin(job, lease));
}

try {
  main();
} catch (error) {
  console.error(`::error title=Contracts repin PR::${(error as Error).message}`);
  process.exitCode = 1;
}
