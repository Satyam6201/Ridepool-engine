FROM node:20-alpine AS build
WORKDIR /app
COPY shared ./shared
RUN cd shared && npm install --omit=dev
COPY services/auth-service/package*.json ./services/auth-service/
RUN cd services/auth-service && npm install --omit=dev

FROM node:20-alpine
WORKDIR /app
USER node
COPY --from=build --chown=node:node /app/shared ./shared
COPY --from=build --chown=node:node /app/services/auth-service/node_modules ./services/auth-service/node_modules
COPY --chown=node:node services/auth-service ./services/auth-service
WORKDIR /app/services/auth-service
EXPOSE 3001
HEALTHCHECK --interval=10s --timeout=3s --retries=3 \
  CMD node -e "fetch('http://localhost:3001/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"
CMD ["node", "src/server.js"]
