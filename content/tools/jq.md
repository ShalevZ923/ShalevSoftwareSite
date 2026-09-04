---
{
  "id": "jq",
  "order": 9,
  "name": "jq",
  "company": "jqlang",
  "category": "Debugging",
  "platforms": ["Windows"],
  "lifecycle": "New",
  "icon": "JQ",
  "releases": [
    { "version": "1.8.2", "artifact": "jq/1.8.2/jq-windows-amd64.exe" }
  ],
  "updated": "Today",
  "description": "A lightweight command-line JSON processor, hosted here as the same-server download proof of concept.",
  "support": {"name": "Noam Levi", "team": "Platform Engineering", "initials": "NL", "email": "platform@atlas.local"},
  "tags": ["JSON", "CLI", "Windows", "PoC"]
}
---
# jq

This entry proves that Tool Atlas can serve a reviewed installer directly from its own package storage instead of redirecting to a vendor URL.

## Install

1. Select version **1.8.2** and choose **Download**.
2. Save `jq-windows-amd64.exe` to an approved directory.
3. Rename it to `jq.exe` if desired and add that directory to `PATH` according to workstation policy.
4. Run `jq --version` and confirm it reports `jq-1.8.2`.

The proof-of-concept publisher validates the official SHA-256 digest before the file becomes visible under `/downloads/jq/1.8.2/`.

## Support

Contact Platform Engineering if the checksum fails, the download is unavailable, or a different Windows architecture is required.
