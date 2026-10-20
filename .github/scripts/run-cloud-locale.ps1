# RT-750: one SDK run for ONE locale (ar|en) across the configured platforms (Firefox/Windows, WebKit/macOS).
# Generates cloud-e2e/browserstack.yml from the template (no credential fields), runs the SDK, then checks that
# results really exist: the SDK can exit 0 without running any test (for example when its CLI cannot be fetched),
# so "no results" is a failure here. Credentials come from the environment only.
#
# Sessions are bounded by the Playwright config, not by this script: one worker per platform and one session
# per worker; every failure restarts the worker, so with retries off and maxFailures N a platform opens at most
# N sessions (cloud-e2e/playwright.config.ts; checked once locally with a scratch test, not committed: workers started = failures allowed).
[CmdletBinding()]
param(
  [Parameter(Mandatory)][ValidateSet('ar', 'en')][string]$Locale,
  [Parameter(Mandatory)][string]$LocalIdentifier,
  [string]$BuildPrefix = 'rt-admin-console-cloud',
  [string]$CloudDir = (Join-Path $PSScriptRoot '..' '..' 'cloud-e2e')
)
$ErrorActionPreference = 'Stop'
if (-not $env:BROWSERSTACK_USERNAME -or -not $env:BROWSERSTACK_ACCESS_KEY) { throw 'BrowserStack credentials are not set in the environment' }
$CloudDir = (Resolve-Path -LiteralPath $CloudDir).Path
$buildName = "$BuildPrefix-$Locale"
$reports = Join-Path $CloudDir "reports/$Locale"

function Write-Summary([string]$Line) {
  Write-Host $Line
  if ($env:GITHUB_STEP_SUMMARY) { Add-Content -LiteralPath $env:GITHUB_STEP_SUMMARY -Value $Line }
}

# Fresh output for this locale, then the generated config (gitignored).
if (Test-Path $reports) { Remove-Item -LiteralPath $reports -Recurse -Force }
New-Item -ItemType Directory -Force -Path $reports | Out-Null
$yml = Join-Path $CloudDir 'browserstack.yml'
(Get-Content -LiteralPath (Join-Path $CloudDir 'browserstack.template.yml') -Raw).Replace('__BUILD_NAME__', $buildName).Replace('__LOCAL_ID__', $LocalIdentifier) |
  Set-Content -LiteralPath $yml -NoNewline
if (Select-String -LiteralPath $yml -Pattern '^\s*(userName|accessKey)\s*:' -Quiet) {
  throw 'generated browserstack.yml must not contain credential fields'
}

$env:E2E_LOCALE = $Locale
$sdkLog = Join-Path $reports 'sdk-output.log'
Push-Location $CloudDir
try {
  & (Join-Path $CloudDir 'node_modules/.bin/browserstack-node-sdk.cmd') playwright test --config playwright.config.ts 2>&1 | Tee-Object -FilePath $sdkLog
  $sdkExit = $LASTEXITCODE
} finally {
  Pop-Location
}

$failures = New-Object System.Collections.Generic.List[string]
if ($sdkExit -ne 0) { $failures.Add("the SDK exited with code $sdkExit") }

$json = Join-Path $reports 'results.json'
$stats = $null
if (-not (Test-Path $json)) {
  $failures.Add("no results.json was produced (SDK exit code $sdkExit); the SDK can exit 0 without running tests")
} else {
  $data = Get-Content -LiteralPath $json -Raw | ConvertFrom-Json -Depth 100
  $stats = $data.stats
  # Skipped tests do not count as a run: a run where everything was skipped proved nothing.
  $executed = [int]$stats.expected + [int]$stats.unexpected + [int]$stats.flaky
  if ($executed -lt 1) { $failures.Add('no test was executed (results.json is empty or everything was skipped)') }
  if ($stats.unexpected -gt 0) { $failures.Add("$($stats.unexpected) test(s) failed") }
  # Every configured platform must have executed at least one test, otherwise a green run would only
  # cover some of the browsers it claims to cover.
  function Get-ExecutedProjects($Suites) {
    foreach ($node in $Suites) {
      foreach ($spec in $node.specs) {
        foreach ($t in $spec.tests) { if (@($t.results | Where-Object { $_.status -ne 'skipped' }).Count -gt 0) { $t.projectName } }
      }
      if ($node.suites) { Get-ExecutedProjects $node.suites }
    }
  }
  $platformCount = ([regex]::Matches((Get-Content -LiteralPath $yml -Raw), '(?m)^\s*(-\s*)?browserName:')).Count
  $projects = @(Get-ExecutedProjects $data.suites | Sort-Object -Unique)
  if ($platformCount -lt 1) { $failures.Add('no platform found in browserstack.yml') }
  elseif ($projects.Count -lt $platformCount) { $failures.Add("tests executed on only $($projects.Count) of $platformCount configured platform(s): $($projects -join ', ')") }
}

# Links to the results (the SDK prints them): visible from the PR check's run page.
$links = @()
if (Test-Path $sdkLog) {
  $text = Get-Content -LiteralPath $sdkLog -Raw
  $links += [regex]::Matches($text, 'https://automate\.browserstack\.com/dashboard/v2/builds/[0-9a-f]+') | ForEach-Object Value
  $links += [regex]::Matches($text, 'https://automation\.browserstack\.com/builds/[A-Za-z0-9]+') | ForEach-Object Value
}

Write-Summary "### Locale ``$Locale`` - build ``$buildName``"
if ($stats) {
  Write-Summary "- Playwright JSON: expected $($stats.expected), unexpected $($stats.unexpected), flaky $($stats.flaky), skipped $($stats.skipped)"
}
if ($stats -and $stats.flaky -gt 0) {
  Write-Summary "- WARNING: $($stats.flaky) test(s) failed first and passed on retry; open them in TRA (First Run is red) - the build can still read green"
}
foreach ($link in ($links | Sort-Object -Unique)) { Write-Summary "- Results: $link" }
Write-Summary "- SDK exit code: $sdkExit"
if ($failures.Count -gt 0) {
  foreach ($f in $failures) { Write-Summary "- FAILED: $f" }
  exit 1
}
Write-Summary '- Result: every configured platform ran, no test failed'
exit 0
