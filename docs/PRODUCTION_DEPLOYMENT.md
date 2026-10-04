# Production deployment and `v1.7.0`

## Release artifacts

`v1.7.0` publishes a Linux/amd64 static-site image to GitHub Container Registry:

```text
ghcr.io/shalevz923/shalevsoftwaresite:1.7.0
```

The version tag is a convenience tag, not an immutable deployment identity. After the release workflow succeeds, record its published digest and deploy `ghcr.io/shalevz923/shalevsoftwaresite@sha256:...` instead. The image contains only the built static site and NGINX; it does not include the Node.js Developer Studio server, its write APIs, or the companion MCP process.

The tag workflow verifies that the Git tag and `package.json` version match, runs `pnpm verify`, and pushes the image only after that succeeds. On a public repository it also creates an OCI provenance attestation; GitHub does not persist attestations for user-owned private repositories.

CI runs on Node 24. The production image builds with Node 26 (Corepack installed explicitly) and serves through nginx 1.31. Treat that skew as intentional: verify on both the CI toolchain and the image before promotion.

## Test the image

The public GitHub Container Registry package can be pulled without authentication:

```bash
docker pull ghcr.io/shalevz923/shalevsoftwaresite:1.7.0
docker run --rm --read-only --tmpfs /tmp:rw,noexec,nosuid,size=16m -p 127.0.0.1:8080:8080 ghcr.io/shalevz923/shalevsoftwaresite:1.7.0
curl --fail --head http://127.0.0.1:8080/
```

For the tracked Caddy deployment, set `TOOL_ATLAS_IMAGE` in the host-local `.env` to the reviewed digest, then pull and start without rebuilding:

```bash
docker compose --env-file .env pull app
docker compose --env-file .env up --no-build --detach
docker compose --env-file .env ps
```

For public HTTPS, configure `SITE_DOMAIN`; `ACME_EMAIL` is optional. With no domain, Caddy uses HTTP on port 80 for local/trusted network access. See [Docker operation](./DOCKER_OPERATIONS.md) for health checks and the separate local Studio container.

Keep the deployed application behind Caddy, publish only 80/443, retain the certificate volumes, and verify HTTPS and security headers from a separate network. Roll back by changing `TOOL_ATLAS_IMAGE` to the previously recorded digest and repeating the final two Compose commands.

Caddy JSON access logs (including `/downloads/…`) are the visitor-IP record at the public edge (`docker compose logs proxy`). NGINX JSON access and error logs are on the `app` container stdout/stderr; `remote` is the visitor after Caddy's `X-Forwarded-For`, trusted only from private Docker peers. The companion MCP image, if used, has its own Caddy and tool-call logs; see [the machine catalog contract](./CATALOG_MACHINE_FEED.md).

## Windows Server decision

Use the existing IIS deployment as the production path on Windows Server; it is documented in [WINDOWS_DEPLOYMENT.md](./WINDOWS_DEPLOYMENT.md). Docker Desktop is not supported on Windows Server, and this release image is Linux-based, so it cannot run directly as a Windows container. If the image is wanted for a Windows-operated environment, run it on a separately managed, supported Linux VM/host behind the same TLS and firewall controls rather than weakening the IIS deployment.

Microsoft documents that Linux containers require virtualization on Windows, and Docker documents the Docker Desktop support boundary for server versions. See [Microsoft's Linux-container guidance](https://learn.microsoft.com/en-us/virtualization/windowscontainers/deploy-containers/set-up-linux-containers) and [Docker's Windows support policy](https://docs.docker.com/desktop/setup/install/windows-install/).

## Release gate

Before promoting a build to production, require all of the following:

1. Green CI and image-publication workflow for the exact tag.
2. Recorded image digest and verified provenance attestation.
3. Fresh dependency and image-vulnerability review.
4. External HTTPS, firewall, package-download, rollback, and Windows/IIS acceptance evidence.
5. Developer Studio remains **local-only**. Multi-user catalog changes use the approval-gated GitHub/GitLab issue and pull-request workflow, not a networked Studio.
6. If IDEs should search the catalog, deploy the companion MCP image separately. Do not add a Node process to this NGINX image.

Item 5 is the product decision for this line: do not ship Studio write APIs in the public image.
