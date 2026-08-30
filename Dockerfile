FROM node:24-alpine AS build

WORKDIR /app
RUN corepack enable

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY index.html tsconfig.json tsconfig.app.json vite.config.ts ./
COPY public ./public
COPY src ./src
RUN pnpm build

FROM nginx:1.28-alpine AS runtime

COPY nginx.conf /etc/nginx/nginx.conf
COPY --from=build /app/dist /usr/share/nginx/html
RUN rm /usr/share/nginx/html/_headers

USER nginx
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:8080/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
