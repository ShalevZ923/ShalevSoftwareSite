# Security report

**Assessment date:** 2026-08-31  
**Scope:** the current static React application, its NGINX container, the Docker Compose/Caddy deployment, and documented operating procedure.  
**Method:** source-backed static review and local configuration validation. No public hostname, DNS record, live certificate, running production container, or external vulnerability feed was tested.

## Executive summary

The application has a small public attack surface: it is a static catalog with no backend, login, API, upload, database, or application secret. The supplied deployment now terminates HTTPS at Caddy, keeps the NGINX app container off the public Docker network, and stores certificate state in named volumes for automatic renewal.

The previous direct-container pattern published plaintext HTTP on port 8080. It is remediated by the tracked Compose deployment; do not use the old `docker run -p 8080:8080` pattern in production.

**Deployment decision:** conditionally ready. Complete the DNS, firewall, certificate-issuance, image-provenance, and current-CVE checks listed below before promoting a public hostname.

## Architecture and trust boundaries

| Boundary | Control | Evidence |
| --- | --- | --- |
| Visitor to edge | Caddy obtains an ACME certificate, redirects HTTP to HTTPS, and adds HSTS. | `Caddyfile`, `compose.yaml` |
| Public host to application | Only `proxy` publishes 80/443; `app` is attached only to the Docker-internal `app_network`. | `compose.yaml` |
| Proxy to static origin | Caddy reverse-proxies to `app:8080` on the internal network. | `Caddyfile` |
| Origin process | NGINX runs as `nginx`, has a read-only root filesystem in Compose, a small `/tmp` tmpfs, no capabilities, and no host port. | `Dockerfile`, `compose.yaml` |
| Browser rendering | CSP, no-sniff, anti-framing, restrictive permissions/referrer policies, COOP/CORP, safe Markdown links, and local-only guide images. | `nginx.conf`, `src/markdown.tsx` |
| Catalog contribution | Local content is schema-validated before generation; public Issue Form data can create a PR only after a trusted maintainer applies `catalog-approved`. | `scripts/catalog-content.mjs`, `.github/workflows/catalog-issue-to-pr.yml` |

## Findings

### Resolved: plaintext public deployment — Medium (CWE-319)

The former README instructed operators to map host port 8080 directly to an HTTP-only NGINX server. An on-path attacker could have modified pages, scripts, headers, or software download guidance. The replacement Compose stack exposes only Caddy on 80/443, obtains a public certificate automatically, and keeps the application origin internal. Validate certificate issuance and an HTTP-to-HTTPS redirect before go-live.

### Resolved: mutable container image tags — Low (CWE-494)

The original Docker build used mutable Node and NGINX tags. The deployment now pins Node, NGINX, and Caddy to exact `@sha256:` digests, so an unchanged repository resolves the same image bytes. JavaScript installation also uses `pnpm install --frozen-lockfile`.

**Ongoing release control:** record review of every new digest and verify image signatures/provenance plus current CVEs before replacing a pin. Digest pinning prevents tag drift; it does not establish that a reviewed digest is vulnerability-free or signed by a trusted publisher.

### Controlled: catalog Issue Form automation

Catalog submissions from the public Issue Form are untrusted input. They receive only the `catalog-submission` label and cannot start the write-capable workflow. A maintainer must apply `catalog-approved`; the workflow then parses the structured issue body, validates the same content rules used locally, runs `pnpm verify`, and opens a pull request instead of publishing directly. The workflow uses a commit-pinned checkout action.

**Required operating control:** restrict the `catalog-approved` label to trusted maintainers, keep GitHub Actions' token permission able to create branches and pull requests, and review the generated PR normally. Never add a label-triggered workflow that runs unreviewed issue text as shell code.

## Verified non-findings

- Query-string filters are allowlisted and rendered as React text, not HTML (`src/catalog.ts`).
- Browser-local saved tools are parsed defensively and restricted to known static IDs (`src/catalogStorage.ts`).
- Markdown does not enable raw HTML; links are limited to HTTPS, `mailto:`, and local fragments, while images are limited to local `/tool-images/` paths (`src/markdown.tsx`).
- There is no server-side request handling, database, authentication path, upload, command execution, or secret storage in the reviewed application source.
- The static origin returns a CSP, nosniff, anti-framing, referrer, permissions, COOP, and CORP headers (`nginx.conf`). It accepts only GET and HEAD requests and does not expose the static-host `_headers` file.

## Required production evidence

1. Confirm the DNS A/AAAA records point to the deployment host and that only TCP 80/443 are reachable from the internet.
2. Start the stack with the real, protected `.env`; confirm Caddy logs successful certificate issuance and renewal scheduling.
3. From an external network, verify the certificate hostname/chain, HTTP redirect, HSTS, CSP, and absence of port 8080.
4. Repeat `pnpm verify` and `pnpm audit --prod` for each release, and run a current vulnerability/provenance scan for the exact pinned image digests. This report does **not** assert current image-CVE status.
5. Back up and test restoration of `tool-atlas_caddy_data` and `tool-atlas_caddy_config`; loss can force new issuance and hit ACME rate limits.
6. Keep `.env` mode 0600, never commit it, and use a server-side secret manager if future backend credentials are introduced.

## Validation performed

- `pnpm verify` passed: 9 unit tests, TypeScript/Vite production build, and generated-artifact checks.
- `pnpm audit --prod` reported no known production dependency vulnerabilities on the assessment date.
- `pnpm catalog:check` validated all content files and confirmed the generated catalog module is current; `pnpm verify` confirmed the migrated catalog still renders and tests successfully.
- `docker compose --env-file .env.example config` rendered successfully with the required domain/contact variables and no public app port.
- The app image rebuilt successfully using the pinned Node and NGINX base-image digests.
- Caddy accepted the final Caddyfile with example values and confirmed automatic HTTPS plus HTTP-to-HTTPS redirect configuration.
- NGINX passed `nginx -t` while run with the Compose-equivalent read-only filesystem, `/tmp` tmpfs, no capabilities, and no-new-privileges setting.

## Residual risk

This is a source-and-configuration assessment, not a live penetration test. DNS control, host patching, firewall rules, Docker daemon access, certificate authority reachability, registry provenance, and actual response headers remain deployment-owner responsibilities.
