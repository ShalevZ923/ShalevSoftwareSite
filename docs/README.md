# Tool Atlas internal documentation

This is the master index for developer, catalog-maintainer and operator documentation. Start here when looking for a workflow or deciding where a new document belongs.

## Start with your task

- **Review remaining maintenance work:** [Current maintainer/developer checklist](development/MAINTENANCE_CHECKLIST.md).
- **Develop or maintain the app:** [Developer guide](development/DEVELOPER_GUIDE.md), then [project structure](development/PROJECT_STRUCTURE.md).
- **Edit software or system docs locally:** [Developer Studio](development/DEVELOPER_STUDIO.md).
- **Maintain catalog records:** [Software catalog guide](catalog/CATALOG_CONTENT_GUIDE.md).
- **Deploy or recover a host:** [Production deployment](deployment/PRODUCTION_DEPLOYMENT.md), then the Docker or Windows guide for that host.
- **Review security or source publication:** the [security assessment](security/SECURITY_REPORT.md) and [publication checklist](security/OPEN_SOURCE_READINESS.md).
- **Check a version's scope and acceptance:** [release notes index](releases/README.md).

1.7.2 is a local maintenance candidate. Native Windows acceptance remains pending. Version notes and dated assessments describe their own scope; moving a document does not establish new deployment or security evidence.

## Documentation folders and files

### `development/`

- [Maintainer and developer checklist](development/MAINTENANCE_CHECKLIST.md) — Latest independent review, verified fixes, remaining priorities and acceptance criteria.
- [Developer setup and maintenance](development/DEVELOPER_GUIDE.md) — Supported runtimes, npm/pnpm commands, HMR, checks, draft revisions and save recovery.
- [Architecture and source ownership](development/PROJECT_STRUCTURE.md) — Repository boundaries, catalog hierarchy, taxonomy changes and operating rules.
- [Local Developer Studio](development/DEVELOPER_STUDIO.md) — Protected authoring setup, token handling, editing workflow and local trust boundary.

### `catalog/`

- [Software catalog authoring](catalog/CATALOG_CONTENT_GUIDE.md) — Metadata, releases, guides, resource examples and approved contribution paths.
- [Machine feed contract](catalog/CATALOG_MACHINE_FEED.md) — Generated JSON endpoints, supported fields, regeneration and client integration.
- [Guide resource administration](catalog/GUIDE_RESOURCE_INGESTION.md) — Adding approved links and library files, ownership, reviews and version applicability.

### `contributing/`

- [GitLab contribution workflow](contributing/GITLAB_CATALOG_CONTRIBUTION.md) — Project setup, approval digests, manual merge-request creation, recovery and token rotation.

### `deployment/`

- [Production deployment and rollback](deployment/PRODUCTION_DEPLOYMENT.md) — Versioned image guidance, digest pinning, deployment evidence and recovery.
- [Windows and IIS operations](deployment/WINDOWS_DEPLOYMENT.md) — Static-site deployment, installer publishing, permissions, logs and service recovery.
- [Docker and optional Studio operations](deployment/DOCKER_OPERATIONS.md) — Compose startup, Caddy settings, health checks and persistent local authoring.
- [Hosted-download validation](deployment/HOSTED_DOWNLOADS.md) — Checksum-verified installer publication and same-server download checks.

### `security/`

- [Security assessment record](security/SECURITY_REPORT.md) — Dated source/configuration review, verified controls and remaining operational risks; it is not a new scan.
- [Source publication checklist](security/OPEN_SOURCE_READINESS.md) — Licensing, repository hygiene, review and external publication decisions.

### `releases/`

- [Release notes index](releases/README.md) — links to each version, distinguishes local candidates from historical version notes, and points to outstanding acceptance gates.

## Documentation elsewhere in the repository

- [Repository README](../README.md) — product overview and quick start.
- [Contribution policy](../CONTRIBUTING.md), [security reporting policy](../SECURITY.md), and [code of conduct](../CODE_OF_CONDUCT.md) — repository-wide policies kept at the root for hosting-platform discovery.
- [Software source layout](../content/catalog/README.md) and `content/catalog/<category>/<vendor>/<tool>/guide.md` — catalog-safe product guidance rendered in the app; operational docs belong here in `docs/`.
- [Machine-feed directory](../public/catalog/README.md) — generated output location and a link to its contract.
- `content/templates/` — starting points for content contributions.
- `.github/` and `.gitlab/` — submission templates and review automation.
- `guide-library/` — approved PDF/PPTX files served with catalog resources; uploaded files have their own ownership and review metadata.
- `vendor/` — pinned upstream files, documentation and licence notices; keep their source layout intact.
- `deliverables/` — ignored local reports, screenshots and verification evidence; these are not the canonical checked-in guides.

## Maintaining this structure

Keep one canonical guide per subject. Put current workflow instructions in the appropriate subject folder, version-specific notes in `releases/`, and dated assessment evidence under `security/` or the relevant review folder. Add a short description and link here when adding a guide; update links when moving one.

Developer Studio's **System docs** lists nested Markdown files by their path relative to `docs/`. The master README opens first, and searches match both folder and filename. Public catalog guides continue to live with their catalog records.
