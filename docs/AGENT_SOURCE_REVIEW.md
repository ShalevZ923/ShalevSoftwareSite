# Agent catalog evaluation source review

Reviewed locally on 2026-09-24. These are exact-source evaluation archives, not a claim that every IDE host supports them or that all transitive dependencies are safe. The catalog status remains `evaluation`; no support owner has been assigned.

| Catalog item | Pinned upstream source | Included files | License evidence |
| --- | --- | --- | --- |
| Internal Comms | [anthropics/skills, `34040c9`](https://github.com/anthropics/skills/tree/34040c9c568585f6929bedeaad110ad08f079624/skills/internal-comms) | Upstream `SKILL.md`, `examples/`, `LICENSE.txt` | Bundled Apache-2.0 `LICENSE.txt` |
| Theme Factory | [anthropics/skills, `34040c9`](https://github.com/anthropics/skills/tree/34040c9c568585f6929bedeaad110ad08f079624/skills/theme-factory) | Upstream `SKILL.md`, `themes/`, PDF showcase, `LICENSE.txt` | Bundled Apache-2.0 `LICENSE.txt` |
| Workplace Content Pack | Same two pinned Anthropic skills | Both unchanged skill folders and a Tool Atlas composition README | Each bundled skill keeps its own Apache-2.0 license |
| Time MCP Server | [modelcontextprotocol/servers, `f46d957`](https://github.com/modelcontextprotocol/servers/tree/f46d9578190b476b3501923ea8977d899e8db2cb/src/time) | Upstream Python package, README, lockfile, Python version, and repository `LICENSE`; no `test/`, Dockerfile, or dependencies | `pyproject.toml` declares MIT; repository license notices are bundled |

The original files are tracked in `vendor/agent-catalog/` at those revisions. They were read for execution paths, external access, file access, and license terms. Internal Comms and Theme Factory contain instructions, Markdown references, and a PDF asset, with no executable source. Their instructions can affect an agent's output, so users should still read them before enabling a skill. The Time server's two declared tools read the local clock and time-zone data; the reviewed server source does not itself open a network connection or write user files. Dependency installation with `uv sync` may access a package registry, and the dependency tree has not received an independent security audit.

## Local verification

- `pnpm agents:packages` rebuilds deterministic ZIPs from the tracked snapshots, compares each SHA-256 with its release record, and audits archive paths and content coverage. Four ZIPs passed this check.
- The Time ZIP was extracted to a temporary directory; `uv sync --locked --no-dev` installed the lockfile dependencies. The upstream Time unit suite passed against that extracted package: **38 passed**.
- A direct MCP stdio initialization attempt timed out in this environment. A named IDE integration or complete protocol exchange has **not** been verified. The archive remains for evaluation, with no one-click MCP install claim.
- Browser delivery checks verify that the local server returns a ZIP and its advertised SHA-256. A browser download is not itself a runtime safety check.

| ZIP | SHA-256 |
| --- | --- |
| `internal-comms-1.0.0.zip` | `c96dbb73aed8cd8a7682ca392490d4d1db8e3be2914c7feef19fa5dfd6db959f` |
| `theme-factory-1.0.0.zip` | `58c2acd4f32ec5e89188bc17fc8698e189308ce795b168399af981618c162a1a` |
| `workplace-content-pack-1.0.0.zip` | `3c4823e346af2c6332c4f413579c87d3cf1e22af9d0e4030ee9eaf391c49376b` |
| `mcp-server-time-0.6.2.zip` | `4f7001626e3059b00075a1df06bdcbdb013622993bc61bcb3631c060b19c0e98` |

The existing PDF example is not packaged: its upstream license restricts redistribution. The OpenAI Developers and internal Atlas MCP examples also remain illustrative and have no downloadable release.
