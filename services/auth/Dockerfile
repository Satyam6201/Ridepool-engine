FROM node:20-alpine AS builder

WORKDIR /app

COPY shared ./shared
RUN cd shared && npm install --omit=dev

COPY services/auth/package*.json ./services/auth/
RUN cd services/auth && npm install --omit=dev

FROM node:20-alpine

WORKDIR /app

RUN addgroup -S appgroup && adduser -S appuser -G appgroup

COPY --from=builder --chown=appuser:appgroup /app/shared ./shared
COPY --from=builder --chown=appuser:appgroup /app/services/auth/node_modules ./services/auth/node_modules
COPY --chown=appuser:appgroup services/auth ./services/auth

USER appuser

WORKDIR /app/services/auth

EXPOSE 3001

HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://localhost:3001/health').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"

CMD ["node", "src/server.js"]
