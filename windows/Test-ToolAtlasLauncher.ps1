[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
$sourceRoot = Split-Path $PSScriptRoot -Parent
$fixture = Join-Path ([System.IO.Path]::GetTempPath()) ("Tool Atlas acceptance " + [guid]::NewGuid())
$process = $null
try {
  New-Item -ItemType Directory -Path $fixture | Out-Null
  foreach ($name in @("scripts", "windows", "content", "docs", "dist")) {
    Copy-Item -LiteralPath (Join-Path $sourceRoot $name) -Destination $fixture -Recurse
  }
  Copy-Item -LiteralPath (Join-Path $sourceRoot "package.json") -Destination $fixture
  # ESM imports resolve from the disposable server's root. Reuse the fresh,
  # read-only dependency installation without copying operator authoring state.
  $dependencyLink = Join-Path $fixture "node_modules"
  New-Item -ItemType Junction -Path $dependencyLink -Target (Join-Path $sourceRoot "node_modules") | Out-Null
  # The copy cannot inherit an operator's recovery journals or authoring packages.
  Get-ChildItem -LiteralPath $fixture -Filter ".tool-atlas-state" -Directory -Recurse -Force |
    Remove-Item -Recurse -Force
  New-Item -ItemType Directory -Path (Join-Path $fixture "packages"), (Join-Path $fixture "guide-library") | Out-Null

  $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, 0)
  $listener.Start()
  $port = $listener.LocalEndpoint.Port
  $listener.Stop()
  $start = [System.Diagnostics.ProcessStartInfo]::new("pwsh")
  foreach ($argument in @("-NoProfile", "-File", (Join-Path $fixture "windows/Start-ToolAtlas.ps1"), "-SkipBuild", "-Port", "$port")) {
    $start.ArgumentList.Add($argument)
  }
  $start.UseShellExecute = $false
  $start.RedirectStandardOutput = $true
  $start.RedirectStandardError = $true
  $process = [System.Diagnostics.Process]::Start($start)
  # Drain private startup output without exposing its ephemeral Studio token in CI.
  $stdout = $process.StandardOutput.ReadToEndAsync()
  $stderr = $process.StandardError.ReadToEndAsync()
  $ready = $false
  for ($attempt = 0; $attempt -lt 40; $attempt++) {
    if ($process.HasExited) { throw "Native launcher exited before readiness: $($process.ExitCode)" }
    try {
      $health = Invoke-WebRequest -Uri "http://127.0.0.1:$port/api/health" -TimeoutSec 2
      if ($health.StatusCode -eq 200) { $ready = $true; break }
    } catch { Start-Sleep -Milliseconds 250 }
  }
  if (-not $ready) { throw "Native launcher did not become ready" }
  $catalog = Invoke-RestMethod -Uri "http://127.0.0.1:$port/api/catalog" -TimeoutSec 5
  if (-not $catalog.tools -or -not ($catalog.tools | Where-Object { $_.id -eq "intellij" })) {
    throw "Native catalog hierarchy did not load the expected entry"
  }
  $agents = Invoke-RestMethod -Uri "http://127.0.0.1:$port/api/agents" -TimeoutSec 5
  if (-not ($agents | Where-Object { $_.id -eq "anthropic-pdf" })) {
    throw "Native agent hierarchy did not load the expected entry"
  }
  $page = Invoke-WebRequest -Uri "http://127.0.0.1:$port/" -TimeoutSec 5
  if ($page.StatusCode -ne 200 -or $page.Content -notmatch 'id="root"') { throw "Native static build was not served" }
  Write-Host "Native Windows launcher, path-with-spaces, filesystem and HTTP acceptance passed."
} finally {
  if ($process -and -not $process.HasExited) {
    $process.Kill($true)
    $process.WaitForExit()
  }
  # Remove the junction itself before recursively deleting the disposable tree.
  if ($dependencyLink -and (Test-Path -LiteralPath $dependencyLink)) {
    Remove-Item -LiteralPath $dependencyLink -Force
  }
  if (Test-Path -LiteralPath $fixture) { Remove-Item -LiteralPath $fixture -Recurse -Force }
}
