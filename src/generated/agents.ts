// Generated from content/agents by scripts/build-agents.mjs. Do not edit manually.
import type { AgentPackage } from "../agentTypes";

export const agents = [
  {
    "schemaVersion": 1,
    "id": "anthropic-pdf",
    "name": "PDF Skill",
    "icon": "PDF",
    "description": "Extract text, fill forms, and process scanned PDF documents.",
    "highlights": [
      "Text extraction",
      "Forms",
      "OCR"
    ],
    "riskLevel": "Unknown",
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
    "maintainer": {
      "name": "Unassigned",
      "team": "Owner needed",
      "initials": "—",
      "email": "unassigned@example.invalid"
    },
    "tags": [
      "Anthropic",
      "Skill",
      "PDF",
      "Documents"
    ],
    "updatedAt": "2026-09-23",
    "status": "example",
    "review": {
      "status": "pending"
    },
    "capabilities": [
      "documents"
    ],
    "requirements": [
      "Python and PDF utilities; exact versions need verification"
    ],
    "compatibility": [
      {
        "target": "agent-skills",
        "status": "unverified",
        "notes": "Illustrative target only. No compatibility test has been recorded."
      }
    ],
    "publisher": "Anthropic",
    "packageType": "Skill",
    "releases": [],
    "guidePath": "/content/agents/skills/anthropic/anthropic-pdf/guide.md"
  },
  {
    "schemaVersion": 1,
    "id": "atlas-repo-mcp",
    "name": "Atlas Repo MCP",
    "icon": "AR",
    "description": "Browse and read authorized internal GitLab repositories.",
    "highlights": [
      "Repository search",
      "File reading"
    ],
    "riskLevel": "Unknown",
    "permissions": [
      "Read GitLab projects the signed-in identity can already access on the internal network",
      "Run the unpacked stdio binary on the local machine"
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
        "note": "Example stdio configuration for VS Code."
      }
    ],
    "maintainer": {
      "name": "Unassigned",
      "team": "Owner needed",
      "initials": "—",
      "email": "unassigned@example.invalid"
    },
    "tags": [
      "MCP",
      "GitLab",
      "Internal",
      "Stdio"
    ],
    "updatedAt": "2026-09-23",
    "status": "example",
    "review": {
      "status": "pending"
    },
    "capabilities": [
      "repository-access",
      "development"
    ],
    "mcp": {
      "transport": "stdio",
      "hosting": "local",
      "authentication": "unknown",
      "tools": [
        {
          "name": "search_repositories",
          "description": "Find repositories by name or metadata. Example capability; behavior is unverified.",
          "effect": "read"
        },
        {
          "name": "read_repository_file",
          "description": "Read a file from an authorized repository. Example capability; behavior is unverified.",
          "effect": "read"
        }
      ],
      "resources": [],
      "prompts": []
    },
    "requirements": [
      "Access to an internal GitLab instance",
      "An MCP client with stdio support"
    ],
    "compatibility": [
      {
        "target": "mcp-clients",
        "status": "unverified",
        "notes": "Illustrative target only. No compatibility test has been recorded."
      }
    ],
    "publisher": "Internal",
    "packageType": "MCP Server",
    "releases": [],
    "guidePath": "/content/agents/mcp-servers/internal/atlas-repo-mcp/guide.md"
  },
  {
    "schemaVersion": 1,
    "id": "internal-comms",
    "riskLevel": "Low",
    "permissions": [
      "Read the skill instructions and reference files",
      "Write output only when the user requests it"
    ],
    "risks": [
      "Agent behavior depends on the host and the information supplied in a prompt."
    ],
    "requirements": [
      "An Agent Skills compatible host; host loading has not been tested"
    ],
    "compatibility": [
      {
        "target": "agent-skills",
        "status": "unverified",
        "notes": "Format appears compatible; host-specific loading has not been tested."
      }
    ],
    "name": "Internal Comms",
    "icon": "IC",
    "description": "Templates and guidance for updates, newsletters, FAQs, and other internal messages.",
    "highlights": [
      "Writing",
      "Status updates",
      "FAQs"
    ],
    "capabilities": [
      "documents"
    ],
    "license": "Apache-2.0",
    "source": {
      "url": "https://github.com/anthropics/skills/tree/34040c9c568585f6929bedeaad110ad08f079624/skills/internal-comms",
      "revision": "34040c9c568585f6929bedeaad110ad08f079624"
    },
    "tags": [
      "Anthropic",
      "Skill",
      "Writing"
    ],
    "install": {
      "unpack": {
        "project": ".agents/skills/internal-comms",
        "global": "~/.agents/skills/internal-comms"
      }
    },
    "contents": [
      {
        "path": "SKILL.md",
        "kind": "skill"
      },
      {
        "path": "LICENSE.txt",
        "kind": "doc"
      },
      {
        "path": "examples",
        "kind": "doc"
      }
    ],
    "maintainer": {
      "name": "Unassigned",
      "team": "Evaluation",
      "initials": "—",
      "email": "unassigned@example.invalid"
    },
    "updatedAt": "2026-09-24",
    "status": "evaluation",
    "review": {
      "status": "reviewed",
      "date": "2026-09-24",
      "version": "1.0.0",
      "evidence": "docs/AGENT_SOURCE_REVIEW.md"
    },
    "currentVersion": "1.0.0",
    "publisher": "Anthropic",
    "packageType": "Skill",
    "releases": [
      {
        "version": "1.0.0",
        "releasedAt": "2026-09-24",
        "notes": "Tool Atlas evaluation snapshot of the pinned Anthropic skill; not an upstream release number.",
        "artifact": "internal-comms/1.0.0/internal-comms-1.0.0.zip",
        "sha256": "c96dbb73aed8cd8a7682ca392490d4d1db8e3be2914c7feef19fa5dfd6db959f",
        "archiveRoot": "internal-comms",
        "contents": [
          {
            "path": "SKILL.md",
            "kind": "skill"
          },
          {
            "path": "LICENSE.txt",
            "kind": "doc"
          },
          {
            "path": "examples",
            "kind": "doc"
          }
        ],
        "review": {
          "date": "2026-09-24",
          "evidence": "docs/AGENT_SOURCE_REVIEW.md; pnpm agents:artifacts"
        }
      }
    ],
    "guidePath": "/content/agents/skills/anthropic/internal-comms/guide.md"
  },
  {
    "schemaVersion": 1,
    "id": "mcp-server-time",
    "name": "Time MCP Server",
    "icon": "TM",
    "description": "Read the current time and convert times between IANA time zones.",
    "highlights": [
      "Current time",
      "Time zones",
      "Read only"
    ],
    "capabilities": [
      "automation"
    ],
    "riskLevel": "Low",
    "permissions": [
      "Read the local clock and time-zone configuration",
      "Run local Python code and installed dependencies"
    ],
    "risks": [
      "Installing Python dependencies may contact a package registry.",
      "Runtime safety of dependencies and each host has not been independently audited."
    ],
    "requirements": [
      "Python 3.10 or later and uv",
      "Install dependencies from the pinned uv.lock before running",
      "An MCP client with local stdio support; host compatibility unverified"
    ],
    "license": "MIT package metadata; repository notices included",
    "source": {
      "url": "https://github.com/modelcontextprotocol/servers/tree/f46d9578190b476b3501923ea8977d899e8db2cb/src/time",
      "revision": "f46d9578190b476b3501923ea8977d899e8db2cb"
    },
    "compatibility": [
      {
        "target": "mcp-clients",
        "status": "unverified",
        "notes": "The upstream unit tests passed locally; named MCP hosts and a full stdio session have not been verified."
      }
    ],
    "tags": [
      "MCP",
      "Time",
      "Local"
    ],
    "mcp": {
      "transport": "stdio",
      "hosting": "local",
      "authentication": "none",
      "tools": [
        {
          "name": "get_current_time",
          "description": "Return current time in a requested IANA time zone.",
          "effect": "read"
        },
        {
          "name": "convert_time",
          "description": "Convert a supplied time between IANA time zones.",
          "effect": "read"
        }
      ],
      "resources": [],
      "prompts": []
    },
    "contents": [
      {
        "path": ".python-version",
        "kind": "config"
      },
      {
        "path": "LICENSE",
        "kind": "doc"
      },
      {
        "path": "README.md",
        "kind": "doc"
      },
      {
        "path": "pyproject.toml",
        "kind": "config"
      },
      {
        "path": "uv.lock",
        "kind": "config"
      },
      {
        "path": "src",
        "kind": "script"
      }
    ],
    "maintainer": {
      "name": "Unassigned",
      "team": "Evaluation",
      "initials": "—",
      "email": "unassigned@example.invalid"
    },
    "updatedAt": "2026-09-24",
    "status": "evaluation",
    "review": {
      "status": "reviewed",
      "date": "2026-09-24",
      "version": "0.6.2",
      "evidence": "docs/AGENT_SOURCE_REVIEW.md"
    },
    "currentVersion": "0.6.2",
    "publisher": "Model Context Protocol",
    "packageType": "MCP Server",
    "releases": [
      {
        "version": "0.6.2",
        "releasedAt": "2026-09-24",
        "notes": "Pinned upstream 0.6.2 source snapshot; no bundled dependencies or ready-to-run binary.",
        "artifact": "mcp-server-time/0.6.2/mcp-server-time-0.6.2.zip",
        "sha256": "4f7001626e3059b00075a1df06bdcbdb013622993bc61bcb3631c060b19c0e98",
        "archiveRoot": "mcp-server-time",
        "contents": [
          {
            "path": ".python-version",
            "kind": "config"
          },
          {
            "path": "LICENSE",
            "kind": "doc"
          },
          {
            "path": "README.md",
            "kind": "doc"
          },
          {
            "path": "pyproject.toml",
            "kind": "config"
          },
          {
            "path": "uv.lock",
            "kind": "config"
          },
          {
            "path": "src",
            "kind": "script"
          }
        ],
        "review": {
          "date": "2026-09-24",
          "evidence": "docs/AGENT_SOURCE_REVIEW.md; pnpm agents:artifacts"
        }
      }
    ],
    "guidePath": "/content/agents/mcp-servers/model-context-protocol/mcp-server-time/guide.md"
  },
  {
    "schemaVersion": 1,
    "id": "openai-developers",
    "name": "OpenAI Developers Pack",
    "icon": "OA",
    "description": "Build agent apps, work with APIs, and troubleshoot integrations.",
    "highlights": [
      "Agents SDK",
      "ChatGPT Apps",
      "API troubleshooting"
    ],
    "riskLevel": "Unknown",
    "permissions": [
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
    "maintainer": {
      "name": "Unassigned",
      "team": "Owner needed",
      "initials": "—",
      "email": "unassigned@example.invalid"
    },
    "tags": [
      "OpenAI",
      "Agent pack",
      "Codex",
      "Agents SDK"
    ],
    "updatedAt": "2026-09-23",
    "status": "example",
    "review": {
      "status": "pending"
    },
    "capabilities": [
      "development",
      "automation"
    ],
    "requirements": [
      "A compatible agent host; supported versions need verification"
    ],
    "compatibility": [
      {
        "target": "codex",
        "status": "unverified",
        "notes": "Illustrative target only. No compatibility test has been recorded."
      }
    ],
    "publisher": "OpenAI",
    "packageType": "Agent Pack",
    "releases": [],
    "guidePath": "/content/agents/agent-packs/openai/openai-developers/guide.md"
  },
  {
    "schemaVersion": 1,
    "id": "theme-factory",
    "riskLevel": "Low",
    "permissions": [
      "Read the skill instructions and reference files",
      "Write output only when the user requests it"
    ],
    "risks": [
      "Agent behavior depends on the host and the information supplied in a prompt."
    ],
    "requirements": [
      "An Agent Skills compatible host; host loading has not been tested"
    ],
    "compatibility": [
      {
        "target": "agent-skills",
        "status": "unverified",
        "notes": "Format appears compatible; host-specific loading has not been tested."
      }
    ],
    "name": "Theme Factory",
    "icon": "TF",
    "description": "Ten color and font themes for presentations, documents, and other visual work.",
    "highlights": [
      "Design themes",
      "Color palettes",
      "Typography"
    ],
    "capabilities": [
      "documents"
    ],
    "license": "Apache-2.0",
    "source": {
      "url": "https://github.com/anthropics/skills/tree/34040c9c568585f6929bedeaad110ad08f079624/skills/theme-factory",
      "revision": "34040c9c568585f6929bedeaad110ad08f079624"
    },
    "tags": [
      "Anthropic",
      "Skill",
      "Design"
    ],
    "install": {
      "unpack": {
        "project": ".agents/skills/theme-factory",
        "global": "~/.agents/skills/theme-factory"
      }
    },
    "contents": [
      {
        "path": "SKILL.md",
        "kind": "skill"
      },
      {
        "path": "LICENSE.txt",
        "kind": "doc"
      },
      {
        "path": "themes",
        "kind": "doc"
      },
      {
        "path": "theme-showcase.pdf",
        "kind": "asset"
      }
    ],
    "maintainer": {
      "name": "Unassigned",
      "team": "Evaluation",
      "initials": "—",
      "email": "unassigned@example.invalid"
    },
    "updatedAt": "2026-09-24",
    "status": "evaluation",
    "review": {
      "status": "reviewed",
      "date": "2026-09-24",
      "version": "1.0.0",
      "evidence": "docs/AGENT_SOURCE_REVIEW.md"
    },
    "currentVersion": "1.0.0",
    "publisher": "Anthropic",
    "packageType": "Skill",
    "releases": [
      {
        "version": "1.0.0",
        "releasedAt": "2026-09-24",
        "notes": "Tool Atlas evaluation snapshot of the pinned Anthropic skill; not an upstream release number.",
        "artifact": "theme-factory/1.0.0/theme-factory-1.0.0.zip",
        "sha256": "58c2acd4f32ec5e89188bc17fc8698e189308ce795b168399af981618c162a1a",
        "archiveRoot": "theme-factory",
        "contents": [
          {
            "path": "SKILL.md",
            "kind": "skill"
          },
          {
            "path": "LICENSE.txt",
            "kind": "doc"
          },
          {
            "path": "themes",
            "kind": "doc"
          },
          {
            "path": "theme-showcase.pdf",
            "kind": "asset"
          }
        ],
        "review": {
          "date": "2026-09-24",
          "evidence": "docs/AGENT_SOURCE_REVIEW.md; pnpm agents:artifacts"
        }
      }
    ],
    "guidePath": "/content/agents/skills/anthropic/theme-factory/guide.md"
  },
  {
    "schemaVersion": 1,
    "id": "workplace-content-pack",
    "riskLevel": "Low",
    "permissions": [
      "Read the skill instructions and reference files",
      "Write output only when the user requests it"
    ],
    "risks": [
      "Agent behavior depends on the host and the information supplied in a prompt."
    ],
    "requirements": [
      "An Agent Skills compatible host; host loading has not been tested"
    ],
    "compatibility": [
      {
        "target": "agent-skills",
        "status": "unverified",
        "notes": "Format appears compatible; host-specific loading has not been tested."
      }
    ],
    "name": "Workplace Content Pack",
    "icon": "WP",
    "description": "Internal writing guidance and visual themes bundled as two independent skills.",
    "highlights": [
      "2 skills",
      "Writing",
      "Design themes"
    ],
    "capabilities": [
      "documents"
    ],
    "license": "Apache-2.0",
    "source": {
      "url": "https://github.com/anthropics/skills/tree/34040c9c568585f6929bedeaad110ad08f079624/skills",
      "revision": "34040c9c568585f6929bedeaad110ad08f079624"
    },
    "tags": [
      "Pack",
      "Writing",
      "Design"
    ],
    "contents": [
      {
        "path": "README.md",
        "kind": "doc"
      },
      {
        "path": "skills/internal-comms/SKILL.md",
        "kind": "skill"
      },
      {
        "path": "skills/internal-comms/LICENSE.txt",
        "kind": "doc"
      },
      {
        "path": "skills/internal-comms/examples",
        "kind": "doc"
      },
      {
        "path": "skills/theme-factory/SKILL.md",
        "kind": "skill"
      },
      {
        "path": "skills/theme-factory/LICENSE.txt",
        "kind": "doc"
      },
      {
        "path": "skills/theme-factory/themes",
        "kind": "doc"
      },
      {
        "path": "skills/theme-factory/theme-showcase.pdf",
        "kind": "asset"
      }
    ],
    "maintainer": {
      "name": "Unassigned",
      "team": "Evaluation",
      "initials": "—",
      "email": "unassigned@example.invalid"
    },
    "updatedAt": "2026-09-24",
    "status": "evaluation",
    "review": {
      "status": "reviewed",
      "date": "2026-09-24",
      "version": "1.0.0",
      "evidence": "docs/AGENT_SOURCE_REVIEW.md"
    },
    "currentVersion": "1.0.0",
    "publisher": "Tool Atlas",
    "packageType": "Agent Pack",
    "releases": [
      {
        "version": "1.0.0",
        "releasedAt": "2026-09-24",
        "notes": "Tool Atlas curated bundle of two pinned Anthropic skills; not an upstream Anthropic pack.",
        "artifact": "workplace-content-pack/1.0.0/workplace-content-pack-1.0.0.zip",
        "sha256": "3c4823e346af2c6332c4f413579c87d3cf1e22af9d0e4030ee9eaf391c49376b",
        "archiveRoot": "workplace-content-pack",
        "contents": [
          {
            "path": "README.md",
            "kind": "doc"
          },
          {
            "path": "skills/internal-comms/SKILL.md",
            "kind": "skill"
          },
          {
            "path": "skills/internal-comms/LICENSE.txt",
            "kind": "doc"
          },
          {
            "path": "skills/internal-comms/examples",
            "kind": "doc"
          },
          {
            "path": "skills/theme-factory/SKILL.md",
            "kind": "skill"
          },
          {
            "path": "skills/theme-factory/LICENSE.txt",
            "kind": "doc"
          },
          {
            "path": "skills/theme-factory/themes",
            "kind": "doc"
          },
          {
            "path": "skills/theme-factory/theme-showcase.pdf",
            "kind": "asset"
          }
        ],
        "review": {
          "date": "2026-09-24",
          "evidence": "docs/AGENT_SOURCE_REVIEW.md; pnpm agents:artifacts"
        }
      }
    ],
    "guidePath": "/content/agents/agent-packs/tool-atlas/workplace-content-pack/guide.md"
  }
] satisfies AgentPackage[];
