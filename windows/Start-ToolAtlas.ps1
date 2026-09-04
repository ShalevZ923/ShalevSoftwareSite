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
  Write-Error "Node.js is not installed or not found in PATH. Please install Node.js 18+ to run Tool Atlas."
  exit 1
}

# 2. Check dist/ directory
$distPath = Join-Path $repoRoot "dist"
if (-not (Test-Path $distPath) -and -not $SkipBuild) {
  Write-Host "Production build not found in $distPath. Running initial build..." -ForegroundColor Cyan
  $pnpm = Get-Command pnpm -ErrorAction SilentlyContinue
  if ($pnpm) {
    & pnpm run build
  } else {
    & npm run build
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
