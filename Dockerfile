# ── Stage 1: Build ────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files first for layer caching
COPY package.json ./
COPY shared/package.json shared/
COPY server/package.json server/
COPY client/package.json client/

# Install all dependencies
RUN cd shared && npm install --ignore-scripts
RUN cd server && npm install --ignore-scripts
RUN cd client && npm install --ignore-scripts

# Copy source
COPY shared/ shared/
COPY server/ server/
COPY client/ client/

# Build client
RUN cd client && npm run build

# Build server
RUN cd server && npx tsc

# ── Stage 2: Production ──────────────────────────────────────
FROM node:20-alpine AS production

WORKDIR /app

# Copy server package and install prod deps only
COPY server/package.json server/
RUN cd server && npm install --omit=dev --ignore-scripts

# Copy built artifacts
COPY --from=builder /app/server/dist server/dist
COPY --from=builder /app/client/dist client/dist

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["node", "server/dist/server/src/index.js"]
