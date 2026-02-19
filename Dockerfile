# syntax=docker/dockerfile:1

FROM node:22-alpine AS base
RUN corepack enable

# ── Dependencies ────────────────────────────────────────────────────────────
FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/shared/package.json       packages/shared/package.json
COPY packages/gateway/package.json      packages/gateway/package.json
COPY packages/runtime/package.json      packages/runtime/package.json
COPY packages/tools/package.json        packages/tools/package.json
COPY packages/plugins/package.json      packages/plugins/package.json
COPY packages/cli/package.json          packages/cli/package.json
COPY packages/node/package.json         packages/node/package.json
COPY packages/skills/package.json       packages/skills/package.json
COPY packages/config/package.json       packages/config/package.json
COPY packages/providers/telegram/package.json   packages/providers/telegram/package.json
COPY packages/providers/whatsapp/package.json   packages/providers/whatsapp/package.json
COPY packages/providers/slack/package.json      packages/providers/slack/package.json
COPY packages/providers/discord/package.json    packages/providers/discord/package.json
RUN pnpm install --frozen-lockfile

# ── Build ────────────────────────────────────────────────────────────────────
FROM deps AS build
COPY . .
RUN pnpm build

# ── Runtime image ─────────────────────────────────────────────────────────────
FROM node:22-alpine AS runtime
RUN corepack enable

# Create a non-root user
RUN addgroup -S homeagent && adduser -S homeagent -G homeagent -u 1001

WORKDIR /app

# Copy only built artefacts and production node_modules
COPY --from=build --chown=homeagent:homeagent /app/node_modules     ./node_modules
COPY --from=build --chown=homeagent:homeagent /app/packages         ./packages
COPY --from=build --chown=homeagent:homeagent /app/package.json     ./package.json
COPY --from=build --chown=homeagent:homeagent /app/pnpm-workspace.yaml ./pnpm-workspace.yaml

# Data directory (mounted as a named volume in production)
RUN mkdir -p /home/homeagent/.homeagent && chown homeagent:homeagent /home/homeagent/.homeagent

USER homeagent

EXPOSE 3000

CMD ["node", "packages/gateway/dist/index.js"]
