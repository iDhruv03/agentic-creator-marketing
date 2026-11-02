# ---- build stage ------------------------------------------------------------
FROM node:22-alpine AS build
WORKDIR /app

COPY server/package*.json ./server/
COPY client/package*.json ./client/
RUN npm --prefix server ci && npm --prefix client ci

COPY server ./server
COPY client ./client
RUN npm --prefix server run build && npm --prefix client run build

# ---- runtime stage ----------------------------------------------------------
FROM node:22-alpine AS runtime
ENV NODE_ENV=production PORT=3001
WORKDIR /app

COPY server/package*.json ./server/
RUN npm --prefix server ci --omit=dev
COPY --from=build /app/server/dist ./server/dist
COPY --from=build /app/client/dist ./client/dist

VOLUME ["/app/server/data"]
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://localhost:3001/health || exit 1
CMD ["node", "server/dist/index.js"]
