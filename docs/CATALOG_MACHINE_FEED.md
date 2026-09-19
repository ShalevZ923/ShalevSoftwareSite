# Machine catalog feed

Tool Atlas stays a static site. `pnpm catalog:build` compiles reviewed catalog source into the React bundle and into two public JSON files. There is no production Node API and no authentication on these URLs. They exist so a separate MCP server, or any other machine client, can read approved software without scraping the SPA or using Developer Studio.

Do not edit the JSON by hand. Regenerate with `pnpm catalog:build`. `pnpm catalog:check` fails if the feed does not match catalog source.

## URLs

After a static deployment, the files are:

- `https://<site>/catalog/v1/index.json` — search cards
- `https://<site>/catalog/v1/tools.json` — compact tool records and release targets

`schemaVersion` is `1`. A client must refuse an unknown major version instead of guessing the shape.

`generatedAt` is an ISO-8601 timestamp from the last `catalog:build`. Staleness checks ignore it and compare the tool records.

## What is included

**Index card:** `id`, `name`, `company`, `category`, `platforms`, `lifecycle`, `tags`, `summary`, `defaultVersion`.

**Tools record:** the same identity fields, full `description`, and `releases`. Each release has a `version` and exactly one of:

- `download` — credential-free HTTPS URL
- `artifact` — same-server pointer `tool-id/version/filename`, resolved by clients as `<site>/downloads/<artifact>`

## What is omitted

Guides, support contacts, catalog facts, images, icons, and Developer Studio endpoints are not in this feed. Those remain browser-only (or local-authoring) data so MCP responses stay small.

## Client rules

- Treat the feed as public catalog metadata, not an authorization control.
- Prefer the index for search; fetch `tools.json` only when a download or catalog link is needed.
- Build human catalog links as `/?page=catalog&tool=<id>` and, when a specific release was requested, `&version=<version>`.
- Do not proxy installer bytes through another service; return the reviewed URL or `/downloads/` path.

The enterprise MCP server in the companion `tool-atlas-mcp` repository is the supported consumer. It is a **separate Docker image**. It is not packed into the catalog NGINX container and it does not run in this React app.

Administrators configure allowlists, TLS, and optional `MCP_AUTH_TOKEN` on that server. After it is deployed, users only add `https://<MCP_DOMAIN>/mcp` to `mcp.json`.

## Caching

HTML stays `Cache-Control: no-store`. Fingerprinted `/assets/*` files stay immutable. The machine feed uses a short public cache (`public, max-age=60`) so MCP clients and CDNs can reuse `index.json` / `tools.json` without treating them as a forever snapshot. The MCP process also keeps an in-memory copy (`CACHE_TTL_SECONDS`, default 300). Restart the MCP container to pick up a catalog publish sooner than those TTLs.

## Same-host MCP overlay

If the Tool Atlas Compose stack is already running (`name: tool-atlas`), start the companion MCP stack with its `compose.atlas.yaml` overlay so it fetches `http://app:8080/catalog/v1/*.json` on the internal Docker network. Keep `SITE_PUBLIC_URL` as the public HTTPS catalog origin so chat users never receive `http://app:8080` links.

## Logs

The MCP process never receives the user's chat. Read three streams:

| Question | Where to look |
| --- | --- |
| Did someone open the site or download an installer? | Catalog edge: `docker compose logs proxy` (Caddy JSON, visitor IP). `docker compose logs app` (NGINX JSON) confirms origin responses, including `/downloads/…`; `remote` is the visitor after Caddy's `X-Forwarded-For`. On Windows, IIS W3C logs. |
| Did an IDE search the catalog? | MCP container: one JSON line per `search_software` / `get_software` call (tool name, query or id, hit ids, duration, error, client IP). |
| Is MCP up? | `GET /health` is process up. `GET /ready` is “catalog feed fetched and schemaVersion is 1”. |
