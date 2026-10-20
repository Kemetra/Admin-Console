# RT-750: integrity controls for the vendor binaries used by the opt-in cloud E2E workflow.
# Windows runner / PowerShell 7. Pins live in ..\browserstack-pins.json.
#
#   local-start  download BrowserStackLocal, verify zip SHA-256 + exe SHA-256 + Authenticode
#                signature + signer, start it ONCE, wait for readiness (fail closed on any mismatch)
#   local-stop   stop the tunnel started for -Identifier
#   cli-verify   BEFORE the run: if the SDK's CLI binary already exists (cache restore) verify
#                SHA-256 / size / signature / signer, then lock it read-only (protection against
#                accidental replacement by the SDK's update logic; NOT a security boundary, since code
#                running as the same user can undo it)
#   cli-recheck  AFTER the run: the CLI binary MUST exist and match the pins, and no other executable may
#                exist under ~/.browserstack, else the job fails
#
# (The SDK itself is pinned by cloud-e2e/pnpm-lock.yaml, enforced by `pnpm install --frozen-lockfile`.)
#
# The SDK downloads and runs its own CLI binary and offers no way to verify it first. These
# checks are preventive only when the verified binary is already present (cache hit); on a cache
# miss (first run, cache eviction, any pin edit) they are detective: the binary runs with the
# BrowserStack key and is verified right after. The pins cannot tell a legitimate vendor release
# from tampering by hash alone, so a mismatch is classified by the signature (see cli-recheck).
[CmdletBinding()]
param(
  [Parameter(Mandatory)]
  [ValidateSet('local-start', 'local-stop', 'cli-verify', 'cli-recheck')]
  [string]$Action,
  [string]$Identifier,
  [int]$Port = 4173,
  [string]$WorkDir = $(if ($env:RUNNER_TEMP) { $env:RUNNER_TEMP } else { [IO.Path]::GetTempPath() }),
  [string]$PinsFile = (Join-Path $PSScriptRoot '..' 'browserstack-pins.json'),
  [string]$CliHome = $env:USERPROFILE
)
$ErrorActionPreference = 'Stop'
$InformationPreference = 'Continue'
$pins = Get-Content -LiteralPath $PinsFile -Raw | ConvertFrom-Json

function Write-Summary([string]$Line) {
  Write-Information $Line
  if ($env:GITHUB_STEP_SUMMARY) { Add-Content -LiteralPath $env:GITHUB_STEP_SUMMARY -Value $Line }
}
function Invoke-Icacls([string[]]$IcaclsArgs) {
  & icacls @IcaclsArgs | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "icacls $($IcaclsArgs -join ' ') failed with exit code $LASTEXITCODE" }
}
function Assert-Hash([string]$Path, [string]$Expected) {
  $actual = (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash
  if ($actual -ne $Expected.ToUpperInvariant()) {
    throw "SHA-256 mismatch for $Path`n  pinned: $Expected`n  actual: $actual"
  }
}
function Assert-Signed([string]$Path, [string]$Signer) {
  $sig = Get-AuthenticodeSignature -LiteralPath $Path
  if ($sig.Status -ne 'Valid') { throw "Authenticode status of $Path is '$($sig.Status)' (expected Valid)" }
  $name = $sig.SignerCertificate.GetNameInfo('SimpleName', $false)
  if ($name -ne $Signer) { throw "Signer of $Path is '$name' (expected '$Signer')" }
}
function Redact([string]$Text) {
  foreach ($secret in @($env:BROWSERSTACK_ACCESS_KEY, $env:BROWSERSTACK_USERNAME)) {
    if ($secret) { $Text = $Text.Replace($secret, '[REDACTED]') }
  }
  return $Text
}
$cliPath = Join-Path $CliHome $pins.cli.relativePath

function Wait-LocalReady($Process, [string]$Log) {
  for ($i = 0; $i -lt 90; $i++) {
    Start-Sleep -Seconds 1
    if ((Test-Path $Log) -and (Select-String -LiteralPath $Log -Pattern 'You can now access your local server' -Quiet)) { return $true }
    if ($Process.HasExited) { return $false }
  }
  return $false
}

function Start-Local {
  if (-not $Identifier) { throw '-Identifier is required' }
  if (-not $env:BROWSERSTACK_ACCESS_KEY) { throw 'BROWSERSTACK_ACCESS_KEY is not set' }
  $dir = Join-Path $WorkDir "bslocal-$Identifier"
  New-Item -ItemType Directory -Force -Path $dir | Out-Null
  $zip = Join-Path $dir 'BrowserStackLocal-win32.zip'
  Invoke-WebRequest -Uri $pins.local.url -OutFile $zip -MaximumRedirection 3
  Assert-Hash $zip $pins.local.zipSha256
  Expand-Archive -LiteralPath $zip -DestinationPath $dir -Force
  $exe = Join-Path $dir 'BrowserStackLocal.exe'
  Assert-Hash $exe $pins.local.exeSha256
  Assert-Signed $exe $pins.local.signer
  $log = Join-Path $dir 'tunnel.log'
  $err = Join-Path $dir 'tunnel.err.log'
  # The binary only accepts the key via --key, so it is visible in this runner's process list while it runs.
  $proc = Start-Process -FilePath $exe -PassThru -WindowStyle Hidden -RedirectStandardOutput $log -RedirectStandardError $err `
    -ArgumentList @('--key', $env:BROWSERSTACK_ACCESS_KEY, '--local-identifier', $Identifier, '--only', "localhost,$Port,0", '--verbose', '1')
  if (-not (Wait-LocalReady $proc $log)) {
    Write-Information (Redact ((Get-Content -LiteralPath $log, $err -ErrorAction SilentlyContinue | Select-Object -Last 20) -join "`n"))
    throw 'BrowserStack Local did not become ready (or exited early)'
  }
  Write-Summary "- BrowserStack Local verified and started once: exe SHA-256 $($pins.local.exeSha256), signer '$($pins.local.signer)', identifier $Identifier"
}

function Stop-Local {
  if (-not $Identifier) { throw '-Identifier is required' }
  Get-CimInstance Win32_Process | Where-Object { $_.Name -eq 'BrowserStackLocal.exe' -and $_.CommandLine -like "*$Identifier*" } |
    ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
  Write-Information "BrowserStack Local processes for $Identifier stopped"
}

function Invoke-CliVerify {
  if (-not (Test-Path -LiteralPath $cliPath)) {
    Write-Summary '- SDK CLI binary: not present before the run (cache miss); it runs unverified and is checked right after the run'
    return
  }
  if ((Get-Item -LiteralPath $cliPath).Length -ne $pins.cli.size) { throw "Size of $cliPath differs from the pinned $($pins.cli.size) bytes" }
  Assert-Hash $cliPath $pins.cli.sha256
  Assert-Signed $cliPath $pins.cli.signer
  # Lock against accidental replacement by the SDK's update logic (an attempted update then fails and
  # the run yields no results, which run-cloud-locale.ps1 treats as a failure).
  # File: no overwrite/append/delete. Directory: no delete-child (a file-level deny alone still lets the
  # owner delete the file through the directory, which would allow delete-and-recreate).
  Set-ItemProperty -LiteralPath $cliPath -Name IsReadOnly -Value $true
  Invoke-Icacls @($cliPath, '/deny', "$($env:USERNAME):(WD,AD,DE)")
  Invoke-Icacls @((Split-Path -Parent $cliPath), '/deny', "$($env:USERNAME):(DC)")
  Write-Summary "- SDK CLI binary verified BEFORE use and locked against accidental replacement: SHA-256 $($pins.cli.sha256), signer '$($pins.cli.signer)'"
}

# Any OTHER executable under ~/.browserstack means the SDK fetched and may have run a second vendor binary
# (for example its own BrowserStackLocal) with the key. Local is started by local-start with
# skipBinaryInitialisation, so none is expected. Fail closed and name it.
function Assert-NoStrayExecutable {
  $cliFull = (Get-Item -LiteralPath $cliPath).FullName
  $stray = @(Get-ChildItem -LiteralPath (Join-Path $CliHome '.browserstack') -Recurse -Filter *.exe -File -ErrorAction SilentlyContinue |
    Where-Object { $_.FullName -ne $cliFull })
  foreach ($f in $stray) {
    Write-Summary "- UNEXPECTED executable under .browserstack: $($f.FullName) (SHA-256 $((Get-FileHash -LiteralPath $f.FullName -Algorithm SHA256).Hash)); the SDK may have run a binary that is not pinned"
  }
  if ($stray.Count -gt 0) { throw 'An unpinned executable exists under .browserstack after the run' }
}

function Invoke-CliRecheck {
  if (-not (Test-Path -LiteralPath $cliPath)) { throw "SDK CLI binary missing at $cliPath after the run" }
  $signatureError = $null
  try { Assert-Signed $cliPath $pins.cli.signer } catch { $signatureError = $_.Exception.Message }
  $sizeOk = (Get-Item -LiteralPath $cliPath).Length -eq $pins.cli.size
  $actualHash = (Get-FileHash -LiteralPath $cliPath -Algorithm SHA256).Hash
  $hashOk = $actualHash -eq $pins.cli.sha256.ToUpperInvariant()
  if ($signatureError) {
    Write-Summary "- SDK CLI binary FAILED signature verification after the run: $signatureError"
    Write-Summary '- ACTION REQUIRED: treat as a possible compromise. This binary ran with the BrowserStack access key: rotate the key and do not update the pins until the binary is explained.'
    throw 'SDK CLI signature check failed'
  }
  if (-not ($sizeOk -and $hashOk)) {
    Write-Summary "- SDK CLI binary no longer matches the pinned hash/size (actual SHA-256 $actualHash) but carries a VALID signature from '$($pins.cli.signer)'."
    Write-Summary '- This is most likely a legitimate BrowserStack release of a new CLI version. Review it, then update .github/browserstack-pins.json in a reviewed PR; the workflow stays red until then. Rotating the key is the owner''s call if the change cannot be accounted for.'
    throw 'SDK CLI differs from the pinned version'
  }
  Write-Summary "- SDK CLI binary re-verified after the run: SHA-256 $($pins.cli.sha256), signer '$($pins.cli.signer)'"
  Assert-NoStrayExecutable
}

switch ($Action) {
  'local-start' { Start-Local }
  'local-stop'  { Stop-Local }
  'cli-verify'  { Invoke-CliVerify }
  'cli-recheck' { Invoke-CliRecheck }
}
