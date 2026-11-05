FROM node:20-alpine AS builder

WORKDIR /app

COPY shared ./shared
RUN cd shared && npm install --omit=dev

COPY services/driver/package*.json ./services/driver/
RUN cd services/driver && npm install --omit=dev

FROM node:20-alpine

WORKDIR /app

RUN addgroup -S appgroup && adduser -S appuser -G appgroup

COPY --from=builder --chown=appuser:appgroup /app/shared ./shared
COPY --from=builder --chown=appuser:appgroup /app/services/driver/node_modules ./services/driver/node_modules
COPY --chown=appuser:appgroup services/driver ./services/driver

USER appuser

WORKDIR /app/services/driver

EXPOSE 3002

HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://localhost:3002/health').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"

CMD ["node", "src/server.js"]

