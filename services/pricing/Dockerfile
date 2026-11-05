FROM node:20-alpine AS builder

WORKDIR /app

COPY shared ./shared
RUN cd shared && npm install --omit=dev

COPY services/pricing/package*.json ./services/pricing/
RUN cd services/pricing && npm install --omit=dev

FROM node:20-alpine

WORKDIR /app

RUN addgroup -S appgroup && adduser -S appuser -G appgroup

COPY --from=builder --chown=appuser:appgroup /app/shared ./shared
COPY --from=builder --chown=appuser:appgroup /app/services/pricing/node_modules ./services/pricing/node_modules
COPY --chown=appuser:appgroup services/pricing ./services/pricing

USER appuser

WORKDIR /app/services/pricing

EXPOSE 3005

HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://localhost:3005/health').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"

CMD ["node", "src/server.js"]

