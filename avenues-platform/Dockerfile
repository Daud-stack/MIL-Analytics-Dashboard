# ============================================
# Avenues Clinic Intelligence Platform
# Multi-stage Docker build for Next.js
# ============================================

# Stage 1: Install dependencies
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

COPY package.json package-lock.json* ./
COPY prisma ./prisma/

RUN npm ci --legacy-peer-deps

# Generate Prisma client
RUN npx prisma generate

# Stage 2: Build the application
FROM node:20-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Set build-time environment variables
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# Generate Prisma client (in case of postinstall issues)
RUN npx prisma generate

# Build Next.js
RUN npm run build

# Stage 3: Production runner
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy public assets
COPY --from=builder /app/public ./public

# Copy the standalone output (if using standalone output mode)
# For standard output, copy .next and node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/next.config.ts ./next.config.ts
COPY --from=builder /app/tsconfig.json ./tsconfig.json

# Create data directory for SQLite
RUN mkdir -p /app/prisma/data && chown -R nextjs:nodejs /app/prisma
RUN chown -R nextjs:nodejs /app/.next

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Run database migrations and start
CMD ["sh", "-c", "npx prisma migrate deploy 2>/dev/null; npx prisma db push --accept-data-loss 2>/dev/null; npm start"]
