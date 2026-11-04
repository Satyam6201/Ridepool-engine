FROM node:20-alpine AS build
WORKDIR /app
COPY shared ./shared
RUN cd shared && npm install --omit=dev
COPY services/realtime-service/package*.json ./services/realtime-service/
RUN cd services/realtime-service && npm install --omit=dev

FROM node:20-alpine
WORKDIR /app
USER node
COPY --from=build --chown=node:node /app/shared ./shared
COPY --from=build --chown=node:node /app/services/realtime-service/node_modules ./services/realtime-service/node_modules
COPY --chown=node:node services/realtime-service ./services/realtime-service
WORKDIR /app/services/realtime-service
EXPOSE 3006
HEALTHCHECK --interval=10s --timeout=3s --retries=3 \
  CMD node -e "fetch('http://localhost:3006/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"
CMD ["node", "src/server.js"]
