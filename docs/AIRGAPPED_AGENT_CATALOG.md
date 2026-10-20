# Air-gapped Agent Catalog

The Agent Catalog is for networks that cannot reach GitHub, npm, or public MCP hosts. Internal GitLab owns review and metadata. Tool Atlas `/downloads` owns the ZIP bytes. Users install by downloading and unpacking. Tool Atlas never runs package scripts, and end users do not need Node, npm, or npx.

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
3. Open a GitLab issue with the **Add catalog agent** template, or add the `content/agents/...` files locally. Include unpack paths, contents, permissions, risks, and the SHA-256 from step 2.
4. A maintainer applies `catalog-approved` only after reviewing the ZIP and the metadata. Add the listing on a branch and merge through normal review. The software-catalog MR automation does not create agent files; keep agent publication on this explicit path until a dedicated job exists.
5. Deploy the static `dist/` together with the `packages/` volume. Users download `/downloads/<id>/<version>/<file>.zip` and unpack to the listed project or global folder.

## User flow

1. Open Agent Catalog (`?page=agents`).
2. Expand a listing. Confirm the SHA-256.
3. Download the ZIP (same origin as the catalog).
4. Choose Project or Global, copy the unpack path, and extract the archive so the package root is that folder.
5. For MCP servers, use **Install in VS Code** only when the listing provides a stdio binary or an internal HTTPS endpoint.

## What not to publish

- `npx`, `npm`, or other registry install commands
- Public MCP URLs such as `mcp.vercel.com`
- GitHub archive links
- Secrets, API keys, or license material in metadata

For field rules, see [AGENT_CATALOG_CONTENT_GUIDE.md](../AGENT_CATALOG_CONTENT_GUIDE.md). For GitLab software-catalog MR automation, see [GITLAB_CATALOG_CONTRIBUTION.md](./GITLAB_CATALOG_CONTRIBUTION.md).
