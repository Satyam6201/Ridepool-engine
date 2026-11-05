FROM node:20-alpine AS builder

WORKDIR /app

COPY shared ./shared
RUN cd shared && npm install --omit=dev

COPY services/realtime/package*.json ./services/realtime/
RUN cd services/realtime && npm install --omit=dev

FROM node:20-alpine

WORKDIR /app

RUN addgroup -S appgroup && adduser -S appuser -G appgroup

COPY --from=builder --chown=appuser:appgroup /app/shared ./shared
COPY --from=builder --chown=appuser:appgroup /app/services/realtime/node_modules ./services/realtime/node_modules
COPY --chown=appuser:appgroup services/realtime ./services/realtime

USER appuser

WORKDIR /app/services/realtime

EXPOSE 3006

HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://localhost:3006/health').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"

CMD ["node", "src/server.js"]

