# Atlas Repo MCP

Atlas Repo MCP is the reviewed, air-gapped Model Context Protocol server for internal GitLab repositories. Tool Atlas serves a hashed ZIP from `/downloads` and a `vscode:mcp/install` payload for stdio. It does not proxy the server or reach the public internet.

## Install

Download the ZIP from this catalog. Extract it so the binary is in `.agents/mcp/atlas-repo-mcp` for the current project, or `~/.agents/mcp/atlas-repo-mcp` for every project. Confirm the SHA-256 shown in the listing.

Then use **Install in VS Code**. VS Code asks whether to save the server in the workspace or your user profile. Put the unpacked binary on your PATH, or change the generated `command` to the full path inside the unpack folder. Do not use npm or npx.

## When to use it

- Browse internal GitLab projects from an agent session
- Prefer a local stdio binary over a public remote MCP endpoint
- Share one reviewed configuration instead of ad-hoc `.vscode/mcp.json` edits

## Support

Developer Experience reviews the listing and the published ZIP. GitLab access and the MCP binary belong with the internal platform owner.
