[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$version = "1.8.2"
$filename = "jq-windows-amd64.exe"
$expectedSha256 = "a6fc67fedaf9128a3309a1e2ebb8b986aeccf70122ee46d2cb4849e423f0c627"
$downloadUrl = "https://github.com/jqlang/jq/releases/download/jq-1.8.2/jq-windows-amd64.exe"
$temporaryPath = Join-Path ([IO.Path]::GetTempPath()) $filename
$publishedPath = "/server/packages/jq/$version/$filename"

if (Test-Path -LiteralPath $publishedPath -PathType Leaf) {
  $publishedHash = (Get-FileHash -LiteralPath $publishedPath -Algorithm SHA256).Hash.ToLowerInvariant()
  if ($publishedHash -ne $expectedSha256) {
    throw "The existing hosted jq file has an unexpected SHA-256 digest: $publishedHash"
  }
  Write-Host "Hosted jq $version is already present with the approved SHA-256 digest."
  exit 0
}

try {
  Write-Host "Downloading the official jq $version Windows executable..."
  Invoke-WebRequest -Uri $downloadUrl -OutFile $temporaryPath -MaximumRedirection 5
  & /workspace/windows/Publish-ToolAtlasPackage.ps1 `
    -ToolId "jq" `
    -Version $version `
    -SourcePath $temporaryPath `
    -ExpectedSha256 $expectedSha256 `
    -RootPath "/server"
} finally {
  Remove-Item -LiteralPath $temporaryPath -Force -ErrorAction SilentlyContinue
}
