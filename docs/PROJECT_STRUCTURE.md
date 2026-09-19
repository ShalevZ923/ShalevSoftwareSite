# Production project structure

Tool Atlas remains a static, backend-free public catalog. Its source tree separates public catalog data, generated application data, deployment configuration, and review automation so that a content contribution cannot quietly change production infrastructure.

```text
.
├── content/
│   ├── taxonomy/categories.json       # Canonical category IDs and display labels
│   ├── catalog/<category>/<vendor>/<tool>/
│   │   ├── vendor.json                # Shared vendor name for this category
│   │   ├── tool.json                  # Product metadata and support ownership
│   │   ├── guide.md                   # Catalog-safe install and support guidance
│   │   └── releases/<version>.json    # One reviewed download target per version
│   └── templates/                     # Copy-only starting points; never catalog input
├── src/                               # React application source and unit tests
│   └── generated/catalog.ts           # Generated only; checked for staleness in CI
├── scripts/                           # Content validation, generation, and contribution adapters
├── public/                            # Static assets and host response-header configuration
│   └── catalog/v1/{index,tools}.json  # Generated machine feed; no backend, no guides
├── docs/                              # Operating, security, and deployment documentation
├── .github/ and .gitlab/              # Approval-gated contribution automation
└── Dockerfile, compose.yaml, Caddyfile, nginx.conf
                                      # Production image, isolation, TLS edge, static serving
```

## Catalog ownership model

The directory hierarchy is the catalog’s routing and ownership key:

1. **Category** is a controlled taxonomy path, such as `development/ides-and-editors` or `development/extensions-and-add-ons`.
2. **Vendor** is a normalized company directory with a single `vendor.json` display name.
3. **Tool** is the stable lowercase identifier used by the application and shareable URLs.
4. **Release** is a separate immutable-in-intent record containing one version and its approved HTTPS download URL.

The build validates every part: category membership, normalized vendor and product paths, required guide sections, unique tool/order/version values, credential-free HTTPS download URLs, and static-safe content. It then emits the data the frontend reads plus a compact machine feed at `/catalog/v1/`. This means filesystem organization improves review without adding backend exposure or public operational data.

## Taxonomy growth

The initial taxonomy covers editors and IDEs, IDE/extensions, debuggers, profilers, test automation, API/performance testing, containers, database tools, infrastructure diagnostics, web/edge infrastructure, and application security. When the comprehensive classification is ready, update `content/taxonomy/categories.json` in the same pull request as any affected directory moves. Treat category IDs as stable API-like identifiers: add a new reusable leaf rather than renaming one casually.

## Operating rules

- Product content is public-catalog data only. Licences, contracts, seat assignments, purchase records, credentials, activation material, private contacts, and audit notes stay in the separate private admin system.
- A new release normally adds `releases/<version>.json`; it does not replace the currently approved release record. Remove or correct a record only with an explicit reviewed reason.
- Run `pnpm verify` for every content, taxonomy, script, or deployment change. It validates sources, checks generated data, runs tests, builds the production bundle, and verifies the `dist/` artifact.
- Keep deployment files separate from application and catalog changes in review. The application container and Caddy edge configuration are production controls, not content configuration.

For day-to-day additions, use [the catalog content guide](../CATALOG_CONTENT_GUIDE.md). For TLS deployment and operational host setup, use [the README deployment guide](../README.md#production-deployment-with-docker-and-https).
