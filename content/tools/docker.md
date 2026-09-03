---
{
  "id": "docker",
  "order": 3,
  "name": "Docker Desktop",
  "company": "Docker, Inc.",
  "category": "Containers",
  "platforms": ["Windows", "Linux", "macOS"],
  "lifecycle": "Current",
  "icon": "DK",
  "releases": [
    { "version": "4.45", "download": "https://www.docker.com/products/docker-desktop/" }
  ],
  "updated": "3 days ago",
  "description": "Local container development with Docker Compose, image management, and a desktop dashboard for runtime inspection.",
  "support": {"name": "Noam Levi", "team": "Platform Engineering", "initials": "NL", "email": "platform@atlas.local"},

  "tags": ["Containers", "Runtime", "DevOps"]
}
---
# Docker Desktop

Docker Desktop provides the supported local container runtime for macOS and Windows. Linux hosts can use Docker Engine where appropriate.

## Install

1. Confirm virtualization is enabled.
2. Sign in using your approved organization account.
3. Run `docker version` and `docker compose version`.

## Support

Platform Engineering supports the approved runtime and base configuration. Application teams own their compose files and images.
