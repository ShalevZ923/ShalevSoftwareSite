[CmdletBinding()]
param(
  [string]$SiteName = "ToolAtlas",
  [string]$AppPoolName = "ToolAtlas",
  [ValidateRange(1, 65535)]
  [int]$Port = 8080,
  [ValidatePattern("^(?:\d{1,3}\.){3}\d{1,3}$")]
  [string]$ProbeAddress = "127.0.0.1",
  [string]$HostHeader = ""
)

$ErrorActionPreference = "Stop"
Import-Module WebAdministration

Get-Service WAS, W3SVC | Select-Object Name, Status, StartType
Get-Website -Name $SiteName | Select-Object Name, Id, State, PhysicalPath, Bindings
Get-WebAppPoolState -Name $AppPoolName

$headers = if ($HostHeader) { @{ Host = $HostHeader } } else { @{} }
try {
  $response = Invoke-WebRequest -UseBasicParsing -Uri "http://${ProbeAddress}:$Port/" -Headers $headers -TimeoutSec 10
  [PSCustomObject]@{ Probe = "Tool Atlas"; StatusCode = $response.StatusCode; Healthy = ($response.StatusCode -eq 200) }
} catch {
  [PSCustomObject]@{ Probe = "Tool Atlas"; StatusCode = $null; Healthy = $false; Error = $_.Exception.Message }
  exit 1
}
