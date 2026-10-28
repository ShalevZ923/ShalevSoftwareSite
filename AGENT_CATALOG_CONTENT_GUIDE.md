# Maintaining the agent catalog

The Agent Catalog is a static, reviewable index of MCP servers, skills, and agent packages. Listing a resource does not claim it is installed or supported. Three early entries remain examples. Four pinned-source archives are available for evaluation; their source review is recorded in [Agent source review](docs/AGENT_SOURCE_REVIEW.md).

## Source and build

Add a directory at `content/agents/<type>/<publisher>/<id>/` with `agent.json` and `guide.md`. The publisher directory has one `publisher.json`. Types come from `content/taxonomy/agent-types.json`. Capabilities and compatibility targets come from `content/taxonomy/agent-facets.json`. The schema at `content/schemas/agent.schema.json` defines the record; `content/schemas/agent-release.schema.json` defines optional releases. JSON Schema checks and cross-field checks run during `pnpm agents:build` and `pnpm agents:check`.

A standalone skill is its own `Skill` entry with a stable ID and guide; it does not need to belong to an Agent Pack. Packs can group multiple skills and other reviewed files under a separate entry.

Run `pnpm agents:build` after editing source. Commit the generated `src/generated/agents.ts` alongside source. Run `pnpm verify` before review. The generated list holds listing metadata only; guides load when opened. Do not hand-edit generated files.

The optional local Developer Studio has an **Agent Catalog** tab for adding and editing these records without hand-editing JSON. Run `pnpm dev`, open the local Developer Studio access link printed by that server, and save through the protected editor. The editor updates `agent.json`, `guide.md`, release records, and the generated index in the working tree. Its edits appear in the local catalog feed immediately; public static deployments still require a reviewed build and deployment. The Studio does not upload ZIPs or certify host compatibility.

## Listing fields

- `schemaVersion: 1` allows deliberate migrations. `id` is stable and globally unique. A rename changes the display name, not the ID or deep link.
- `updatedAt` is an ISO calendar date describing the last catalog review or change. It is the source for “Recently updated”; file order has no meaning.
- `description` is one plain sentence (up to 180 characters). `highlights` is one to four short, distinct capability tags (up to 36 characters each). Write these for quick scanning across many standalone skills and packs; keep file lists and operational detail in their structured fields.
- `downloadButtonLabel` is optional display text for an available ZIP. The Developer Studio Delivery section can change it. The actual button state is derived from listing review, pinned source, license, risk, release review, SHA-256, and same-server artifact availability; editing the label cannot enable a blocked download.
- `status` is `example`, `evaluation`, `supported`, or `deprecated`. `review.status` records whether a specific `currentVersion` has been reviewed. Do not call an entry supported merely because its publisher is well known.
- `capabilities` and `compatibility[].target` use controlled IDs. Compatibility is retained as review evidence and to gate supported install actions; the discovery UI uses one small host note instead of listing target rows. Each compatibility row says `verified` or `unverified` and explains the scope. Verified rows require a date, evidence, and the current version.
- `requirements`, `permissions`, `risks`, and `riskLevel` describe what an operator should evaluate. Use `Unknown` when risk has not been assessed. Do not put credentials or private procurement data into catalog source.
- MCP listings add `mcp.transport`, `mcp.hosting`, `mcp.authentication`, and separate `tools`, `resources`, and `prompts` arrays. Each tool has a stable name, a description, and a declared `read`, `write`, `execute`, or `unknown` effect. `stdio` implies local hosting. These are declared catalog metadata, not the result of a live server probe.
- Listing `contents` describes the current package's files and directory groups, including scripts and reference files. It may be empty for a remote MCP server without an archive. Each ZIP release has its own `contents` so older versions can differ. Every release path must exist in that ZIP and every file must be covered by a listed path. List a directory only when its full subtree has been reviewed. The current release's paths and kinds must match the listing. `guide.md` must include `## Overview` and `## Support`.
- `source.url`, `source.revision`, `license`, `currentVersion`, owner, evidence, assessed risk, and at least one verified compatibility row are required before status can become `supported`. Record a pinned upstream revision or internal release identifier in `source.revision`.
- Releases are optional. A release has `version`, `releasedAt`, and optional notes. `currentVersion` must name one of the releases. To offer a ZIP, add a same-origin `artifact` pointer, the SHA-256 of the exact ZIP, `archiveRoot` (one top-level folder), release-specific `contents`, and `review.date` and `review.evidence`. Review evidence must cover the archive and its complete contents, including scripts and assets. Discovery does not depend on delivery metadata. The browser offers a ZIP for a reviewed supported or evaluation listing with pinned source and assessed risk when the host confirms the file is available; it does not verify downloaded bytes.
- `install.unpack` is optional and only applies to a ZIP release. It records project and user destination folders whose final folder name must match `archiveRoot`, not an automatic installer. `install.mcp` is a reviewed VS Code MCP configuration and can stand alone for a remote MCP server. The VS Code link is shown only when the current listing is supported and its VS Code compatibility has been verified. VS Code still asks the user to review the configuration and select its scope.

Check host-specific placement before recording unpack paths: [VS Code Agent Skills folders](https://code.visualstudio.com/docs/agent-customization/agent-skills) and [VS Code MCP server configuration](https://code.visualstudio.com/docs/agent-customization/mcp-servers) describe different flows. Do not use a skill folder path as an MCP configuration destination.

## Promotion and maintenance

Start an unverified listing as `example` or `evaluation`. For an actual support claim, obtain the pinned source and license, assign an owner, document a review of the exact current version, test at least one target, assess permissions and risk, then change status to `supported`. Retire a resource with `deprecated` while preserving its stable ID so saved items and links still explain what happened. Reviewers should compare the listing with its source and repeat compatibility checks when the current version changes.

When volume grows, keep authoring one directory per resource and review through merge requests. The UI searches an indexed static list and shows 20 results per page. If the index grows beyond practical bundle size, split generated metadata by type or move to a versioned static JSON index; that does not require a public application backend.

## Where catalog controls live

| Visible item | Source of truth |
| --- | --- |
| Resource name, description, tags, support status, and optional download button label | `content/agents/<type>/<publisher>/<id>/agent.json`; edit in Developer Studio's Agent Catalog tab |
| Status names such as “In evaluation” | `src/agentCatalog.ts` `supportLabels` |
| Status badge and button colors | `src/styles.css` `.agent-support-*` and `.agent-detail a.agent-download` |
| ZIP version, filename, checksum, file list, and review | `content/agents/<type>/<publisher>/<id>/releases/<version>.json`; edit metadata in Studio, then build/audit the package separately |
| Download availability and button fallback text | `src/agentDelivery.ts` and `src/components/AgentDelivery.tsx` |
| Protected Studio persistence and live local feed | `scripts/agent-studio.mjs`, `scripts/server.mjs`, and `src/components/studio/AgentStudio.tsx` |

The initial four archives are rebuilt from tracked `vendor/agent-catalog/` snapshots using `pnpm agents:packages` (Python 3 standard library required). This also runs the artifact audit. ZIPs are generated in ignored `packages/`; build them on the host or mount the audited package directory for deployment. Before deploying a separate `packages/` volume, run `pnpm agents:artifacts --packages-dir /path/to/packages`. This checks that every declared archive is inside the approved root, matches its SHA-256, is a readable ZIP, has safe entry paths under `archiveRoot`, and agrees with that release's `contents` list. The audit supports standard stored or deflated ZIPs up to 512 MiB and rejects encrypted, ZIP64-size, symlink, and oversized entries. `pnpm verify` checks metadata and the site, but cannot check artifacts absent from the source checkout. Structural validation does not assess whether package code is safe; that requires the recorded release review.
