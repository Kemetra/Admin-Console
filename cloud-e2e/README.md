# cloud-e2e — BrowserStack cross-browser smoke (RT-750)

Runs the **existing** `tests/e2e/locale-switch.spec.ts` on **Firefox / Windows 11** and **Playwright WebKit /
macOS Ventura** (WebKit engine, **not native Safari**), in **Arabic and English**, against the built SPA served on
`localhost:4173`. It uses the **official `browserstack-node-sdk`** with **SDK-managed BrowserStack Local**: the SDK
starts the tunnel and passes its identifier to the sessions, so there is no tunnel script here. Every test is
reported to BrowserStack **Test Reporting & Analytics (TRA)** (`testObservability: true`). About **4 sessions per
run** (2 platforms × 2 locales). API calls are mocked by the spec; no production endpoint or customer data is involved.

It is **not a required check**. The required Chromium CI (`.github/workflows/ci.yml`, `../playwright.config.ts`) is
untouched. Proven on GitHub on 2026-10-20 (Jira RT-750 comment 13127): Firefox, then Firefox + WebKit, Arabic.

## Licence — read before touching the dependency

`browserstack-node-sdk` is **proprietary** (BrowserStack Software License Agreement, shipped in the package as
`LICENSE.md`; accepted by the Kemetra owner on 2026-10-20, Jira RT-750 comment 13075). This repository is
Apache-2.0, so the SDK is isolated here and **never added to the root `package.json` or `pnpm-lock.yaml`**: an
ordinary `pnpm install` (contributors, forks, the required CI) does not download it. Do not move it to the root
without a new owner decision. The licence also covers usage-data collection by BrowserStack and confidentiality.

## When it runs

Only **manually** (`workflow_dispatch`), **on `main`**, with `acknowledge_entitlement` ticked, in the GitHub
environment `browserstack`. There is **no `pull_request` trigger**, so the key never meets pull-request code.

**Owner setup (once):** the environment `browserstack` holds `BROWSERSTACK_USERNAME` and `BROWSERSTACK_ACCESS_KEY`
and its deployment branches are limited to `main` (a repository setting, not part of the workflow file; the
workflow's own `if:` is not a boundary because a branch can edit it). Required reviewers are recommended.

## What is bounded

* **Sessions** — set in `playwright.config.ts`: one worker per platform, no retries, `maxFailures: 2`. One session
  per platform per locale when everything passes: **4 expected, 8 at the very most per run**. Raising either number
  raises the bound.
* **Time** — 20-minute job timeout; one run at a time.
* **No silent green** — the SDK can exit 0 without running a test. The workflow fails a locale when
  `results.json` is missing, nothing executed, a test failed, the SDK exit code is not 0, or a configured platform
  executed no test.

## Binary integrity (the known gap)

The SDK downloads **and runs** two vendor binaries with the BrowserStack key before anything can verify them:
its CLI (`~/.browserstack/cli/binary-win-x64.exe`) and BrowserStack Local (`~/.browserstack/BrowserStackLocal.exe`).
After every run the workflow checks both against `.github/browserstack-pins.json` (SHA-256, valid Authenticode
signature, signer `BrowserStack, Inc.`) and fails if **any other executable** exists under `~/.browserstack`. This is
**detective only**. A mismatch with a valid signature is most likely a vendor release (review it, then bump the pins
in a reviewed PR; the workflow stays red until then); a bad or missing signature means possible compromise: rotate
the key. The vendor serves "latest", so expect to bump the pins after BrowserStack releases.

Before the 2026-10-20 migration Local was verified **before** it ran (own download, pinned hash and signature,
`--only localhost,4173`). BrowserStack's `setup-local` Action does not verify either (no hash or signature check),
so that preventive control was not carried over; see the open security decisions in Jira RT-750.

## Locale handling (why it differs from `../playwright.config.ts`)

The SDK renames Playwright projects and **drops project-level `use`**, so the locale is set at top level from
`E2E_LOCALE` (`ar` or `en`) with the repo's inverted browser locale (`ar` → `en-US`, `en` → `ar-EG`). There is one
SDK run per locale and one **TRA build per locale** (`rt-admin-console-cloud-ar` / `-en`). Build names are
digit-free on purpose (TRA drops digit-bearing tokens). `@playwright/test` is not declared in
`cloud-e2e/package.json`: the config and the SDK resolve it from the root install.

## Running it locally (consumes BrowserStack sessions)

```powershell
pnpm install --frozen-lockfile --ignore-scripts; pnpm build
pnpm --dir cloud-e2e install --frozen-lockfile --ignore-scripts
# terminal 1: pnpm preview --port 4173
# terminal 2, with BROWSERSTACK_USERNAME / BROWSERSTACK_ACCESS_KEY set and a cloud-e2e/browserstack.yml
# (gitignored; see the workflow for the exact content):
$env:E2E_LOCALE = 'ar'; cd cloud-e2e
pnpm exec browserstack-node-sdk playwright test --config playwright.config.ts -g "renders the project locale"
```

## Bumping a pin (reviewed PR only)

New SDK version or new vendor binaries: obtain them, verify the signature and signer yourself, record the new hashes
in `.github/browserstack-pins.json` (SDK: regenerate `cloud-e2e/pnpm-lock.yaml` with
`pnpm --dir cloud-e2e install --ignore-scripts`). Never paste a hash from a failing run without verifying the signature.

## Known limits

Windows runner only (both vendor binaries are signed there); WebKit ≠ native Safari; only the locale-switch spec runs
in the cloud (the axe specs need a 120 s timeout and many more sessions); the account's desktop/TRA allowance is not
visible through its API, so usage is bounded by the config above and the plan's own limits, not by a verified quota.
Proven so far: one test (`locale-switch.spec.ts:38`) on both browsers in Arabic; the other three tests and the English
locale have not yet run in the cloud.
