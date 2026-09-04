# Production deployment and `v1.4.0-beta.1`

## Release artifacts

`v1.4.0-beta.1` publishes a Linux/amd64 static-site image to GitHub Container Registry:

```text
ghcr.io/shalevz923/shalevsoftwaresite:1.4.0-beta.1
```

The tag is a beta convenience tag, not an immutable deployment identity. After the release workflow succeeds, record its published digest and deploy `ghcr.io/shalevz923/shalevsoftwaresite@sha256:...` instead. The image contains only the built static site and NGINX; it does not include the Node.js Developer Studio server or its write APIs.

The tag workflow verifies that the Git tag and `package.json` version match, runs `pnpm verify`, pushes the image only after that succeeds, and creates an OCI provenance attestation. CI runs the same source verification and a read-only NGINX container smoke test on pull requests and `main`.

## Test the image

For a private GitHub Container Registry package, authenticate with a token that has only `read:packages` before pulling:

```bash
docker login ghcr.io
docker pull ghcr.io/shalevz923/shalevsoftwaresite:1.4.0-beta.1
docker run --rm --read-only --tmpfs /tmp:rw,noexec,nosuid,size=16m -p 127.0.0.1:8080:8080 ghcr.io/shalevz923/shalevsoftwaresite:1.4.0-beta.1
curl --fail --head http://127.0.0.1:8080/
```

For the tracked Caddy deployment, set `TOOL_ATLAS_IMAGE` in the host-local `.env` to the reviewed digest, then pull and start without rebuilding:

```bash
docker compose --env-file .env pull app
docker compose --env-file .env up --no-build --detach
docker compose --env-file .env ps
```

Keep the image origin private behind Caddy, publish only 80/443, retain the certificate volumes, and verify HTTPS and security headers from a separate network. Roll back by changing `TOOL_ATLAS_IMAGE` to the previously recorded digest and repeating the final two Compose commands.

## Windows Server decision

Use the existing IIS deployment as the production path on Windows Server; it is documented in [WINDOWS_DEPLOYMENT.md](./WINDOWS_DEPLOYMENT.md). Docker Desktop is not supported on Windows Server, and this release image is Linux-based, so it cannot run directly as a Windows container. If the image is wanted for a Windows-operated environment, run it on a separately managed, supported Linux VM/host behind the same TLS and firewall controls rather than weakening the IIS deployment.

Microsoft documents that Linux containers require virtualization on Windows, and Docker documents the Docker Desktop support boundary for server versions. See [Microsoft's Linux-container guidance](https://learn.microsoft.com/en-us/virtualization/windowscontainers/deploy-containers/set-up-linux-containers) and [Docker's Windows support policy](https://docs.docker.com/desktop/setup/install/windows-install/).

## Release gate

Before promoting beta to a stable release, require all of the following:

1. Green CI and image-publication workflow for the exact tag.
2. Recorded image digest and verified provenance attestation.
3. Fresh dependency and image-vulnerability review.
4. External HTTPS, firewall, package-download, rollback, and Windows/IIS acceptance evidence.
5. A decision on whether Developer Studio remains local-only or is replaced by the approval-gated catalog pull-request workflow for multi-user changes.
