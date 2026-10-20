# Air-gapped Agent Catalog

This optional artifact workflow is for networks that cannot reach GitHub, npm, or public MCP hosts. The checked-in Agent Catalog examples do not include approved artifacts or checksums. Internal GitLab owns review and metadata. When a ZIP is published, Tool Atlas `/downloads` serves the bytes. A listing can exist without an artifact. Users install by downloading and unpacking. Tool Atlas never runs package scripts, and end users do not need Node, npm, or npx.

Site **build** still uses Node in GitLab CI. That is an operator toolchain. Mirror the digest-pinned job image into your internal Container Registry so runners never pull Docker Hub. See [`.gitlab-ci.yml`](../.gitlab-ci.yml).

## Operator flow

1. Receive or build a reviewed ZIP on a connected jump host or approved media. Do not fetch vendor archives from the internet in GitLab CI.
2. Publish it with the existing Windows helper (Linux operators can copy the same layout under `packages/`):

   ```powershell
   .\windows\Publish-ToolAtlasPackage.ps1 `
     -ToolId "anthropic-pdf" `
     -Version "1.0" `
     -SourcePath "D:\Approved\anthropic-pdf-1.0.zip" `
     -ExpectedSha256 "REPLACE_WITH_64_HEX_CHARACTERS"
   ```

   That writes `packages/anthropic-pdf/1.0/anthropic-pdf-1.0.zip` and a sibling `.sha256` file. The catalog pointer is `artifact:anthropic-pdf/1.0/anthropic-pdf-1.0.zip`.
3. Open a GitLab issue with the **Add catalog agent** template, or add the `content/agents/...` files locally. Include the ZIP's top-level `archiveRoot`, every file or reviewed directory group in that release's `contents`, permissions, risks, the SHA-256 from step 2, and the release review date and evidence. The current release paths must match the listing's `contents`; archived versions can differ. Add project and user unpack paths only when they apply; their final folder name must match `archiveRoot`.
4. A maintainer applies `catalog-approved` only after reviewing the ZIP and the metadata. Add the listing on a branch and merge through normal review. The software-catalog MR automation does not create agent files; keep agent publication on this explicit path until a dedicated job exists.
5. Run `pnpm agents:artifacts --packages-dir /path/to/packages` against the exact staged volume. This checks the hash, ZIP structure, safe paths, archive root, and catalog contents coverage. Deploy the static `dist/` with that volume only after the audit passes. Re-run this check whenever release metadata or ZIP bytes change. Users can download `/downloads/<id>/<version>/<file>.zip` after the host confirms the attachment is present.

## User flow

1. Open Agent Catalog (`?page=agents`) and select a version. A supported listing with a reviewed archive shows a download button only when the host reports the attachment as available.
2. Download the complete ZIP from the same origin and compare its SHA-256 with the value shown in the catalog. The browser does not perform this checksum verification.
3. Follow the listed project or user unpack path when one is provided. Keep the archive's directory structure intact.
4. For an MCP server with verified VS Code compatibility, the editor link opens VS Code's add-server flow. Review its configuration and choose the workspace or user scope there. A remote MCP server can have a configuration without a ZIP.

## What not to publish

- `npx`, `npm`, or other registry install commands
- Public MCP URLs such as `mcp.vercel.com`
- GitHub archive links
- Secrets, API keys, or license material in metadata

For field rules, see [AGENT_CATALOG_CONTENT_GUIDE.md](../AGENT_CATALOG_CONTENT_GUIDE.md). For GitLab software-catalog MR automation, see [GITLAB_CATALOG_CONTRIBUTION.md](./GITLAB_CATALOG_CONTRIBUTION.md).
