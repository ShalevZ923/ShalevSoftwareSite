[CmdletBinding()]
param(
  [ValidateRange(1, 65535)]
  [int]$Port = 8080,
  [string]$HostName = "127.0.0.1",
  [switch]$BehindTlsProxy,
  [switch]$SkipBuild
)

$ErrorActionPreference = "Stop"

# Resolve repository root
$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $repoRoot

# 1. Verify Node.js
$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) {
  Write-Error "Node.js is not installed or not found in PATH. Please install Node.js 24 LTS to run Tool Atlas."
  exit 1
}

# 2. Build with npm.cmd to avoid the PowerShell npm.ps1 execution-policy shim.
$distIndex = Join-Path $repoRoot "dist/index.html"
if ($SkipBuild) {
  if (-not (Test-Path $distIndex -PathType Leaf)) {
    throw "-SkipBuild requires dist/index.html. Run npm.cmd run build first."
  }
} else {
  $npm = Get-Command npm.cmd -ErrorAction SilentlyContinue
  if (-not $npm) {
    throw "npm.cmd is not installed or not found in PATH. Install Node.js 24 LTS with npm."
  }
  Write-Host "Building Tool Atlas with npm..." -ForegroundColor Cyan
  & $npm.Source run build
  if ($LASTEXITCODE -ne 0) {
    throw "Build failed. Run npm.cmd ci, then npm.cmd run build and resolve any errors before starting the server."
  }
  if (-not (Test-Path $distIndex -PathType Leaf)) {
    throw "Build did not produce dist/index.html."
  }
}

# 3. Launch the Server
$env:PORT = $Port
$env:HOST = $HostName
if ($BehindTlsProxy) {
  $env:TOOL_ATLAS_BEHIND_TLS_PROXY = "true"
} else {
  Remove-Item Env:TOOL_ATLAS_BEHIND_TLS_PROXY -ErrorAction SilentlyContinue
}

Write-Host "Starting Tool Atlas Server on port $Port..." -ForegroundColor Green
& node scripts/server.mjs
