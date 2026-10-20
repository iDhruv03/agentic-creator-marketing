# Multi-stage Docker build for CMI Platform
FROM node:22-alpine AS builder

WORKDIR /app

# Copy root and workspace definitions
COPY package.json ./
COPY server/package.json ./server/
COPY client/package.json ./client/

# Install dependencies
RUN npm install
RUN cd server && npm install
RUN cd ../client && npm install

# Copy source code
COPY server/ ./server/
COPY client/ ./client/

# Build backend and frontend
RUN cd server && npm run build
RUN cd ../client && npm run build

# Seed database
RUN cd server && npm run seed

# Production image
FROM node:22-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3001

COPY --from=builder /app/server/package.json ./server/
COPY --from=builder /app/server/node_modules ./server/node_modules
COPY --from=builder /app/server/dist ./server/dist
COPY --from=builder /app/server/src/db/schema.sql ./server/dist/db/schema.sql
COPY --from=builder /app/server/data ./server/data
COPY --from=builder /app/client/dist ./client/dist

EXPOSE 3001

WORKDIR /app/server
CMD ["node", "dist/index.js"]
