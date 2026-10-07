# Maintaining the agent catalog

Every agent package is a small source directory in [`content/agents`](./content/agents), organized as `<type-id>/<publisher-id>/<package-id>`. Each package has an `agent.json` catalog record, `guide.md` documentation, and one `releases/<version>.json` file per approved version. The type ID must come from [`content/taxonomy/agent-types.json`](./content/taxonomy/agent-types.json); the publisher directory is derived from `publisher.json.name`. The UI reads the generated `src/generated/agents.ts`; do not edit that generated file directly.

This catalog is designed for air-gapped networks that use internal GitLab. Users download a reviewed ZIP from Tool Atlas and unpack it. They do not use npm or npx. See [the air-gapped operator guide](./docs/AIRGAPPED_AGENT_CATALOG.md).

## Local contributor path

Create or edit a package directory, then validate:

```bash
pnpm agents:build
pnpm verify
```

`pnpm agents:build` validates all entries and regenerates `src/generated/agents.ts`. `pnpm agents:check`, which runs before unit tests, fails if generated output is stale.

Publish the ZIP to the host `packages/` volume **before** the catalog pointer will download. The Git repository does not contain the bytes.

## Content rules

- Type IDs are `skills`, `agent-packs`, `role-packs`, or `mcp-servers`. Add a type to the taxonomy only when it is broadly reusable.
- Publisher and package directories use lowercase kebab-case. `publisher.json.name` must map to its publisher directory and `agent.json.id` must equal its package directory.
- Keep package metadata in `agent.json`, install guidance in `guide.md`, and each approved release in `releases/<version>.json`.
- `order` is a unique positive integer that preserves the catalog's curated “recently updated” ordering.
- Each listing must explain what it does, who publishes it, what files it contains (`contents`), and the permissions or risks that matter.
- `riskLevel` is `Low`, `Medium`, or `High`. `permissions` is required. `risks` is optional but should be present whenever a script, OAuth grant, or file-write helper is involved.
- `install.unpack.project` and `install.unpack.global` are required. Use `.agents/...` and `~/.agents/...` (or `.vscode/...`) paths. Do not store npm/npx commands.
- `install.mcp` is optional. Stdio servers must name a local executable (not `npx`/`npm`). HTTP/SSE servers must use an **internal** HTTPS URL, not a public SaaS host.
- Releases are same-server ZIP artifacts only:

  ```json
  {
    "version": "1.0",
    "artifact": "example-skill/1.0/example-skill-1.0.zip",
    "sha256": "64-character-hex-digest"
  }
  ```

  Hosted artifacts use `package-id/version/filename.zip`. External `download` URLs are rejected.
- Guides must include `## Install` and `## Support`.
- Facts are small, non-sensitive `label`/`value` pairs. Never add API keys, tokens, passwords, or activation material.
- Tool Atlas remains a static catalog: it indexes, validates, versions, and serves files. It does not run package scripts.

## Example layout

```text
content/agents/skills/anthropic/anthropic-pdf/
  agent.json
  guide.md
  releases/1.0.json
content/agents/skills/anthropic/publisher.json
```
