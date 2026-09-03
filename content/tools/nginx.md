---
{
  "id": "nginx",
  "order": 8,
  "name": "NGINX",
  "company": "F5, Inc.",
  "category": "Server",
  "platforms": ["Linux"],
  "lifecycle": "Current",
  "icon": "NX",
  "version": "1.28",
  "updated": "Jul 15",
  "description": "A high-performance web server, reverse proxy, and load balancer for internal application delivery.",
  "support": {"name": "Avi Shaham", "team": "Infrastructure", "initials": "AS", "email": "infra@atlas.local"},
  "download": "https://nginx.org/en/download.html",
  "tags": ["Server", "Reverse proxy", "Linux"]
}
---
# NGINX

NGINX is supported for approved Linux web-delivery workloads. Platform Engineering owns base images, security updates, and common reverse-proxy patterns.

## Install

Use the Platform Engineering base image or approved package repository. Do not use unmaintained community images for production services.

## Support

Platform Engineering supports base images, security updates, and standard reverse-proxy patterns.
