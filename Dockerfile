# syntax=docker/dockerfile:1
ARG NODE_IMAGE=docker.io/library/node:24-alpine

# --- dependencies ---
FROM ${NODE_IMAGE} AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# --- development (laptop): source is mounted from the host ---
FROM ${NODE_IMAGE} AS dev
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1 PRISMA_HIDE_UPDATE_MESSAGE=1
COPY --from=deps /app/node_modules ./node_modules
EXPOSE 3000
CMD ["npm", "run", "dev", "--", "--hostname", "0.0.0.0"]

# --- production build ---
FROM ${NODE_IMAGE} AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1 PRISMA_HIDE_UPDATE_MESSAGE=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# --- production runtime (Synology): small image, non-root user ---
FROM ${NODE_IMAGE} AS prod
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0 PORT=3000
COPY --from=build --chown=node:node /app/public ./public
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
USER node
EXPOSE 3000
CMD ["node", "server.js"]
