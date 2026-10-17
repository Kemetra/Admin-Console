// RT-584: surface Playwright tests that passed only after a retry.
//
// CI runs Playwright with `retries: 2`, so a flaky test goes green silently.
// This reads the JSON report written by the CI reporter (playwright.config.ts),
// emits one `::warning::` per flaky test and a table in the step summary.
// Policy: WARN, never fail (the job's pass/fail is still Playwright's own).
//
// Usage (from the repo root): node .github/scripts/report-flaky-e2e.mjs
// The report path is fixed (no CLI argument) to match playwright.config.ts.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

const reportPath = "playwright-report/e2e-results.json";
const summaryPath = "playwright-report/e2e-retries.md";

/** Walk the nested suites and return every test whose final status is "flaky". */
function collectFlaky(report) {
  const flaky = [];
  // `spec.file` is relative to Playwright's rootDir (testDir), but `::warning
  // file=` needs a repo-root-relative path to anchor the annotation.
  const repoPath = (file) =>
    report.config?.rootDir
      ? relative(process.cwd(), join(report.config.rootDir, file)).replaceAll("\\", "/")
      : file;
  const visit = (suite) => {
    for (const spec of suite.specs ?? []) {
      for (const test of spec.tests ?? []) {
        if (test.status !== "flaky") continue;
        const failedAttempts = (test.results ?? []).filter(
          (r) => r.status !== "passed" && r.status !== "skipped",
        ).length;
        flaky.push({
          file: repoPath(spec.file),
          line: spec.line,
          title: spec.title,
          project: test.projectName,
          failedAttempts,
        });
      }
    }
    for (const child of suite.suites ?? []) visit(child);
  };
  for (const suite of report.suites ?? []) visit(suite);
  return flaky;
}

const escapeData = (s) => String(s).replace(/%/g, "%25").replace(/\r/g, "%0D").replace(/\n/g, "%0A");
const escapeProp = (s) => escapeData(s).replace(/:/g, "%3A").replace(/,/g, "%2C");
const escapeCell = (s) =>
  String(s).replaceAll("\\", "\\\\").replaceAll("|", "\\|").replaceAll("\n", " ");

// The workflow appends this file to $GITHUB_STEP_SUMMARY; the script itself
// never writes to an environment-supplied path.
function writeSummary(markdown) {
  writeFileSync(summaryPath, markdown);
}

function main() {
  if (!existsSync(reportPath)) {
    console.log(`No Playwright JSON report at ${reportPath}; nothing to report.`);
    return;
  }

  let report;
  try {
    report = JSON.parse(readFileSync(reportPath, "utf8"));
  } catch (error) {
    console.log(`::warning title=E2E retry report::Could not parse ${reportPath}: ${error.message}`);
    return;
  }

  const flaky = collectFlaky(report);
  if (flaky.length === 0) {
    writeSummary("### E2E retries\n\nNo test needed a retry to pass.\n");
    console.log("No flaky E2E tests.");
    return;
  }

  for (const t of flaky) {
    const message = `[${t.project}] ${t.title} passed only on retry (${t.failedAttempts} failed attempt(s))`;
    console.log(
      `::warning file=${escapeProp(t.file)},line=${t.line},title=Flaky E2E test::${escapeData(message)}`,
    );
  }

  const rows = flaky
    .map(
      (t) =>
        `| ${escapeCell(t.project)} | ${escapeCell(t.title)} | \`${escapeCell(t.file)}:${t.line}\` | ${t.failedAttempts} |`,
    )
    .join("\n");
  writeSummary(
    `### E2E retries: ${flaky.length} flaky test(s)\n\n` +
      "These tests failed at least once and passed on retry. The job stays green; fix or quarantine them.\n\n" +
      `| Project | Test | Location | Failed attempts |\n| --- | --- | --- | --- |\n${rows}\n`,
  );
}

main();
