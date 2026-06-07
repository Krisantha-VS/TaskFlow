# ── Stage 1: build ──────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

ARG DATABASE_URL
ENV DATABASE_URL=$DATABASE_URL

# Copy package.json + prisma schema before npm ci (postinstall runs prisma generate)
COPY package*.json ./
COPY prisma ./prisma
RUN npm ci

# Copy rest of source
COPY . .

# Build — produces .next/standalone + .next/static
RUN npm run build

# ── Stage 2: run ────────────────────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Copy only what's needed to run
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

EXPOSE 3000
CMD ["node", "server.js"]
