FROM node:20-alpine AS build
WORKDIR /app
COPY shared ./shared
RUN cd shared && npm install --omit=dev
COPY services/driver-service/package*.json ./services/driver-service/
RUN cd services/driver-service && npm install --omit=dev

FROM node:20-alpine
WORKDIR /app
USER node
COPY --from=build --chown=node:node /app/shared ./shared
COPY --from=build --chown=node:node /app/services/driver-service/node_modules ./services/driver-service/node_modules
COPY --chown=node:node services/driver-service ./services/driver-service
WORKDIR /app/services/driver-service
EXPOSE 3002
HEALTHCHECK --interval=10s --timeout=3s --retries=3 \
  CMD node -e "fetch('http://localhost:3002/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"
CMD ["node", "src/server.js"]
