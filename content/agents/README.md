# Agent catalog source layout

The agent catalog is the authoritative, reviewable source for public Tool Atlas agent packages on an air-gapped network. Its hierarchy is deliberately stable:

```text
content/agents/<type-id>/<publisher-id>/<package-id>/
  publisher.json
  agent.json
  guide.md
  releases/
    <version>.json
```

`<type-id>` is a path from [`content/taxonomy/agent-types.json`](../taxonomy/agent-types.json): `skills`, `agent-packs`, `role-packs`, or `mcp-servers`. The publisher directory is the lowercase kebab-case form of `publisher.json.name`. The package directory equals `agent.json.id`. A release filename equals its `version` plus `.json`. Each release is a same-server ZIP artifact pointer plus a SHA-256 digest. The ZIP bytes live under the host `packages/` directory, not in this tree.

Do not put private licence, procurement, contract, credential, activation, or user data here. Do not record npm or npx install commands. This directory is a catalog source and is compiled into the static client bundle. Tool Atlas does not execute package scripts.
