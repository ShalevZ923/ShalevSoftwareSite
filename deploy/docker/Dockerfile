# syntax=docker/dockerfile:1

ARG NODE_IMAGE=node:24.22.2-alpine3.24@sha256:8a32c8cf649a49915a66e81e7a609223c708d0adabf288ee3f4077d765542f85
# Alpine-slim keeps the runtime package set small while retaining wget for healthchecks.
ARG NGINX_IMAGE=nginx:1.31.8-alpine3.24-slim@sha256:f45171d36c76a8b2f5ef97108a3a8a2294248a6578a0a180edc2d78f7d2edc26

FROM ${NODE_IMAGE} AS build

# package.json pins the package manager version used by Corepack.
RUN corepack enable

WORKDIR /app
RUN chown node:node /app
USER node

COPY --chown=node:node package.json pnpm-lock.yaml .npmrc ./
RUN --mount=type=cache,target=/home/node/.cache/node/corepack,uid=1000,gid=1000 \
    --mount=type=cache,target=/home/node/.local/share/pnpm/store,uid=1000,gid=1000 \
    pnpm install --frozen-lockfile

COPY --chown=node:node index.html tsconfig.json vite.config.ts ./
COPY --chown=node:node config ./config
COPY --chown=node:node public ./public
COPY --chown=node:node content ./content
COPY --chown=node:node scripts ./scripts
COPY --chown=node:node src ./src
ARG VITE_APP_VERSION=1.8.0
ARG VITE_HIDDEN_PAGES=""
ARG VITE_SUPPORT_EMAIL=""
ARG VITE_MCP_URL=""
RUN --mount=type=cache,target=/home/node/.cache/node/corepack,uid=1000,gid=1000 \
    pnpm build

# Optional local authoring image; the default final target remains static NGINX.
FROM build AS studio
COPY --chown=node:node docs ./docs
USER root
RUN mkdir -p /app/guide-library /app/packages && chown -R node:node /app
USER node
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 CMD node -e "fetch('http://127.0.0.1:8080/api/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"
CMD ["node", "scripts/server.mjs"]

FROM ${NGINX_IMAGE} AS runtime

ARG VERSION=dev
ARG VCS_REF=unknown
LABEL org.opencontainers.image.source="https://github.com/ShalevZ923/ShalevSoftwareSite" \
  org.opencontainers.image.title="Tool Atlas" \
  org.opencontainers.image.description="Static Tool Atlas production site" \
  org.opencontainers.image.version="${VERSION}" \
  org.opencontainers.image.revision="${VCS_REF}"

COPY deploy/docker/nginx.conf /etc/nginx/nginx.conf
COPY --from=build --chown=nginx:nginx /app/dist /usr/share/nginx/html
RUN rm /usr/share/nginx/html/_headers && mkdir -p /srv/tool-atlas-packages /srv/tool-atlas-guides

USER nginx
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:8080/api/health || exit 1

# The configuration is baked into the image, so the upstream entrypoint's
# runtime template and default-site mutation scripts are not needed.
ENTRYPOINT ["nginx"]
CMD ["-g", "daemon off;"]
