// Generated from content/agents/**/{agent.json,guide.md,releases/*.json} by scripts/build-agents.mjs. Do not edit manually.

export const agents = [
  {
    "id": "atlas-repo-mcp",
    "name": "Atlas Repo MCP",
    "icon": "AR",
    "updated": "Today",
    "description": "A reviewed, air-gapped MCP server for internal GitLab repositories. The ZIP contains a stdio binary; VS Code talks to it locally after you unpack the archive.",
    "riskLevel": "Medium",
    "permissions": [
      "Read GitLab projects the signed-in identity can already access on the internal network",
      "Run the unpacked stdio binary on the local machine",
      "Write MCP configuration into the chosen VS Code scope"
    ],
    "risks": [
      "The binary runs on the workstation with the user's identity.",
      "VS Code will prompt you to trust the server before starting it."
    ],
    "contents": [
      {
        "path": "atlas-repo-mcp",
        "kind": "script",
        "note": "Stdio MCP server binary for Linux and Windows."
      },
      {
        "path": "mcp.json",
        "kind": "config",
        "note": "Reviewed stdio configuration for VS Code."
      }
    ],
    "install": {
      "unpack": {
        "project": ".agents/mcp/atlas-repo-mcp",
        "global": "~/.agents/mcp/atlas-repo-mcp"
      },
      "mcp": {
        "name": "atlas-repo",
        "config": {
          "type": "stdio",
          "command": "atlas-repo-mcp",
          "args": []
        }
      }
    },
    "notice": {
      "tone": "info",
      "title": "Hosted ZIP required",
      "message": "Download works after a maintainer publishes atlas-repo-mcp-1.0.zip to the Tool Atlas packages volume with the listed SHA-256. Put the binary on PATH or invoke it from the unpack folder."
    },
    "maintainer": {
      "name": "Maya Cohen",
      "team": "Developer Experience",
      "initials": "MC",
      "email": "devex@atlas.local"
    },
    "tags": [
      "MCP",
      "GitLab",
      "Internal",
      "Stdio"
    ],
    "facts": [
      {
        "label": "Publisher",
        "value": "Internal"
      },
      {
        "label": "Transport",
        "value": "stdio"
      },
      {
        "label": "Delivery",
        "value": "Same-server ZIP"
      }
    ],
    "publisher": "Internal",
    "packageType": "MCP Server",
    "releases": [
      {
        "version": "1.0",
        "artifact": "atlas-repo-mcp/1.0/atlas-repo-mcp-1.0.zip",
        "sha256": "fcde2b2edba56bf408601fb721fe9b5c338d10ee429ea04fae5511b68fbf8fb9"
      }
    ]
  },
  {
    "id": "anthropic-pdf",
    "name": "PDF Skill",
    "icon": "PDF",
    "updated": "Yesterday",
    "description": "Anthropic's reviewed PDF skill for extracting text and tables, merging and splitting documents, filling forms, adding watermarks, and running OCR on scanned files.",
    "riskLevel": "Medium",
    "permissions": [
      "Read local PDF files supplied by the user",
      "Write generated or modified PDF files to the working directory",
      "Run bundled Python and command-line helpers on the local machine"
    ],
    "risks": [
      "Scripts can read and rewrite files in the project or skills directory.",
      "OCR and form-filling helpers may invoke local Python packages."
    ],
    "contents": [
      {
        "path": "SKILL.md",
        "kind": "skill",
        "note": "When to use the skill and the core PDF workflow."
      },
      {
        "path": "forms.md",
        "kind": "doc",
        "note": "Form-filling instructions."
      },
      {
        "path": "reference.md",
        "kind": "doc",
        "note": "Advanced libraries and troubleshooting."
      },
      {
        "path": "scripts",
        "kind": "script",
        "note": "Python helpers for extract, merge, split, and related tasks."
      },
      {
        "path": "LICENSE.txt",
        "kind": "doc",
        "note": "Source-available license terms for this document skill."
      }
    ],
    "install": {
      "unpack": {
        "project": ".agents/skills/pdf",
        "global": "~/.agents/skills/pdf"
      }
    },
    "notice": {
      "tone": "info",
      "title": "Hosted ZIP required",
      "message": "Download works after a maintainer publishes anthropic-pdf-1.0.zip to the Tool Atlas packages volume with the listed SHA-256."
    },
    "maintainer": {
      "name": "Maya Cohen",
      "team": "Developer Experience",
      "initials": "MC",
      "email": "devex@atlas.local"
    },
    "tags": [
      "Anthropic",
      "Skill",
      "PDF",
      "Documents"
    ],
    "facts": [
      {
        "label": "Publisher",
        "value": "Anthropic"
      },
      {
        "label": "Delivery",
        "value": "Same-server ZIP"
      },
      {
        "label": "License",
        "value": "Source-available document skill"
      }
    ],
    "publisher": "Anthropic",
    "packageType": "Skill",
    "releases": [
      {
        "version": "1.0",
        "artifact": "anthropic-pdf/1.0/anthropic-pdf-1.0.zip",
        "sha256": "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824"
      }
    ]
  },
  {
    "id": "openai-developers",
    "name": "OpenAI Developers Pack",
    "icon": "OA",
    "updated": "2 days ago",
    "description": "OpenAI's Codex plugin pack for platform workflows: Agents SDK apps, ChatGPT Apps, API troubleshooting, and encrypted API-key setup.",
    "riskLevel": "High",
    "permissions": [
      "Read and write project files under the plugin and skills directories",
      "Run the bundled local MCP helper used by the API-key setup flow",
      "Create or update local environment files when the API-key skill is used"
    ],
    "risks": [
      "The API-key skill can write local env files after you confirm the destination.",
      "The bundled MCP helper is a local script; review it before enabling the pack.",
      "Plugin skills may change project files as part of Agents SDK and ChatGPT App workflows."
    ],
    "contents": [
      {
        "path": ".codex-plugin/plugin.json",
        "kind": "config",
        "note": "Codex plugin manifest and OpenAI Developers branding."
      },
      {
        "path": ".app.json",
        "kind": "config",
        "note": "OpenAI Platform app connector."
      },
      {
        "path": ".mcp.json",
        "kind": "config",
        "note": "Local MCP helper used during API-key setup."
      },
      {
        "path": "mcp/server.mjs",
        "kind": "script",
        "note": "Destination confirmation form for the API-key flow."
      },
      {
        "path": "skills/agents-sdk",
        "kind": "skill",
        "note": "Build, run, and evaluate Agents SDK apps."
      },
      {
        "path": "skills/build-chatgpt-app",
        "kind": "skill",
        "note": "Scaffold and troubleshoot ChatGPT Apps SDK projects."
      },
      {
        "path": "skills/chatgpt-app-submission",
        "kind": "prompt",
        "note": "Produce chatgpt-app-submission.json."
      },
      {
        "path": "skills/openai-api-troubleshooting",
        "kind": "skill",
        "note": "Classify common API failures."
      },
      {
        "path": "skills/openai-platform-api-key",
        "kind": "skill",
        "note": "Encrypted API-key creation and local project setup."
      }
    ],
    "install": {
      "unpack": {
        "project": ".agents/plugins/openai-developers",
        "global": "~/.agents/plugins/openai-developers"
      }
    },
    "notice": {
      "tone": "warning",
      "title": "Review before enabling API-key helpers",
      "message": "This pack can write local environment files. Confirm the destination path and never paste secrets into Tool Atlas."
    },
    "maintainer": {
      "name": "Maya Cohen",
      "team": "Developer Experience",
      "initials": "MC",
      "email": "devex@atlas.local"
    },
    "tags": [
      "OpenAI",
      "Agent pack",
      "Codex",
      "Agents SDK"
    ],
    "facts": [
      {
        "label": "Publisher",
        "value": "OpenAI"
      },
      {
        "label": "Delivery",
        "value": "Same-server ZIP"
      },
      {
        "label": "Kind",
        "value": "Codex plugin pack"
      }
    ],
    "publisher": "OpenAI",
    "packageType": "Agent Pack",
    "releases": [
      {
        "version": "1.0",
        "artifact": "openai-developers/1.0/openai-developers-1.0.zip",
        "sha256": "2c26b46b68ffc68ff99b453c1d30413413422d706483bfa0f98a5e886266e7ae"
      }
    ]
  }
];

export const agentDocs = {
  "atlas-repo-mcp": "# Atlas Repo MCP\n\nAtlas Repo MCP is the reviewed, air-gapped Model Context Protocol server for internal GitLab repositories. Tool Atlas serves a hashed ZIP from `/downloads` and a `vscode:mcp/install` payload for stdio. It does not proxy the server or reach the public internet.\n\n## Install\n\nDownload the ZIP from this catalog. Extract it so the binary is in `.agents/mcp/atlas-repo-mcp` for the current project, or `~/.agents/mcp/atlas-repo-mcp` for every project. Confirm the SHA-256 shown in the listing.\n\nThen use **Install in VS Code**. VS Code asks whether to save the server in the workspace or your user profile. Put the unpacked binary on your PATH, or change the generated `command` to the full path inside the unpack folder. Do not use npm or npx.\n\n## When to use it\n\n- Browse internal GitLab projects from an agent session\n- Prefer a local stdio binary over a public remote MCP endpoint\n- Share one reviewed configuration instead of ad-hoc `.vscode/mcp.json` edits\n\n## Support\n\nDeveloper Experience reviews the listing and the published ZIP. GitLab access and the MCP binary belong with the internal platform owner.",
  "anthropic-pdf": "# PDF Skill\n\nAnthropic's PDF skill is the reviewed package for document extraction, assembly, form filling, and OCR. Tool Atlas serves a hashed ZIP from `/downloads`; it does not run the bundled scripts.\n\n## Install\n\nDownload the ZIP from this catalog. Extract it so `SKILL.md` is in `.agents/skills/pdf` for the current project, or `~/.agents/skills/pdf` for every project. Confirm the SHA-256 shown in the listing before you unpack. Do not use npm or npx.\n\nRestart the agent host after unpacking so it discovers the skill.\n\n## When to use it\n\n- Extract text or tables from an existing PDF\n- Merge, split, rotate, or watermark pages\n- Fill PDF forms or run OCR on a scanned document\n\n## Support\n\nDeveloper Experience reviews the listing and the published ZIP. Questions about the skill itself belong with the internal package owner.",
  "openai-developers": "# OpenAI Developers Pack\n\nThe OpenAI Developers plugin is the reviewed Codex pack for platform and agent-building workflows. Tool Atlas serves a hashed ZIP from `/downloads`; it does not execute plugin scripts or collect API keys.\n\n## Install\n\nDownload the ZIP from this catalog. Extract it so the pack root is `.agents/plugins/openai-developers` for the current project, or `~/.agents/plugins/openai-developers` for every project. Confirm the SHA-256 shown in the listing. Do not use npm or npx.\n\nRestart Codex after unpacking so it discovers the pack. Do not paste API keys into this catalog. The API-key skill, when you choose to use it, writes only to a destination you confirm locally.\n\n## When to use it\n\n- Build or evaluate an Agents SDK app\n- Scaffold or submit a ChatGPT App\n- Troubleshoot OpenAI API failures with the bundled skill\n\n## Support\n\nDeveloper Experience reviews the listing and the published ZIP. Plugin behavior belongs with the internal package owner."
};
