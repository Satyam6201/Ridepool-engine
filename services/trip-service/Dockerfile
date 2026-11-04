FROM node:20-alpine AS build
WORKDIR /app
COPY shared ./shared
RUN cd shared && npm install --omit=dev
COPY services/trip-service/package*.json ./services/trip-service/
RUN cd services/trip-service && npm install --omit=dev

FROM node:20-alpine
WORKDIR /app
USER node
COPY --from=build --chown=node:node /app/shared ./shared
COPY --from=build --chown=node:node /app/services/trip-service/node_modules ./services/trip-service/node_modules
COPY --chown=node:node services/trip-service ./services/trip-service
WORKDIR /app/services/trip-service
EXPOSE 3003
HEALTHCHECK --interval=10s --timeout=3s --retries=3 \
  CMD node -e "fetch('http://localhost:3003/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"
CMD ["node", "src/server.js"]
