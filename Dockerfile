FROM node:22-alpine AS builder

WORKDIR /app

# Install frontend dependencies
COPY package.json package-lock.json ./
RUN npm ci

# Install server dependencies
COPY server/package.json server/package-lock.json ./server/
RUN cd server && npm ci

# Copy source code
COPY . .

# Build frontend (Preact + Vite)
RUN npm run build

# Prepare server public directory
RUN mkdir -p server/dist/public && cp -r dist/* server/dist/public/

# Generate Prisma client and build server
RUN cd server && npx prisma generate && npx tsc

# ── Production stage ──
FROM node:22-alpine

WORKDIR /app

# Copy production artifacts from builder
COPY --from=builder /app/server/dist ./server/dist
COPY --from=builder /app/server/node_modules ./server/node_modules
COPY --from=builder /app/server/prisma ./server/prisma
COPY --from=builder /app/server/package.json ./server/
COPY server/entrypoint.sh ./server/entrypoint.sh

# Create uploads directory
RUN mkdir -p server/uploads && chmod +x server/entrypoint.sh

EXPOSE 3001

ENV NODE_ENV=production

CMD ["/app/server/entrypoint.sh"]
