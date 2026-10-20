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
$InformationPreference = 'Continue'

function Write-Summary([string]$Line) {
  Write-Information $Line
  if ($env:GITHUB_STEP_SUMMARY) { Add-Content -LiteralPath $env:GITHUB_STEP_SUMMARY -Value $Line }
}

# Fresh output for this locale, then the generated config (gitignored). Returns the config path.
function New-BrowserStackConfig([string]$Dir, [string]$BuildName, [string]$Reports) {
  if (Test-Path $Reports) { Remove-Item -LiteralPath $Reports -Recurse -Force }
  New-Item -ItemType Directory -Force -Path $Reports | Out-Null
  $yml = Join-Path $Dir 'browserstack.yml'
  (Get-Content -LiteralPath (Join-Path $Dir 'browserstack.template.yml') -Raw).Replace('__BUILD_NAME__', $BuildName).Replace('__LOCAL_ID__', $LocalIdentifier) |
    Set-Content -LiteralPath $yml -NoNewline
  if (Select-String -LiteralPath $yml -Pattern '^\s*(userName|accessKey)\s*:' -Quiet) {
    throw 'generated browserstack.yml must not contain credential fields'
  }
  return $yml
}

# Runs the SDK (its output goes to the console and the log only) and returns its exit code.
function Invoke-Sdk([string]$Dir, [string]$SdkLog) {
  Push-Location $Dir
  try {
    & (Join-Path $Dir 'node_modules/.bin/browserstack-node-sdk.cmd') playwright test --config playwright.config.ts 2>&1 |
      Tee-Object -FilePath $SdkLog | Out-Host
    return $LASTEXITCODE
  } finally {
    Pop-Location
  }
}

# Flattens Playwright's nested suites into the list of tests.
function Get-Tests($Suites) {
  foreach ($node in $Suites) {
    foreach ($spec in $node.specs) { $spec.tests }
    if ($node.suites) { Get-Tests $node.suites }
  }
}

function Test-Executed($Test) {
  return @($Test.results | Where-Object { $_.status -ne 'skipped' }).Count -gt 0
}

# Every configured platform must have executed at least one test, otherwise a green run would only
# cover some of the browsers it claims to cover.
function Get-ExecutedProjects($Suites) {
  return @(Get-Tests $Suites | Where-Object { Test-Executed $_ } | ForEach-Object projectName | Sort-Object -Unique)
}

function Get-PlatformFailure($Data, [string]$Yml) {
  $platformCount = ([regex]::Matches((Get-Content -LiteralPath $Yml -Raw), '(?m)^\s*(-\s*)?browserName:')).Count
  if ($platformCount -lt 1) { return 'no platform found in browserstack.yml' }
  $projects = Get-ExecutedProjects $Data.suites
  if ($projects.Count -lt $platformCount) {
    return "tests executed on only $($projects.Count) of $platformCount configured platform(s): $($projects -join ', ')"
  }
  return $null
}

# Returns the failure messages plus the Playwright stats (null when no results.json exists).
function Test-Results([string]$Reports, [string]$Yml, [int]$SdkExit) {
  $failures = New-Object System.Collections.Generic.List[string]
  if ($SdkExit -ne 0) { $failures.Add("the SDK exited with code $SdkExit") }
  $json = Join-Path $Reports 'results.json'
  if (-not (Test-Path $json)) {
    $failures.Add("no results.json was produced (SDK exit code $SdkExit); the SDK can exit 0 without running tests")
    return [pscustomobject]@{ Failures = $failures; Stats = $null }
  }
  $data = Get-Content -LiteralPath $json -Raw | ConvertFrom-Json -Depth 100
  $stats = $data.stats
  # Skipped tests do not count as a run: a run where everything was skipped proved nothing.
  if (([int]$stats.expected + [int]$stats.unexpected + [int]$stats.flaky) -lt 1) {
    $failures.Add('no test was executed (results.json is empty or everything was skipped)')
  }
  if ($stats.unexpected -gt 0) { $failures.Add("$($stats.unexpected) test(s) failed") }
  $platformFailure = Get-PlatformFailure $data $Yml
  if ($platformFailure) { $failures.Add($platformFailure) }
  return [pscustomobject]@{ Failures = $failures; Stats = $stats }
}

# Links to the results (the SDK prints them): visible from the PR check's run page.
function Get-ResultLinks([string]$SdkLog) {
  if (-not (Test-Path $SdkLog)) { return @() }
  $text = Get-Content -LiteralPath $SdkLog -Raw
  $links = @()
  $links += [regex]::Matches($text, 'https://automate\.browserstack\.com/dashboard/v2/builds/[0-9a-f]+') | ForEach-Object Value
  $links += [regex]::Matches($text, 'https://automation\.browserstack\.com/builds/[A-Za-z0-9]+') | ForEach-Object Value
  return @($links | Sort-Object -Unique)
}

function Write-Report([string]$BuildName, $Stats, $Links, [int]$SdkExit) {
  Write-Summary "### Locale ``$Locale`` - build ``$BuildName``"
  if ($Stats) {
    Write-Summary "- Playwright JSON: expected $($Stats.expected), unexpected $($Stats.unexpected), flaky $($Stats.flaky), skipped $($Stats.skipped)"
  }
  if ($Stats -and $Stats.flaky -gt 0) {
    Write-Summary "- WARNING: $($Stats.flaky) test(s) failed first and passed on retry; open them in TRA (First Run is red) - the build can still read green"
  }
  foreach ($link in $Links) { Write-Summary "- Results: $link" }
  Write-Summary "- SDK exit code: $SdkExit"
}

# Returns the process exit code: 0 only when every configured platform ran and no test failed.
function Invoke-Main {
  if (-not $env:BROWSERSTACK_USERNAME -or -not $env:BROWSERSTACK_ACCESS_KEY) { throw 'BrowserStack credentials are not set in the environment' }
  $dir = (Resolve-Path -LiteralPath $CloudDir).Path
  $buildName = "$BuildPrefix-$Locale"
  $reports = Join-Path $dir "reports/$Locale"
  $yml = New-BrowserStackConfig $dir $buildName $reports
  $env:E2E_LOCALE = $Locale
  $sdkLog = Join-Path $reports 'sdk-output.log'
  $sdkExit = [int](Invoke-Sdk $dir $sdkLog | Select-Object -Last 1)
  $result = Test-Results $reports $yml $sdkExit
  Write-Report $buildName $result.Stats (Get-ResultLinks $sdkLog) $sdkExit
  foreach ($f in $result.Failures) { Write-Summary "- FAILED: $f" }
  if ($result.Failures.Count -gt 0) { return 1 }
  Write-Summary '- Result: every configured platform ran, no test failed'
  return 0
}

exit (Invoke-Main)
