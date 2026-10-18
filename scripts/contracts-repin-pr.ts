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
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { OUTPUT_PATH, PIN_FILE_PATH } from "../openapi-ts.config.ts";
import {
  type BranchAction,
  decideBranchAction,
  diffPins,
  parsePin,
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

function run(command: string, args: readonly string[]): string {
  try {
    // `git` and `gh` are resolved from PATH on purpose: this runs on a GitHub-hosted runner.
    return execFileSync(command, args, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim(); // NOSONAR S4036
  } catch (error) {
    const stderr = (error as { stderr?: unknown }).stderr;
    const detail = typeof stderr === "string" && stderr.trim() !== "" ? `: ${stderr.trim()}` : "";
    throw new Error(`${command} ${args.join(" ")} failed${detail}`);
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
function branchAuthors(repo: string): readonly (string | null)[] {
  let out: string;
  try {
    out = gh(
      "api",
      "--paginate",
      `repos/${repo}/compare/${BASE}...${BRANCH}`,
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

function findOpenPr(repo: string): OpenPr | null {
  const out = gh(
    ...["pr", "list", "--repo", repo, "--head", BRANCH, "--base", BASE, "--state", "open"],
    ...["--json", "number,isDraft,labels"],
  );
  const prs = JSON.parse(out) as readonly OpenPr[];
  return prs[0] ?? null;
}

function ensureBreakLabel(repo: string): void {
  gh(
    ...["label", "create", BREAK_LABEL, "--repo", repo, "--force"],
    ...["--color", "D93F0B", "--description", "Backend-Core repin broke the build or tests"],
  );
}

/** Commit the repin on the bot branch and push it; false when origin already has this exact tree. */
function pushRepin(title: string, lease: string | null): boolean {
  git("config", "user.name", BOT_LOGIN);
  git("config", "user.email", BOT_EMAIL);
  git("checkout", "-B", BRANCH);
  git("add", "--", PIN_FILE_PATH, OUTPUT_PATH);
  if (run("git", ["status", "--porcelain", "--", PIN_FILE_PATH, OUTPUT_PATH]) === "") {
    console.log("Nothing to commit: the working tree already matches main.");
    return false;
  }
  git("commit", "-m", title);
  if (lease !== null) {
    git("fetch", "--depth", "1", "origin", BRANCH);
    if (git("rev-parse", "FETCH_HEAD^{tree}") === git("rev-parse", "HEAD^{tree}")) {
      console.log(`${BRANCH} already holds this repin; not pushing.`);
      return false;
    }
  }
  // The lease is the tip seen before the author check: a human push in between fails the push.
  git("push", `--force-with-lease=${BRANCH}:${lease ?? ""}`, "origin", BRANCH);
  console.log(`Pushed ${BRANCH}.`);
  return true;
}

function writeBody(body: string): string {
  const file = join(mkdtempSync(join(tmpdir(), "contracts-repin-")), "body.md");
  writeFileSync(file, body, "utf8");
  return file;
}

function createPr(repo: string, title: string, body: string, draft: boolean): void {
  const args = ["pr", "create", "--repo", repo, "--base", BASE, "--head", BRANCH];
  args.push("--title", title, "--body-file", writeBody(body));
  if (draft) args.push("--draft", "--label", BREAK_LABEL);
  console.log(`Opened ${gh(...args)}`);
}

function syncPrState(repo: string, pr: OpenPr, draft: boolean): void {
  const n = String(pr.number);
  const hasLabel = pr.labels.some((l) => l.name === BREAK_LABEL);
  if (draft) {
    if (!pr.isDraft) gh("pr", "ready", n, "--repo", repo, "--undo");
    if (!hasLabel) gh("pr", "edit", n, "--repo", repo, "--add-label", BREAK_LABEL);
    return;
  }
  if (pr.isDraft) gh("pr", "ready", n, "--repo", repo);
  if (hasLabel) gh("pr", "edit", n, "--repo", repo, "--remove-label", BREAK_LABEL);
}

function upsertPr(repo: string, title: string, body: string, draft: boolean): void {
  const pr = findOpenPr(repo);
  if (pr === null) {
    createPr(repo, title, body, draft);
    return;
  }
  gh("pr", "edit", String(pr.number), "--repo", repo, "--title", title);
  gh("pr", "edit", String(pr.number), "--repo", repo, "--body-file", writeBody(body));
  syncPrState(repo, pr, draft);
  console.log(`Updated PR #${pr.number}.`);
}

/** Tell the PR a repin is waiting but a person owns the branch now (once per target commit). */
function commentBlocked(repo: string, commit: string): void {
  const pr = findOpenPr(repo);
  if (pr === null) {
    throw new Error(
      `${BRANCH} has commits that are not the bot's and no open PR to comment on; ` +
        `resolve or delete the branch (new target ${commit})`,
    );
  }
  const marker = `<!-- contracts-repin:${commit} -->`;
  const existing = gh("pr", "view", String(pr.number), "--repo", repo, "--json", "comments");
  if (existing.includes(marker)) {
    console.log(`PR #${pr.number} already has the comment for ${commit}.`);
    return;
  }
  const body = [
    marker,
    `Backend-Core has moved on to \`${commit.slice(0, 7)}\`, but \`${BRANCH}\` has commits that are not the bot's, so the bot did not force-push over them.`,
    "",
    `To pick the newer contracts up, merge \`${BASE}\` and run \`pnpm generate:client --repin ${commit}\` on this branch, or close this PR and delete the branch so the bot opens a fresh one.`,
  ].join("\n");
  gh("pr", "comment", String(pr.number), "--repo", repo, "--body-file", writeBody(body));
  console.log(`Commented on PR #${pr.number}.`);
}

function main(): void {
  const repo = requireEnv("GITHUB_REPOSITORY");
  const conformance = readConformance();
  const before = parsePin(git("show", `HEAD:${PIN_FILE_PATH}`));
  const after = parsePin(readFileSync(PIN_FILE_PATH, "utf8"));
  const diff = diffPins(before, after);
  const title = `chore(contracts): repin Backend-Core contracts to ${after.commit.slice(0, 7)}`;

  const lease = remoteBranchHead();
  const action: BranchAction = decideBranchAction(branchAuthors(repo), BOT_LOGIN);
  if (action === "comment") {
    commentBlocked(repo, after.commit);
    return;
  }

  if (conformance === "fail") ensureBreakLabel(repo);
  pushRepin(title, lease);
  const body = renderRepinPrBody({
    before,
    after,
    diff,
    conformance,
    failureSummary: failureSummary(process.env.VERIFY_LOG),
  });
  upsertPr(repo, title, body, conformance === "fail");
}

try {
  main();
} catch (error) {
  console.error(`::error title=Contracts repin PR::${(error as Error).message}`);
  process.exitCode = 1;
}
