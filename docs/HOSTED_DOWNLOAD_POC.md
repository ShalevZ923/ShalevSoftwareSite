# Hosted-download proof of concept

This local proof uses two containers:

1. A pinned Microsoft PowerShell container downloads the official jq 1.8.2 Windows executable and publishes it only after matching the release SHA-256 digest.
2. The production Tool Atlas NGINX image serves the application and the resulting local package file on `127.0.0.1:8080`.

The browser download target is `/downloads/jq/1.8.2/jq-windows-amd64.exe`. It is not the GitHub release URL. The executable remains under the Git-ignored `packages` directory on the server.

## Run it

From the repository root:

```bash
docker compose -f compose.poc.yaml up --build
```

The publisher defaults to host UID/GID `1000:1000`. If your checkout belongs to another account, set `POC_UID` and `POC_GID` to that account's numeric IDs before starting Compose. The publisher remains unprivileged, has no Linux capabilities, and can write only the mounted package directory.

Open <http://127.0.0.1:8080>, select **jq**, and choose **Download 1.8.2**. The browser should download `jq-windows-amd64.exe` from the local Tool Atlas origin.

Verify the server-side and downloaded bytes:

```bash
sha256sum packages/jq/1.8.2/jq-windows-amd64.exe
curl --fail --remote-name \
  http://127.0.0.1:8080/downloads/jq/1.8.2/jq-windows-amd64.exe
sha256sum jq-windows-amd64.exe
```

Both values must be:

```text
a6fc67fedaf9128a3309a1e2ebb8b986aeccf70122ee46d2cb4849e423f0c627
```

The jq release page and GitHub release API publish that digest for the 1,035,264-byte Windows AMD64 executable.

## Inspect and stop it

```bash
docker compose -f compose.poc.yaml ps
docker compose -f compose.poc.yaml logs publisher app
docker compose -f compose.poc.yaml down
```

The downloaded package is deliberately retained in `packages/jq/1.8.2/` after the containers stop so it can be inspected and reused. Remove it through the normal approved package-retirement process when the proof is no longer needed.
