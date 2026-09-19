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

The enterprise MCP server in the companion `tool-atlas-mcp` repository is the supported consumer. Administrators configure allowlists and TLS on that server, not in this static app. After that MCP stack is deployed, users only add `https://<MCP_DOMAIN>/mcp` to `mcp.json`.
