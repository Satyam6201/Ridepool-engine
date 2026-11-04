FROM node:20-alpine AS build
WORKDIR /app
COPY shared ./shared
RUN cd shared && npm install --omit=dev
COPY services/pricing-service/package*.json ./services/pricing-service/
RUN cd services/pricing-service && npm install --omit=dev

FROM node:20-alpine
WORKDIR /app
USER node
COPY --from=build --chown=node:node /app/shared ./shared
COPY --from=build --chown=node:node /app/services/pricing-service/node_modules ./services/pricing-service/node_modules
COPY --chown=node:node services/pricing-service ./services/pricing-service
WORKDIR /app/services/pricing-service
EXPOSE 3005
HEALTHCHECK --interval=10s --timeout=3s --retries=3 \
  CMD node -e "fetch('http://localhost:3005/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"
CMD ["node", "src/server.js"]
