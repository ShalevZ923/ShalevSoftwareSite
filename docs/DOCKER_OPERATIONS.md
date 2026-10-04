# Docker operation

## Static catalog and optional Caddy settings

From a trusted checkout, start the app and Caddy. No `.env` file is required:

```bash
docker compose up --build --detach
docker compose ps
curl --fail http://localhost/api/health
```

The response is JSON: `{"status":"ok"}`. This checks the serving process and request path through Caddy; it is not an assertion about external DNS/TLS, catalog freshness, or installer availability. Check `/` as well to confirm the app HTML loads. Container health checks use `/api/health`.

For a different HTTP port, set `HTTP_PORT=8080` in `.env` and probe `http://localhost:8080/api/health`. PowerShell users can use `curl.exe` or `Invoke-RestMethod http://localhost:8080/api/health`.

`SITE_DOMAIN` and `ACME_EMAIL` may both be absent or empty. With no domain, the site listens on HTTP port 80 without requesting certificates. To enable HTTPS, set a public hostname in `SITE_DOMAIN`, point DNS at the host, and allow public ports 80/443. `ACME_EMAIL` is optional. For example:

```dotenv
SITE_DOMAIN=atlas.example.com
ACME_EMAIL=ops@example.com
```

Keep the certificate volumes between restarts. HTTP is intended for local/trusted network operation; use a configured hostname and HTTPS for public deployments. See [Caddy's site address rules](https://caddyserver.com/docs/caddyfile/concepts#addresses) and [global email option](https://caddyserver.com/docs/caddyfile/options#email).

```bash
docker compose logs --tail=100 app proxy
docker compose exec app wget -qO- http://127.0.0.1:8080/api/health
```

The default image runs NGINX and never starts the Node server. It has no Studio token. Its `/api/health` endpoint never returns credentials.

## Local Studio container and token logs

Use the separately built Studio target, from the same checkout:

```bash
docker compose -f compose.studio.yaml up --build --detach
docker compose -f compose.studio.yaml ps
docker compose -f compose.studio.yaml logs --tail=50 studio
```

Open `http://127.0.0.1:8081/?page=developer` on the Docker host and paste the **Developer Studio Token** printed by the most recent startup. Docker Desktop users open this URL on their PC. The token is generated in memory on every process start; it is not an environment variable, committed secret, or health endpoint field. Docker's bounded local log retains the startup output so an authorized host operator can retrieve it later. Treat Studio logs as credentials: do not forward or share them. Recreating the container starts a new log and token.

```bash
curl --fail http://127.0.0.1:8081/api/health
docker compose -f compose.studio.yaml restart studio
docker compose -f compose.studio.yaml logs --since=1m studio
```

The port defaults to 8081; set `STUDIO_PORT` in `.env` to change it. It is always published on `127.0.0.1`. The explicit `TOOL_ATLAS_LOCAL_CONTAINER=true` mode permits the process to listen on container interfaces solely for this local port mapping. Keep this configuration separate from the public Caddy network and do not change its port binding to `0.0.0.0`. This mode does not implement TLS.

The container runs as a non-root user with a read-only image. Only authoring directories are writable bind mounts: `content`, `src/generated`, `public/catalog/v1`, and `docs`. `packages` and `guide-library` are mounted read-only. On Linux, set `STUDIO_UID`/`STUDIO_GID` to the checkout owner's numeric IDs (`id -u`/`id -g`) so saves can write those mounts. Docker Desktop uses its host-file sharing permissions. Set `TOOL_ATLAS_GUIDE_HOSTS` to the precise internal hostnames approved for guide-link validation.

After saving, inspect the checkout changes and run the normal verification/review workflow. To refresh the public site with reviewed edits, rebuild/recreate the static app. A running Studio reads catalog edits live, while its compiled UI and the static app's Docker image retain their build-time content. Rebuild Studio after changing application source.

```bash
docker compose -f compose.studio.yaml down
```

For a remote Docker host, keep Studio local to that host and use an authenticated SSH tunnel to its localhost port. Do not retrieve its token through an unauthenticated HTTP endpoint. Remote health checks need a reachable host URL and the appropriate firewall access.
