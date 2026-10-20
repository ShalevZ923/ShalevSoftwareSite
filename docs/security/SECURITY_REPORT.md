# Security report

**Assessment date:** 2026-09-19 for the software catalog, with an Agent Catalog review on 2026-09-25
**Scope:** the current React application, the optional local Developer Studio Node.js server, hosted-release metadata, its NGINX container, the Docker Compose/Caddy deployment, the Windows IIS deployment, documented operating procedures, and the experimental Agent Catalog on this `v1.8.0` line.
**Method:** source-backed static review and local configuration validation. No public hostname, DNS record, live certificate, running production container, or external vulnerability feed was tested. The 2026-09-25 review did not repeat the container, Caddy, or IIS probes from 2026-09-19.

The published image remains `ghcr.io/shalevz923/shalevsoftwaresite:1.7.0`. That image serves only the static software catalog. Agent listings, evaluation ZIPs, and the Agent Catalog default page exist on this branch and are not part of `v1.7.0`.

## Executive summary

The production application has a small public attack surface: its Docker and IIS deployments remain static, with no login, write API, database, or application secret. The optional Developer Studio is a separate local authoring mode with bearer-authenticated filesystem-write APIs and must not be treated as the public deployment.

The Agent Catalog on this branch uses that same static production boundary. Listings are for evaluation. A browser can offer a same-origin ZIP only after content gates and a HEAD check for an attachment. The browser does not hash the downloaded bytes. Developer Studio can write agent files only with the local bearer token, and the production image does not include that server.

The previous direct-container pattern published plaintext HTTP on port 8080. It is remediated by the tracked Compose deployment; do not use the old `docker run -p 8080:8080` pattern in production.

**Deployment decision:** the software catalog remains conditionally ready. Complete the DNS, firewall, certificate-issuance, image-provenance, and current-CVE checks listed below before promoting a public hostname. The Agent Catalog on this branch stays experimental and is not approved for the published `1.7.0` image.

## Architecture and trust boundaries

| Boundary | Control | Evidence |
| --- | --- | --- |
| Visitor to edge | Caddy obtains an ACME certificate, redirects HTTP to HTTPS, and adds HSTS. | `Caddyfile`, `compose.yaml` |
| Public host to application | Only `proxy` publishes 80/443; `app` is attached only to the Docker-internal `app_network`. | `compose.yaml` |
| Proxy to static origin | Caddy reverse-proxies to `app:8080` on the internal network. | `Caddyfile` |
| Origin process | NGINX runs as `nginx`, has a read-only root filesystem in Compose, a small `/tmp` tmpfs, no capabilities, and no host port. | `Dockerfile`, `compose.yaml` |
| Browser rendering | CSP, no-sniff, anti-framing, restrictive permissions/referrer policies, COOP/CORP, safe Markdown links, and local-only guide images. | `nginx.conf`, `src/markdown.tsx`, `src/trustedMedia.ts` |
| Hosted installers | Catalog pointers are restricted to `tool-id/version/filename`; IIS/NGINX map those public identifiers to a separate read-only package directory, disable listing, allow reviewed extensions, and force attachment responses. | `scripts/catalog-content.mjs`, `src/downloads.ts`, `windows/downloads.web.config`, `nginx.conf` |
| Windows lifecycle and logs | IIS uses an isolated application-pool identity, W3SVC automatic startup/recovery, W3C file logs, and Windows Event Log diagnostics without a remote logging API. | `windows/Install-ToolAtlas.ps1`, `windows/Get-ToolAtlasLogs.ps1` |
| Catalog contribution | Local content is schema-validated before generation; public Issue Form data can create a PR only after a trusted maintainer applies `catalog-approved`. | `scripts/catalog-content.mjs`, `.github/workflows/catalog-issue-to-pr.yml` |
| GitLab catalog contribution | A GitLab template is untrusted input; a manually triggered default-branch job rechecks `catalog-approved` before a protected project token can create a branch and merge request. | `.gitlab/issue_templates/Add catalog software.md`, `.gitlab-ci.yml` |
| Local Developer Studio | Loopback is the default; non-loopback startup requires an explicit TLS-proxy assertion; bootstrap credentials use a URL fragment and protected APIs accept headers rather than query tokens. | `scripts/server.mjs`, `src/App.tsx`, `windows/Start-ToolAtlas.ps1` |
| Edge logs | Caddy JSON access logs are the visitor-IP record at the public edge. NGINX JSON access/error to stdout/stderr includes `/downloads/…`; `remote` is the visitor after `X-Forwarded-For` from Caddy. NGINX trusts that header only from private Docker peers. | `Caddyfile`, `nginx.conf` |
| Companion MCP | Separate image. It reads `/catalog/v1` and never runs inside the catalog NGINX container. | `docs/CATALOG_MACHINE_FEED.md` |
| Agent content | Listings reject external download URLs, registry install commands, and public SaaS MCP hosts. `supported` requires review evidence, a pinned source, a license, assessed risk, verified compatibility, and an assigned owner. | `scripts/agents-content.mjs` |
| Agent archives | The ZIP auditor rejects traversal, unsafe names, Unix symlinks, encryption, ZIP64, overlap, and files that are missing from or extra to the release contents list. | `scripts/inspect-agent-zip.mjs` |
| Agent delivery | The browser offers a ZIP only for a supported or evaluation listing with a reviewed current version, pinned source, license, assessed risk, archive root, contents, SHA-256, and a same-origin `.zip` that HEAD-checks as an attachment. VS Code MCP install requires `supported`, review, and verified VS Code compatibility. | `src/agentDelivery.ts` |
| Agent guides | Usage guides use the same Markdown renderer as software guides: no raw HTML, and images stay on local `/tool-images/` paths. | `src/markdown.tsx`, `src/components/AgentCatalog.tsx` |
| Agent publication | The GitLab agent template is maintainer-authored intake. The software-catalog merge-request job does not create agent files. | `.gitlab/issue_templates/Add catalog agent.md`, `docs/AIRGAPPED_AGENT_CATALOG.md` |

## Findings

### Resolved: plaintext public deployment — Medium (CWE-319)

The former README instructed operators to map host port 8080 directly to an HTTP-only NGINX server. An on-path attacker could have modified pages, scripts, headers, or software download guidance. The replacement Compose stack exposes only Caddy on 80/443, obtains a public certificate automatically, and keeps the application origin internal. Validate certificate issuance and an HTTP-to-HTTPS redirect before go-live.

### Resolved: mutable container image tags — Low (CWE-494)

The original Docker build used mutable Node and NGINX tags. The deployment now pins Node, NGINX, and Caddy to exact `@sha256:` digests, so an unchanged repository resolves the same image bytes. JavaScript installation also uses `pnpm install --frozen-lockfile`.

**Ongoing release control:** record review of every new digest and verify image signatures/provenance plus current CVEs before replacing a pin. Digest pinning prevents tag drift; it does not establish that a reviewed digest is vulnerability-free or signed by a trusted publisher.

### Resolved: cache locations dropped NGINX security headers — Low (CWE-693)

NGINX does not inherit server-level `add_header` directives into a location that defines another `add_header`. The previous HTML and asset locations set only `Cache-Control`, so real responses omitted CSP, anti-framing, no-sniff, and the other server-level protections. Cache selection now uses one server-level mapped value, keeping every security header on HTML and assets while preserving `no-store` for application routes, a short public cache for `/catalog/v1/*.json`, and immutable caching for fingerprinted assets.

### Resolved: Developer Studio token and path handling — Medium/Low

The local server previously printed its bearer token in a query-string URL, accepted query tokens on protected APIs, defaulted to all network interfaces, decoded malformed percent escapes outside its error boundary, and used a string-prefix check for static-root containment. The server now defaults to loopback, requires an explicit TLS-proxy assertion before non-loopback startup, bootstraps through a URL fragment, accepts protected-route tokens only in headers, returns 400 for malformed encodings, and uses path-segment-aware containment. Regression tests cover each original trigger and confirm the process remains healthy after malformed input.

### Controlled: catalog Issue Form automation

Catalog submissions from the public Issue Form are untrusted input. They receive only the `catalog-submission` label and cannot start the write-capable workflow. A maintainer must apply `catalog-approved`; the workflow then parses the structured issue body, validates the same content rules used locally, runs `pnpm verify`, and opens a pull request instead of publishing directly. The workflow uses a commit-pinned checkout action.

**Required operating control:** restrict the `catalog-approved` label to trusted maintainers, keep GitHub Actions' token permission able to create branches and pull requests, and review the generated PR normally. Never add a label-triggered workflow that runs unreviewed issue text as shell code.

### Controlled: GitLab Issue Template automation

GitLab issue templates standardize the same untrusted submission fields. Because GitLab CI does not start a pipeline directly from an issue-label event, the maintainer supplies the non-secret issue IID when manually starting a default-branch pipeline; the job verifies that the issue remains open and labeled `catalog-approved` before calling the GitLab API. The API token is used only from the protected CI variable `GITLAB_CATALOG_MR_TOKEN`, and the job creates a merge request rather than publishing a change.

**Required operating control:** use a short-lived Developer project access token with only the `api` scope, mark it masked, hidden, and protected, and never set it as a manual pipeline variable. Restrict manual-pipeline execution and the approval label to maintainers.

### Controlled: same-server installer downloads

Hosted artifact pointers are public relative identifiers compiled into the static JavaScript bundle. Validation rejects traversal, arbitrary paths, mismatched tool/version segments, and releases containing both target forms. IIS and NGINX disable directory listing and use attachment responses, but anyone who can download a package can observe and reuse its request URL.

**Required operating control:** approve and hash every installer before publishing, grant the web-service identity read-only access, expose downloads only over HTTPS, and remove obsolete packages after their catalog references and rollback window are closed. If per-user authorization, expiring links, download auditing by identity, or hidden object identifiers become requirements, introduce a reviewed authenticated backend rather than treating path obscurity as access control.

The Windows installer defaults its initial HTTP binding to loopback, avoids granting the machine-wide `IIS_IUSRS` group write access to Tool Atlas logs, and requires an independently supplied SHA-256 digest before package publication. A user-facing IIS HTTPS binding remains an explicit production acceptance gate.

### Controlled: experimental Agent Catalog downloads

Agent ZIPs reuse the hosted-installer boundary. Content rules allow only a same-server `.zip` whose id and version match the release. NGINX still allowlists `/downloads/<id>/<version>/<file>.zip`, forces `Content-Disposition: attachment`, and uses `Cache-Control: private, no-store`. The browser shows a download only when those content gates pass and a HEAD response looks like an attachment, zip, or octet-stream. That HEAD check confirms presence and response shape. It does not compare bytes with the published SHA-256.

Evaluation listings can be downloaded when those gates pass. The catalog labels them for testing and does not treat them as approved software releases. Anyone who can fetch a published ZIP can reuse its URL. Approve and hash every archive before publication, and keep evaluation bytes off the `v1.7.0` image.

### Resolved: Vite development download traversal — Low (CWE-22)

The local Vite preview serves `packages/` under `/downloads`. A request whose decoded path stays under `/downloads/` and contains `..` now returns 404 before the file handler. The handler also rejects a pathname containing `..`, limits names to the agent ZIP pattern, and checks that the real path stays inside `packages/`. Production NGINX already returns 404 for any `/downloads/` URI outside its allowlist, and the production image does not contain the Vite server or the repository tree.

A client that normalizes `/downloads/../package.json` to `/package.json` before the request leaves the download handler and can receive a Vite project file. That is the development file server, not the download boundary. Do not expose the Vite server as the public origin.

### Controlled: evaluation package content

The four packaged evaluation archives are pinned snapshots with recorded SHA-256 values. Internal Comms and Theme Factory are instruction and asset files. Their text can change an agent's output, so readers should review the guide before enabling a skill. The Time MCP server source that was read does not itself open a network connection or write user files. Installing its lockfile can reach a package registry, and that dependency tree has not had a separate security audit. A complete MCP stdio session was not verified, and the listing does not offer a one-click VS Code install. The PDF example is not packaged. OpenAI Developers and Atlas Repo MCP remain examples without a downloadable release. See `docs/AGENT_SOURCE_REVIEW.md`.

### Controlled: Developer Studio agent writes

Agent create and update routes live under `/api/developer/agents` and require the startup bearer token. Saves run the same validator as checked-in content, refuse a `supported` status without evidence, and keep writes inside the agent content directory. The unauthenticated `GET /api/agents` feed exists only on this local server and returns listing metadata, not guide text. The NGINX image has no `/api` process.

**Required operating control:** keep Developer Studio on loopback. Apply `catalog-approved` to an agent only after a person has reviewed the ZIP bytes, license, permissions, and release metadata. Run `pnpm agents:artifacts` against the staged package volume before that volume is mounted for download.

## Verified non-findings

- Query-string filters are allowlisted and rendered as React text, not HTML (`src/catalog.ts`).
- Browser-local saved tools are parsed defensively and restricted to known static IDs (`src/catalogStorage.ts`).
- Markdown does not enable raw HTML; links are limited to HTTPS, `mailto:`, and local fragments, while images are limited to local `/tool-images/` paths (`src/trustedMedia.ts`, `src/markdown.tsx`).
- The static production deployments have no server-side authentication or filesystem-write path. The optional Developer Studio does, and remains limited to trusted local authoring rather than production publication.
- Hosted files are published only by an administrator-run PowerShell command; the public static site has no upload or filesystem-write path.
- The static origin returns a CSP, nosniff, anti-framing, referrer, permissions, COOP, and CORP headers (`nginx.conf`). It accepts only GET and HEAD requests and does not expose the static-host `_headers` file.
- Agent guides do not add a second Markdown parser or a raw-HTML path.
- Example listings without a reviewed ZIP do not receive a download target. Time MCP does not receive a VS Code install target while its status is `evaluation`.
- The production image remains NGINX-only. Building this branch does not add the Developer Studio process to that image (`Dockerfile`).

## Required production evidence

1. Confirm the DNS A/AAAA records point to the deployment host and that only TCP 80/443 are reachable from the internet.
2. Start the stack with the real, protected `.env`; confirm Caddy logs successful certificate issuance and renewal scheduling.
3. From an external network, verify the certificate hostname/chain, HTTP redirect, HSTS, CSP, and absence of port 8080.
4. Repeat `pnpm verify` and `pnpm audit --prod` for each release, and run a current vulnerability/provenance scan for the exact pinned image digests. This report does **not** assert current image-CVE status.
5. Back up and test restoration of `tool-atlas_caddy_data` and `tool-atlas_caddy_config`; loss can force new issuance and hit ACME rate limits.
6. Keep `.env` mode 0600, never commit it, and use a server-side secret manager if future backend credentials are introduced.
7. For Windows, configure and externally verify an approved HTTPS binding, patch level, firewall scope, read-only application-pool ACL, service recovery, W3C logging, package checksum, and rollback before acceptance.
8. Keep Developer Studio on loopback. If a reviewed network exception is required, terminate TLS at a trusted proxy, keep the origin private, restrict the firewall, and follow `docs/DEVELOPER_STUDIO.md`.
9. Do not publish this branch as `v1.7.0`. If an operator later promotes `v1.8.0`, stage only reviewed agent ZIPs, record each SHA-256, run `pnpm agents:artifacts` against that volume, and keep evaluation listings labeled as evaluation.

## Validation performed

- `pnpm verify` passed: 14 test files and 78 tests, TypeScript/Vite production build, and generated-artifact checks.
- `pnpm audit --prod` reported no known production dependency vulnerabilities on the assessment date.
- `pnpm catalog:check` validated all content files and confirmed the generated catalog module is current; `pnpm verify` confirmed the migrated catalog still renders and tests successfully.
- `docker compose --env-file .env.example config` rendered successfully with the required domain/contact variables and no public app port.
- The app image rebuilt successfully using the pinned Node and NGINX base-image digests.
- A live production-image probe returned the complete security-header set with `Cache-Control: no-store` for `/` and `/index.html`, immutable caching for a fingerprinted JavaScript asset, and a healthy container under the Compose-equivalent read-only/capability restrictions.
- A mounted hosted-package probe returned the exact SHA-256-reviewed bytes with `Content-Disposition: attachment`, `Cache-Control: private, no-store`, and the full security-header set. Directory, sidecar, missing-file, and unsupported-extension requests returned 404.
- Caddy accepted the final Caddyfile with example values and confirmed automatic HTTPS plus HTTP-to-HTTPS redirect configuration.
- NGINX passed `nginx -t` while run with the Compose-equivalent read-only filesystem, `/tmp` tmpfs, no capabilities, and no-new-privileges setting.
- Both IIS XML configuration files passed strict XML parsing. All PowerShell files passed the PowerShell parser, and the package publisher passed SHA-256 copy verification plus refusal of an overwrite without explicit `-Force`. IIS-specific commands still require validation on Windows.

### 2026-09-25 Agent Catalog review

- Source review of delivery gates, content rules, ZIP inspection, Vite download handling, Developer Studio agent routes, and the NGINX download allowlist.
- `pnpm exec vitest run src/agentDelivery.test.ts src/agentInstall.test.ts src/agentLinks.test.ts scripts/agents-content.test.mjs scripts/check-agent-artifacts.test.mjs scripts/agent-studio.test.mjs` passed: 6 files and 19 tests. Those tests cover download gating, artifact audit, unauthenticated Studio refusal, and rejection of `supported` without evidence.
- A local Vite probe returned 404 for a percent-encoded `/downloads/..` path and 200 `application/zip` with `Content-Disposition: attachment` for a real evaluation ZIP. This review did not rebuild the production image or repeat the 2026-09-19 live header probe.

## Residual risk

This is a source-and-configuration assessment, not a live penetration test. DNS control, host patching, firewall rules, Docker daemon or Windows administrator access, certificate authority reachability, registry/package provenance, and actual response headers remain deployment-owner responsibilities. The Windows scripts were not executed on a Windows host during this assessment.

Agent Catalog residual risk is separate from the software-catalog deployment decision. Evaluation ZIPs are downloadable for testing once their gates pass. Users must compare the file hash themselves. Skill text can influence an agent. The Time MCP dependency tree and a live stdio session were not independently audited. Publishing this branch in place of `v1.7.0` would put that evaluation catalog on the default page of the image that operators currently treat as the software catalog.
