# Windows deployment and operations

Tool Atlas can run on a supported Windows Server or Windows Pro/Enterprise workstation using IIS. IIS is the only runtime service: the React application and installers remain static files, so this deployment does not add an application backend, database, account system, or log-ingestion API.

## Architecture

```text
User browser
    |
    | HTTPS
    v
IIS site (ToolAtlas application pool)
    |-- C:\ProgramData\ToolAtlas\site       verified React build
    |-- /downloads virtual directory
        -> C:\ProgramData\ToolAtlas\packages\tool-id\version\installer

IIS W3C logs -> C:\ProgramData\ToolAtlas\logs\iis\W3SVC<site-id>
IIS/WAS failures -> Windows System event log
```

IIS directory browsing is disabled. The package virtual directory allows only reviewed installer/archive extensions and adds `Content-Disposition: attachment`, so a valid package request starts a download. The catalog contains a public relative pointer, not a filesystem path. A browser must still request a URL to download a file; hiding that request requires an authenticated backend and is outside this deployment.

## 1. Prepare and approve a release

Build on a trusted machine from the reviewed commit:

```powershell
corepack enable
pnpm install --frozen-lockfile
pnpm verify
```

Copy these items to a controlled staging directory on the Windows host:

- The generated `dist` directory.
- The repository's `windows` directory.
- Each approved installer to be published.
- The expected SHA-256 digest obtained from the vendor or your internal release process.

Do not place credentials, license keys, private contracts, or personal data in the site, package directory, catalog metadata, or PowerShell arguments.

## 2. Install or update the IIS site

Open **PowerShell as Administrator** from the repository checkout or staged release directory:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy RemoteSigned
.\windows\Install-ToolAtlas.ps1 -DistPath .\dist -Port 8080
```

The installer is idempotent for the same site and binding. It:

1. Enables the minimum IIS static-content, logging, filtering, errors, and management features.
2. Mirrors the verified `dist` output into `C:\ProgramData\ToolAtlas\site`.
3. Saves the previous site under `C:\ProgramData\ToolAtlas\backups` before replacement.
4. Creates a dedicated `ToolAtlas` application pool using `ApplicationPoolIdentity`.
5. Maps `/downloads` to the separate read-only package directory.
6. Enables daily W3C access logs.
7. Makes W3SVC start automatically and configures three Service Control Manager restart attempts.
8. Starts the site and requires a successful local HTTP health probe.

The default binding is limited to `127.0.0.1`. Use `-SkipWindowsFeatureInstall` only after the required features are managed separately. If an existing site has a different binding, the script stops instead of replacing it.

### HTTPS is a production gate

The script uses a loopback-only HTTP binding for a predictable local health check. Before allowing user traffic, terminate TLS at IIS or an approved reverse proxy. In IIS Manager, add an HTTPS binding using a certificate whose subject covers the user-facing hostname, verify the full chain, then keep the HTTP listener on loopback or replace it with a reviewed redirect. Use `-ListenAddress` only when an explicit non-loopback HTTP binding is approved; `-ListenAddress "*"` is never a production substitute for HTTPS.

Microsoft's IIS guidance covers [setting up SSL](https://learn.microsoft.com/en-us/iis/manage/configuring-security/how-to-set-up-ssl-on-iis), [application-pool isolation](https://learn.microsoft.com/en-us/iis/manage/configuring-security/application-pool-identities), and [application-pool lifecycle settings](https://learn.microsoft.com/en-us/iis/configuration/system.applicationhost/applicationpools/).

## 3. Publish an installer on the same server

Publish the file before merging its catalog pointer. The command refuses replacements unless `-Force` is explicit and verifies the copied bytes:

```powershell
.\windows\Publish-ToolAtlasPackage.ps1 `
  -ToolId "intellij" `
  -Version "2025.1" `
  -SourcePath "D:\Approved\ideaIU-2025.1.exe" `
  -ExpectedSha256 "REPLACE_WITH_64_HEX_CHARACTERS"
```

The command prints the exact catalog line:

```text
2025.1 | artifact:intellij/2025.1/ideaIU-2025.1.exe
```

Put that release in the canonical entry under
`content/catalog/<category>/<vendor>/<tool>/releases/<version>.json`, then
regenerate, review, and deploy the updated application. Do not edit
`src/generated/catalog.ts` directly:

```powershell
pnpm catalog:build
pnpm verify
.\windows\Install-ToolAtlas.ps1 -DistPath .\dist -Port 8080 -SkipWindowsFeatureInstall
```

The physical file is stored at `C:\ProgramData\ToolAtlas\packages\intellij\2025.1\ideaIU-2025.1.exe`. The browser receives `/downloads/intellij/2025.1/ideaIU-2025.1.exe`; it never receives the Windows path. Keep the generated `.sha256` sidecar for operator verification. IIS rejects sidecars and unapproved extensions.

If installation used a custom `-RootPath`, pass the same value to the publisher. The publisher derives its package directory as `<RootPath>\packages`; it rejects drive-root destinations. `-ExpectedSha256` is mandatory and must come from an independent vendor or internal release-approval source.

## 4. Status and logs from the command line

Check service, application-pool, site, and HTTP probe state:

```powershell
.\windows\Get-ToolAtlasStatus.ps1 -Port 8080
```

For an explicitly configured non-loopback listener, also pass its address with `-ProbeAddress`.

Show the most recent requests:

```powershell
.\windows\Get-ToolAtlasLogs.ps1 -Tail 100
```

Show HTTP failures and recent IIS/WAS service events:

```powershell
.\windows\Get-ToolAtlasLogs.ps1 -ErrorsOnly -IncludeServiceEvents
```

Follow the active W3C log:

```powershell
.\windows\Get-ToolAtlasLogs.ps1 -Tail 20 -Follow
```

IIS uses W3C access logs by default and writes process/service failures to Windows Event Log. No log leaves the workstation or server. If central log collection is added later, treat it as a separate security and privacy project with authenticated transport, retention limits, redaction, and operator approval. See Microsoft's [IIS site logging reference](https://learn.microsoft.com/en-us/iis/configuration/system.applicationhost/sites/site/logfile/).

## 5. Verify downloads

Directory and invalid requests must fail, while the exact file returns an attachment:

```powershell
$base = "http://127.0.0.1:8080"
Invoke-WebRequest -UseBasicParsing "$base/downloads" -ErrorAction SilentlyContinue
Invoke-WebRequest -UseBasicParsing "$base/downloads/intellij/2025.1/ideaIU-2025.1.exe" -OutFile "$env:TEMP\ideaIU-2025.1.exe"
Get-FileHash "$env:TEMP\ideaIU-2025.1.exe" -Algorithm SHA256
```

From a user workstation, confirm the HTTPS response has `Content-Disposition: attachment`, `X-Content-Type-Options: nosniff`, and the expected content length. Confirm `/downloads`, `/downloads/<tool>`, `.sha256`, `.config`, partial, and previous-package paths are not retrievable. IIS directory browsing is documented in Microsoft's [`directoryBrowse` reference](https://learn.microsoft.com/en-us/iis/configuration/system.webserver/directorybrowse).

## 6. Recovery and rollback

### Site update failed

1. Stop the site: `Stop-Website ToolAtlas`.
2. Select the reviewed backup under `C:\ProgramData\ToolAtlas\backups`.
3. Mirror that backup back to `C:\ProgramData\ToolAtlas\site` with `robocopy <backup> C:\ProgramData\ToolAtlas\site /MIR`.
4. Start the site: `Start-Website ToolAtlas`.
5. Run `Get-ToolAtlasStatus.ps1` and inspect access/service logs.

Package files are outside the site mirror and are not changed by application rollback.

### Package replacement failed

The publisher copies and hashes a temporary file before making it visible. With `-Force`, the former package is retained beside the new file with a `.previous-<timestamp>` suffix, which IIS cannot serve. Move the reviewed previous file back to its original name, rerun the hash check, and restore the matching catalog pointer/build.

### Repeated service failure

The Service Control Manager attempts three W3SVC restarts. If IIS remains stopped, do not loop restarts indefinitely: inspect `Get-ToolAtlasLogs.ps1 -IncludeServiceEvents`, Windows Update/restart state, port conflicts, certificate bindings, disk capacity, and package/site ACLs. Correct the root cause, then run `Start-Service W3SVC` and the status script.

## 7. Security and operational checklist

- Keep Windows and IIS within vendor support and fully patched.
- Use HTTPS before exposing the site beyond a trusted management network.
- Allow the application-pool identity read-only access; administrators or the release process retain write access.
- Approve every installer and SHA-256 digest before publishing it.
- Treat artifact pointers as public metadata, never as authorization or secrecy.
- Retain IIS logs according to organizational policy and protect them from non-administrator modification.
- Back up the site configuration, reviewed site build, package repository, checksums, and TLS certificate recovery material.
- Test service restart, site rollback, package rollback, attachment behavior, and log collection before production acceptance.
