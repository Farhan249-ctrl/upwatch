# Stage 1: Production dependencies
FROM node:20.18-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

# Stage 2: Production runner
FROM node:20.18-alpine AS runner
WORKDIR /app

RUN apk add --no-cache curl

ENV NODE_ENV=production

COPY --from=deps --chown=node:node /app/node_modules ./node_modules
COPY --chown=node:node package*.json ./
COPY --chown=node:node src ./src

USER node

EXPOSE 4000

HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:${API_PORT:-4000}/api/health || exit 1

CMD ["node", "src/index.js"]
