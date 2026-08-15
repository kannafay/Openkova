FROM node:24-slim AS base
RUN npm install -g pnpm@10.33.0

FROM base AS builder
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY packages/core/package.json ./packages/core/
COPY apps/web/package.json ./apps/web/
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

FROM node:24-slim AS runner
WORKDIR /app

RUN apt-get \
      -o Acquire::Retries=5 \
      -o Acquire::http::Pipeline-Depth=0 \
      update \
  && apt-get \
      -o Acquire::Retries=5 \
      -o Acquire::http::Pipeline-Depth=0 \
      install -y \
      ca-certificates \
      --no-install-recommends \
  && sed -i 's|http://deb.debian.org|https://deb.debian.org|g' \
      /etc/apt/sources.list.d/debian.sources \
  && apt-get update \
  && apt-get \
      -o Acquire::Retries=5 \
      install -y \
      chromium \
      fonts-liberation \
      fonts-noto-core \
      fonts-noto-cjk \
      fonts-noto-color-emoji \
      fonts-urw-base35 \
      fonts-crosextra-carlito \
      fonts-crosextra-caladea \
      --no-install-recommends \
  && rm -rf /var/lib/apt/lists/*

COPY internal-fonts/arial/ /usr/local/share/fonts/truetype/arial/
COPY fontconfig-local.conf /etc/fonts/conf.d/99-openkova-font-aliases.conf
RUN fc-cache -f

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV CHROMIUM_PATH=/usr/bin/chromium

COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY docker-entrypoint.sh /usr/local/bin/openkova-entrypoint

RUN chmod +x /usr/local/bin/openkova-entrypoint && mkdir -p /data
ENV OPENKOVA_STORAGE_PATH=/data

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
CMD ["openkova-entrypoint"]
