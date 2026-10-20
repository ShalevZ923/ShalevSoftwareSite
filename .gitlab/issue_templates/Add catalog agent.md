<!--
Use non-sensitive catalog information only. Do not include credentials, license keys,
activation codes, personal data, or private contracts. Publish the ZIP to the Tool Atlas
packages volume before merging. A maintainer must apply the catalog-approved label before
the listing is added. Agent packages are artifact ZIPs only; do not use npm, npx, or public
SaaS MCP endpoints.
-->

### Package name

<!-- Required. -->

### Publisher

<!-- Required. Display name; the directory is its kebab-case form. -->

### Type ID

<!-- Required. Must exactly match content/taxonomy/agent-types.json: skills, agent-packs, role-packs, or mcp-servers. -->

### Catalog tile

<!-- One or two letters shown when there is no local image. Required. -->

### Risk level

<!-- Low, Medium, or High. Required. -->

### Approved ZIP release

<!-- Required. One line: version | artifact:package-id/version/filename.zip -->

1.0 | artifact:example-skill/1.0/example-skill-1.0.zip

### SHA-256

<!-- Required. 64 hex characters of the published ZIP. -->

### Unpack project path

<!-- Required. Example: .agents/skills/example-skill -->

### Unpack global path

<!-- Required. Example: ~/.agents/skills/example-skill -->

### Optional MCP config

<!-- Leave empty unless this is an internal MCP server. JSON object with name plus stdio command or internal HTTPS url. -->

### Short description

<!-- Required. -->

### Permissions

<!-- Required. One permission per line. -->

### Risks

<!-- Optional. One risk per line. -->

### Contents

<!-- Required. One path | kind | note per line. kind is skill, script, prompt, config, or doc. -->

SKILL.md | skill | When to use the skill

### Reviewer

<!-- Required. -->

### Reviewer team

<!-- Required. -->

### Reviewer email

<!-- Required. -->

### Tags

<!-- Comma-separated. Required. -->

### Optional facts

<!-- One non-sensitive Label: value pair per line. -->

### Installation and support guide

## Install

Download the ZIP from Tool Atlas. Extract it into the project or global unpack path. Confirm the SHA-256. Do not use npm or npx.

## Support

State the support route.
