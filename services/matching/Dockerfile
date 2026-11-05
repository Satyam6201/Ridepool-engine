FROM node:20-alpine AS builder

WORKDIR /app

COPY shared ./shared
RUN cd shared && npm install --omit=dev

COPY services/matching/package*.json ./services/matching/
RUN cd services/matching && npm install --omit=dev

FROM node:20-alpine

WORKDIR /app

RUN addgroup -S appgroup && adduser -S appuser -G appgroup

COPY --from=builder --chown=appuser:appgroup /app/shared ./shared
COPY --from=builder --chown=appuser:appgroup /app/services/matching/node_modules ./services/matching/node_modules
COPY --chown=appuser:appgroup services/matching ./services/matching

USER appuser

WORKDIR /app/services/matching

EXPOSE 3004

HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://localhost:3004/health').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"

CMD ["node", "src/server.js"]

