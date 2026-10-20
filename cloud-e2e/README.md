# cloud-e2e — BrowserStack cross-browser smoke (RT-750)

Runs the **existing** `tests/e2e/locale-switch.spec.ts` on **Firefox / Windows 11** and **Playwright WebKit /
macOS Ventura** (WebKit engine, **not native Safari**), in **Arabic and English**, against the built SPA served
locally through a verified BrowserStack Local tunnel. About **4 BrowserStack sessions per run** (2 platforms ×
2 locales). `browserstack-node-sdk` reports every test to BrowserStack **Test Reporting & Analytics (TRA)**;
the run's summary lists the result counts and links to the build.

It is **not a required check**. The required Chromium CI (`.github/workflows/ci.yml`,
`../playwright.config.ts`) is untouched. API calls are mocked by the spec; no production endpoint or customer
data is involved.

## Licence — read before touching the dependency

`browserstack-node-sdk` is **proprietary** (BrowserStack Software License Agreement, shipped in the package as
`LICENSE.md`; accepted by the Kemetra owner on 2026-10-20, Jira RT-750 comment 13075). This repository is
Apache-2.0, so the SDK is deliberately **isolated here and never added to the root `package.json` or
`pnpm-lock.yaml`**: an ordinary `pnpm install` (contributors, forks, the required CI) does not download it. Do
not move it to the root without a new owner decision. The licence also covers usage-data collection by
BrowserStack, use only with the BrowserStack platform, and confidentiality.

## When it runs

| Trigger | Runs when | Environment |
| --- | --- | --- |
| **Manual** (`workflow_dispatch`) | on `main`, with `acknowledge_entitlement` ticked | `browserstack` |
| **Pull request** (automatic) | the repository variable `BROWSERSTACK_PR_RUNS` is `true`, **and** the PR is non-draft, from this repository (never a fork), authored by a human owner/member/collaborator, and touches relevant paths (`src/**`, `tests/e2e/**`, `cloud-e2e/**`, build/test config, this workflow and its scripts); a PR whose changed files are all Markdown is skipped | `browserstack-pr` |

A newer push to a PR cancels its superseded run. Automatic runs are **off until the owner sets
`BROWSERSTACK_PR_RUNS`**, which must wait until the BrowserStack entitlement for desktop Automate and TRA has
been verified (the account's API shows no usage counter).

**Owner setup (once):**
1. Create the GitHub environment **`browserstack`** (manual runs): restrict its deployment branches to `main`
   and add `BROWSERSTACK_USERNAME` and `BROWSERSTACK_ACCESS_KEY`; required reviewers are recommended.
2. Create **`browserstack-pr`** (pull-request runs) with its **own dedicated, revocable BrowserStack
   key — not the one in `browserstack`** (see the security model below for why), **no required reviewers** (a
   person approving every run would defeat the automation) and branches allowed.
3. **Seed the verified CLI cache:** run the workflow once manually on `main`. Pull-request runs refuse to run
   without it (see "Binary integrity").
4. Only then set `BROWSERSTACK_PR_RUNS` to `true`. Keep the check non-required until it has proved itself.

**Security model for pull requests.** Forks get no secrets (`pull_request` gives none, provided the repository
does not enable "send secrets to workflows from fork pull requests") and are also excluded by the `if:`. A
same-repository pull request runs **its own copy** of the workflow, its scripts, the spec and the app code, with
the key in the environment: **with `BROWSERSTACK_PR_RUNS=true`, anyone who can push a branch to this repository
(or a stolen write token) can read the `browserstack-pr` key.** The `if:` is a convenience, not a boundary. The
real controls are repository write access, the environment's own rules, and keeping `BROWSERSTACK_PR_RUNS`
off. Mitigation: the `browserstack-pr` key must be a **separate, revocable key** so a leak never reaches the key
that manual runs use. Enabling the variable is an explicit owner acceptance of this exposure; a design in which
the key never meets PR code (trusted-branch / manual runs only) is the alternative and needs no variable.

## What is bounded

* **Sessions** — set in `playwright.config.ts`, not by a runtime guard: one worker per platform, one session
  per worker, every failure restarts the worker (a new session). With retries off and `maxFailures: 2`, a
  platform opens at most 2 sessions: **4 expected, 8 at the very most per run** (checked once locally with a
  scratch Playwright test, which is not committed: workers started = failures allowed). Raising `maxFailures` or `retries` raises that bound.
* **Time** — 20-minute job timeout; one run per PR (superseded runs are cancelled).
* **No silent green** — the SDK can exit 0 without running any test (for example if its CLI cannot be
  fetched). `run-cloud-locale.ps1` fails when `results.json` is missing, nothing executed (all skipped), a
  configured platform executed no test, the SDK exits non-zero, or a test failed.

## Binary integrity

`.github/browserstack-pins.json` pins BrowserStack Local (zip and exe SHA-256) and the SDK's CLI binary
(SHA-256, size); `browserstack-binaries.ps1` enforces SHA-256 **and** the Authenticode signature (signer
`BrowserStack, Inc.`). The SDK itself is pinned by `pnpm-lock.yaml` (frozen install).

* **Local** is verified **before** it starts.
* The SDK's **CLI** is downloaded **and run** by the SDK with the BrowserStack key, and the SDK offers no way to
  verify it first. So, **in the unmodified workflow** (a PR's own edited copy can change any of this),
  **pull-request runs never execute an unverified CLI**: they restore the CLI from the cache
  seeded by a manual run on `main`, verify it (hash, size, signature, signer) and lock it against accidental
  replacement (not a security boundary), and **stop** if there is no such cache. Pull requests never write the
  cache. The one place an unverified CLI can still run is a **manual run on `main` with a cache miss** (first
  run, cache eviction, or any edit of the pins file, which changes the cache key); it is verified right after
  the run and cached only if it matches. That first-run exposure is **not resolved**: it is limited to a
  deliberate, owner-triggered run and left for the owner to accept.
* After the run, the job also fails if **any other executable** exists under `~/.browserstack` (for example an
  SDK-managed BrowserStackLocal that ran with the key). Local is started by the workflow with
  `skipBinaryInitialisation`, so none is expected; whether that flag holds on a clean runner is confirmed only by
  the first manual run.
* The cache-hit lock ran once against the real SDK in a local rehearsal (a run with the locked CLI passed); an
  SDK self-update under the lock would fail the run, which is the intended outcome.
* A mismatch fails the job and is classified by the signature: a bad signature means possible compromise (rotate
  the key); a **valid signature with a new hash is most likely a vendor release**: review it and bump the pins.

**Maintenance cost, by design:** the pins are exact but the vendor serves "latest" (`local.url` is an unversioned
URL checked against a pinned hash; the SDK fetches whichever CLI version BrowserStack publishes). After a
BrowserStack release the workflow fails closed until the pins are bumped in a reviewed PR and the cache is
re-seeded by a manual run (cache entries are also evicted when unused for about a week). A PR that edits the
pins file always fails its own automatic run (the cache key changes, so there is no verified CLI) until a manual
run on that branch's merge is seeded; that is expected.

## Why some of this is custom instead of BrowserStack's own tooling

Used as supplied: the SDK, TRA (per-test results, retries, builds), BrowserStack Local. Custom, each for one
reason:

* **Tunnel start and checks** (`browserstack-binaries.ps1`). The SDK can manage Local itself and BrowserStack
  publishes `browserstack/github-actions/setup-local`. Reviewed 2026-10-20: that action downloads and runs the
  binary through `@actions/tool-cache` with **no hash or signature check** (`setup-local/src/binaryControl.js`)
  and also passes the key via `--key`. The owner required integrity checks before vendor binaries run (Jira
  RT-750 comment 13076), so Local is verified here. If BrowserStack adds verification to the action, replace
  this part with it.
* **Summary** (`run-cloud-locale.ps1`). BrowserStack also publishes `browserstack-report-action`, which shows a
  report in the run summary. Not adopted: it would be a second third-party action holding the key, it looks the
  build up by name (default: workflow name and run id) while the SDK names builds `<buildName>  <n>`, and it is
  unproven here. The summary this repo prints is a few lines (counts and links).
* Everything else is glue: a per-locale run wrapper and a generated `browserstack.yml` (no credential fields).

## Locale handling (why it looks different from `../playwright.config.ts`)

The SDK renames Playwright projects and **drops project-level `use`**, so the locale is set at top level from
`E2E_LOCALE` (`ar` or `en`) with the repo's inverted browser locale (`ar` → `en-US`, `en` → `ar-EG`). There is
one SDK run per locale and one **TRA build per locale** (`rt-admin-console-cloud-ar` / `-en`), so the locales
never share a build or look like a retry of each other. Build names are digit-free on purpose (TRA drops
digit-bearing tokens). `@playwright/test` is not declared in `cloud-e2e/package.json`: the config and the SDK
resolve it from the root install, so the Playwright version is the one in the root lockfile.

## Reading the results

* TRA shows one entry per test; a test that failed then passed on retry shows `First Run` (red) and `Re-run`
  (green) while the build can read green. This config has retries off, so a failure stays a failure.
* A shared session's Automate status is last-write-wins; per-test truth lives in TRA.

## Bumping a pin (reviewed PR only)

New SDK version, new BrowserStack Local, or a new CLI binary: obtain it, verify the signature and signer
yourself, record the new hashes in `.github/browserstack-pins.json` (SDK: regenerate
`cloud-e2e/pnpm-lock.yaml` with `pnpm --dir cloud-e2e install --ignore-scripts`), merge, then re-seed the CLI
cache with a manual run on `main`. Never paste a hash from a failing run without verifying the signature.

## Known limits

Windows runner only (that is where both vendor binaries are signed); WebKit ≠ native Safari; only the
locale-switch spec runs in the cloud (the six axe specs need a 120 s timeout and many more sessions; add them
only once costs are proven); the account's desktop/TRA allowance is not visible through its API, so usage is
bounded by the config above and the plan's own limits, not by a verified quota. The workflow has not yet run on
GitHub: the first manual run validates the runner-specific steps (cache, environment secrets).
