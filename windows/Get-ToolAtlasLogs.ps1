[CmdletBinding()]
param(
  [string]$SiteName = "ToolAtlas",
  [ValidateRange(1, 5000)]
  [int]$Tail = 100,
  [switch]$ErrorsOnly,
  [switch]$Follow,
  [switch]$IncludeServiceEvents
)

$ErrorActionPreference = "Stop"
Import-Module WebAdministration
$site = Get-Website -Name $SiteName
$configuredLogPath = (Get-ItemProperty "IIS:\Sites\$SiteName" -Name logFile.directory).Value
$logRoot = [Environment]::ExpandEnvironmentVariables($configuredLogPath)
$siteLogPath = Join-Path $logRoot "W3SVC$($site.Id)"
$logFile = if (Test-Path -LiteralPath $siteLogPath -PathType Container) {
  Get-ChildItem -LiteralPath $siteLogPath -Filter "*.log" -File |
    Sort-Object LastWriteTimeUtc -Descending |
    Select-Object -First 1
} else {
  $null
}

if ($null -eq $logFile) {
  Write-Warning "No IIS access log exists yet at $siteLogPath. Send one request and try again."
} elseif ($Follow) {
  if ($ErrorsOnly) { Write-Warning "Follow mode emits raw W3C lines; apply filtering after capture." }
  Get-Content -LiteralPath $logFile.FullName -Tail $Tail -Wait
} elseif ($ErrorsOnly) {
  $lines = Get-Content -LiteralPath $logFile.FullName
  $fieldLine = $lines | Where-Object { $_ -like "#Fields:*" } | Select-Object -Last 1
  if (-not $fieldLine) { throw "The IIS W3C log does not contain a #Fields header." }
  $fields = $fieldLine.Substring(8).Trim().Split(" ")
  $statusIndex = [Array]::IndexOf($fields, "sc-status")
  if ($statusIndex -lt 0) { throw "The IIS W3C log does not include sc-status." }
  $lines | Where-Object { $_ -and -not $_.StartsWith("#") } | ForEach-Object {
    $values = $_.Split(" ")
    if ($values.Count -gt $statusIndex -and [int]$values[$statusIndex] -ge 400) { $_ }
  } | Select-Object -Last $Tail
} else {
  Get-Content -LiteralPath $logFile.FullName -Tail $Tail
}

if ($IncludeServiceEvents -and -not $Follow) {
  Write-Host "`nRecent IIS/WAS service events:"
  Get-WinEvent -FilterHashtable @{ LogName = "System"; StartTime = (Get-Date).AddDays(-1) } -MaxEvents 500 |
    Where-Object { $_.ProviderName -match "WAS|W3SVC|IIS" } |
    Select-Object -First 50 TimeCreated, LevelDisplayName, ProviderName, Id, Message
}
