[CmdletBinding()]
param(
  [string]$SiteName = "ToolAtlas",
  [string]$AppPoolName = "ToolAtlas",
  [string]$RootPath = "C:\ProgramData\ToolAtlas",
  [string]$DistPath = (Join-Path $PSScriptRoot "..\dist"),
  [ValidateRange(1, 65535)]
  [int]$Port = 8080,
  [ValidatePattern("^(?:\*|(?:\d{1,3}\.){3}\d{1,3})$")]
  [string]$ListenAddress = "127.0.0.1",
  [string]$HostHeader = "",
  [switch]$SkipWindowsFeatureInstall
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

function Assert-Administrator {
  $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
  $principal = [Security.Principal.WindowsPrincipal]::new($identity)
  if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    throw "Run this script from an elevated PowerShell session."
  }
}

function Enable-ToolAtlasIisFeatures {
  if ($SkipWindowsFeatureInstall) { return }

  if (Get-Command Install-WindowsFeature -ErrorAction SilentlyContinue) {
    $result = Install-WindowsFeature `
      Web-Server, Web-Static-Content, Web-Default-Doc, Web-Http-Errors, `
      Web-Http-Logging, Web-Filtering, Web-Mgmt-Console `
      -IncludeManagementTools
    if (-not $result.Success) { throw "Windows Server could not enable the required IIS features." }
    if ($result.RestartNeeded -eq "Yes") {
      Write-Warning "Windows reports that a restart is required before IIS is fully ready."
    }
    return
  }

  $features = @(
    "IIS-WebServerRole",
    "IIS-WebServer",
    "IIS-CommonHttpFeatures",
    "IIS-StaticContent",
    "IIS-DefaultDocument",
    "IIS-HttpErrors",
    "IIS-HealthAndDiagnostics",
    "IIS-HttpLogging",
    "IIS-Security",
    "IIS-RequestFiltering",
    "IIS-ManagementConsole"
  )
  Enable-WindowsOptionalFeature -Online -All -NoRestart -FeatureName $features | Out-Null
}

function Invoke-RobocopyMirror([string]$Source, [string]$Destination) {
  & robocopy.exe $Source $Destination /MIR /R:2 /W:2 /NFL /NDL /NJH /NJS /NP
  if ($LASTEXITCODE -gt 7) { throw "Robocopy failed with exit code $LASTEXITCODE." }
}

Assert-Administrator
$resolvedDist = [IO.Path]::GetFullPath($DistPath)
$resolvedRoot = [IO.Path]::GetFullPath($RootPath)
if ($resolvedRoot -eq [IO.Path]::GetPathRoot($resolvedRoot)) {
  throw "RootPath cannot be a drive root."
}
if (-not (Test-Path (Join-Path $resolvedDist "index.html") -PathType Leaf)) {
  throw "DistPath must contain a verified production index.html. Run pnpm verify first."
}
if ($ListenAddress -ne "*") {
  $parsedListenAddress = [IPAddress]::Parse($ListenAddress)
  if ($parsedListenAddress.AddressFamily -ne [Net.Sockets.AddressFamily]::InterNetwork) {
    throw "ListenAddress must be an IPv4 address or an explicit wildcard (*)."
  }
}

Enable-ToolAtlasIisFeatures
Import-Module WebAdministration

$sitePath = Join-Path $resolvedRoot "site"
$packagePath = Join-Path $resolvedRoot "packages"
$logPath = Join-Path $resolvedRoot "logs\iis"
$backupRoot = Join-Path $resolvedRoot "backups"
$siteConfig = Join-Path $PSScriptRoot "site.web.config"
$downloadConfig = Join-Path $PSScriptRoot "downloads.web.config"

New-Item -ItemType Directory -Force -Path $sitePath, $packagePath, $logPath, $backupRoot | Out-Null
if (Test-Path (Join-Path $sitePath "index.html") -PathType Leaf) {
  $backupPath = Join-Path $backupRoot ("site-" + (Get-Date -Format "yyyyMMdd-HHmmss"))
  New-Item -ItemType Directory -Force -Path $backupPath | Out-Null
  Invoke-RobocopyMirror $sitePath $backupPath
  Write-Host "Previous site saved to $backupPath"
}

Invoke-RobocopyMirror $resolvedDist $sitePath
Copy-Item $siteConfig (Join-Path $sitePath "web.config") -Force
Copy-Item $downloadConfig (Join-Path $packagePath "web.config") -Force
Remove-Item (Join-Path $sitePath "_headers") -Force -ErrorAction SilentlyContinue

if (-not (Test-Path "IIS:\AppPools\$AppPoolName")) {
  New-WebAppPool -Name $AppPoolName | Out-Null
}
Set-ItemProperty "IIS:\AppPools\$AppPoolName" -Name managedRuntimeVersion -Value ""
Set-ItemProperty "IIS:\AppPools\$AppPoolName" -Name processModel.identityType -Value ApplicationPoolIdentity
Set-ItemProperty "IIS:\AppPools\$AppPoolName" -Name processModel.idleTimeout -Value ([TimeSpan]::Zero)
Set-ItemProperty "IIS:\AppPools\$AppPoolName" -Name startMode -Value AlwaysRunning

$bindingInformation = "${ListenAddress}:${Port}:$HostHeader"
$site = Get-Website -Name $SiteName -ErrorAction SilentlyContinue
if ($null -eq $site) {
  New-Website -Name $SiteName -PhysicalPath $sitePath -ApplicationPool $AppPoolName -IPAddress $ListenAddress -Port $Port -HostHeader $HostHeader | Out-Null
} else {
  $bindings = @($site.Bindings.Collection | ForEach-Object { $_.bindingInformation })
  if ($bindings -notcontains $bindingInformation) {
    throw "Site '$SiteName' already exists with a different binding. Review it in IIS Manager instead of replacing it implicitly."
  }
  Set-ItemProperty "IIS:\Sites\$SiteName" -Name physicalPath -Value $sitePath
  Set-ItemProperty "IIS:\Sites\$SiteName" -Name applicationPool -Value $AppPoolName
}

$downloads = Get-WebVirtualDirectory -Site $SiteName -Name downloads -ErrorAction SilentlyContinue
if ($null -eq $downloads) {
  New-WebVirtualDirectory -Site $SiteName -Name downloads -PhysicalPath $packagePath | Out-Null
} else {
  Set-ItemProperty "IIS:\Sites\$SiteName\downloads" -Name physicalPath -Value $packagePath
}

Set-ItemProperty "IIS:\Sites\$SiteName" -Name serverAutoStart -Value $true
Set-ItemProperty "IIS:\Sites\$SiteName" -Name logFile.enabled -Value $true
Set-ItemProperty "IIS:\Sites\$SiteName" -Name logFile.logFormat -Value W3C
Set-ItemProperty "IIS:\Sites\$SiteName" -Name logFile.directory -Value $logPath
Set-ItemProperty "IIS:\Sites\$SiteName" -Name logFile.period -Value Daily

$poolIdentity = "IIS AppPool\$AppPoolName"
& icacls.exe $sitePath /grant "${poolIdentity}:(OI)(CI)(RX)" /T /C | Out-Null
if ($LASTEXITCODE -ne 0) { throw "Could not grant the application pool read access to the site." }
& icacls.exe $packagePath /grant "${poolIdentity}:(OI)(CI)(RX)" /T /C | Out-Null
if ($LASTEXITCODE -ne 0) { throw "Could not grant the application pool read access to the package directory." }
Set-Service W3SVC -StartupType Automatic
& sc.exe failure W3SVC reset= 86400 actions= restart/5000/restart/15000/restart/30000 | Out-Null
if ($LASTEXITCODE -ne 0) { throw "Could not configure W3SVC recovery actions." }
& sc.exe failureflag W3SVC 1 | Out-Null
if ($LASTEXITCODE -ne 0) { throw "Could not enable W3SVC recovery actions." }
Start-Service W3SVC
Start-WebAppPool -Name $AppPoolName
Start-Website -Name $SiteName

$probeAddress = if ($ListenAddress -eq "*") { "127.0.0.1" } else { $ListenAddress }
$headers = if ($HostHeader) { @{ Host = $HostHeader } } else { @{} }
$response = Invoke-WebRequest -UseBasicParsing -Uri "http://${probeAddress}:$Port/" -Headers $headers -TimeoutSec 10
if ($response.StatusCode -ne 200) { throw "Tool Atlas health probe returned HTTP $($response.StatusCode)." }

Write-Host "Tool Atlas is running as IIS site '$SiteName' at http://${ListenAddress}:$Port."
Write-Host "Packages: $packagePath"
Write-Host "Logs: $logPath"
Write-Host "Next: configure a reviewed HTTPS binding before exposing the site to users."
