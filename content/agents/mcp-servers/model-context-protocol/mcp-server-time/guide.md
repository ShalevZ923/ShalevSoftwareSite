## Overview

A source ZIP of the official MCP Time server at pinned revision `f46d9578190b476b3501923ea8977d899e8db2cb`. It provides two read-only tools over local stdio: `get_current_time` and `convert_time`. The archive contains upstream Python source, `pyproject.toml`, `uv.lock`, README, and repository license notices.

## Use

Download and verify the ZIP, then extract `mcp-server-time/`. In that folder, run `uv sync --locked --no-dev` and configure a local stdio MCP client to run `.venv/bin/python -m mcp_server_time` from that folder. Dependency installation uses the Python package registry unless already cached. Review the files and your client's permission model before use.

## Support

Evaluation listing. The pinned source passed upstream unit tests locally, but an end-to-end stdio session and named IDE hosts are not certified. Dependencies have not received an independent security audit. [Upstream source](https://github.com/modelcontextprotocol/servers/tree/f46d9578190b476b3501923ea8977d899e8db2cb/src/time).
