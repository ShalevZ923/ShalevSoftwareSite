# Agent catalog source

Catalog records live at `content/agents/<type>/<publisher>/<package>/agent.json`, with a `guide.md` next to each record and `publisher.json` in the publisher directory. `releases/<version>.json` is optional. The build validates the records against `content/schemas/` and the controlled facets in `content/taxonomy/` before generating the static index.

See [the contributor guide](../../AGENT_CATALOG_CONTENT_GUIDE.md) for field meanings and promotion rules. Do not put credentials, private procurement data, or unverified support claims here.

Four pinned-source evaluation archives are documented in [the source review](../../docs/AGENT_SOURCE_REVIEW.md). Run `pnpm agents:packages` to rebuild their local ZIPs before testing downloads.
