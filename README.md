# Tool Atlas

Tool Atlas is a static software catalog for developers. It provides searchable software records, support ownership, trusted download links, and browser-rendered Markdown guides. It has no backend, account system, or application secrets.

The catalog supports shareable filter URLs and a saved-tools list. Saved tools are stored only in the visitor's browser; they are never sent to a server or included in shared links.

## Local development

```bash
pnpm install --frozen-lockfile
pnpm dev
```

## Content model

Update `src/data.ts` to add or change catalog records. Every tool needs a stable `id`, ownership details, platform/lifecycle metadata, a trusted download URL, tags, and a corresponding Markdown guide in `docs`.

Each Markdown guide must include `## Install` and `## Support`; the documentation rail links to those sections.

For copy-paste examples, images, optional catalog facts such as license references, and the safety boundary for sensitive values, see [CATALOG_CONTENT_GUIDE.md](./CATALOG_CONTENT_GUIDE.md).

## Release gate

```bash
pnpm verify
pnpm audit --prod
```

`pnpm verify` runs unit tests, builds the production bundle, and validates the generated `dist/` artifact. Deploy only the contents of `dist/`.

`public/_headers` is copied to `dist/_headers` for Cloudflare Pages and Netlify-compatible static hosting. For other hosts, apply the equivalent response headers at the CDN or web-server layer before production promotion.

## Container deployment

The optional container image builds the static bundle and serves it with NGINX as the unprivileged `nginx` user on port 8080:

```bash
docker build -t tool-atlas:local .
docker run --rm -p 8080:8080 tool-atlas:local
```

It sends the same security headers as `_headers` and includes a built-in HTTP health check. No runtime configuration or secrets are required.
