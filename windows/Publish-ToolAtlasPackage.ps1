[CmdletBinding(SupportsShouldProcess = $true)]
param(
  [Parameter(Mandatory = $true)]
  [ValidatePattern("^[a-z0-9]+(?:-[a-z0-9]+)*$")]
  [string]$ToolId,
  [Parameter(Mandatory = $true)]
  [ValidatePattern("^[A-Za-z0-9][A-Za-z0-9._-]*$")]
  [string]$Version,
  [Parameter(Mandatory = $true)]
  [string]$SourcePath,
  [Parameter(Mandatory = $true)]
  [ValidatePattern("^[A-Fa-f0-9]{64}$")]
  [string]$ExpectedSha256,
  [string]$RootPath = "C:\ProgramData\ToolAtlas",
  [switch]$Force
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest
$allowedSuffixes = @(".exe", ".msi", ".msix", ".zip", ".dmg", ".pkg", ".deb", ".rpm")

$source = Get-Item -LiteralPath $SourcePath
if ($source.PSIsContainer) { throw "SourcePath must identify one installer file." }
if ($source.Name -notmatch "^[A-Za-z0-9][A-Za-z0-9._-]*$") {
  throw "Installer filename contains unsupported characters."
}
if (-not ($allowedSuffixes | Where-Object { $source.Name.EndsWith($_, [StringComparison]::OrdinalIgnoreCase) })) {
  throw "Installer extension is not approved. Allowed: $($allowedSuffixes -join ', ')."
}

$sourceHash = (Get-FileHash -LiteralPath $source.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
if ($sourceHash -ne $ExpectedSha256.ToLowerInvariant()) {
  throw "SHA-256 mismatch. Expected $ExpectedSha256 but found $sourceHash."
}

$resolvedRoot = [IO.Path]::GetFullPath($RootPath)
if ($resolvedRoot -eq [IO.Path]::GetPathRoot($resolvedRoot)) {
  throw "RootPath cannot be a drive root."
}
$packageRoot = Join-Path $resolvedRoot "packages"
$destinationDirectory = Join-Path $packageRoot "$ToolId\$Version"
$destination = Join-Path $destinationDirectory $source.Name
$artifact = "$ToolId/$Version/$($source.Name)"
if ((Test-Path -LiteralPath $destination) -and -not $Force) {
  throw "Package already exists. Use -Force only after approving a replacement."
}
if (-not $PSCmdlet.ShouldProcess($destination, "Publish verified package $sourceHash")) { return }

New-Item -ItemType Directory -Force -Path $destinationDirectory | Out-Null
$temporary = Join-Path $destinationDirectory ("." + $source.Name + ".partial-" + [Guid]::NewGuid().ToString("N"))
$backup = $null
try {
  Copy-Item -LiteralPath $source.FullName -Destination $temporary
  $copiedHash = (Get-FileHash -LiteralPath $temporary -Algorithm SHA256).Hash.ToLowerInvariant()
  if ($copiedHash -ne $sourceHash) { throw "Copied package failed its SHA-256 verification." }

  if (Test-Path -LiteralPath $destination) {
    $backup = "$destination.previous-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
    Move-Item -LiteralPath $destination -Destination $backup
  }
  Move-Item -LiteralPath $temporary -Destination $destination
  Set-Content -LiteralPath "$destination.sha256" -Value "$sourceHash  $($source.Name)" -Encoding Ascii
} catch {
  Remove-Item -LiteralPath $temporary -Force -ErrorAction SilentlyContinue
  if ($backup -and -not (Test-Path -LiteralPath $destination) -and (Test-Path -LiteralPath $backup)) {
    Move-Item -LiteralPath $backup -Destination $destination
  }
  throw
}

Write-Host "Published $destination"
Write-Host "SHA-256: $sourceHash"
Write-Host "Catalog release line: $Version | artifact:$artifact"
if ($backup) { Write-Host "Previous package retained at $backup" }
