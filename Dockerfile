FROM node:26-alpine@sha256:ef24c5053d50fdc3e4e56eb4e7ddb7861874ab0fdc797046ba897581deb8e868 AS build

WORKDIR /app
# Node 26 no longer ships Corepack; install it so packageManager (pnpm) still works.
RUN npm install -g corepack && corepack enable

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY index.html tsconfig.json tsconfig.app.json vite.config.ts ./
COPY public ./public
COPY content ./content
COPY scripts ./scripts
COPY src ./src
ARG VITE_APP_VERSION=1.7.1-beta.1
RUN pnpm build

# Optional local authoring image; the default final target remains static NGINX.
FROM build AS studio
COPY --chown=node:node docs ./docs
RUN mkdir -p /app/guide-library /app/packages && chown -R node:node /app
USER node
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 CMD node -e "fetch('http://127.0.0.1:8080/api/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"
CMD ["node", "scripts/server.mjs"]

FROM nginx:1.31-alpine@sha256:72ba65eb42c10344912a84ff42408db7d34f2feb642204570ab8fc5ffd29f1d3 AS runtime

ARG VERSION=dev
ARG VCS_REF=unknown
LABEL org.opencontainers.image.source="https://github.com/ShalevZ923/ShalevSoftwareSite" \
  org.opencontainers.image.title="Tool Atlas" \
  org.opencontainers.image.description="Static Tool Atlas production site" \
  org.opencontainers.image.version="${VERSION}" \
  org.opencontainers.image.revision="${VCS_REF}"

COPY nginx.conf /etc/nginx/nginx.conf
COPY --from=build /app/dist /usr/share/nginx/html
RUN rm /usr/share/nginx/html/_headers

USER nginx
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:8080/api/health || exit 1

CMD ["nginx", "-g", "daemon off;"]
