# ─── Stage 1: Build ───────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Instalar dependências
COPY package.json ./
RUN npm install

# Copiar código fonte do frontend
COPY . .

# Copiar tipos do backend (necessários para o tRPC type-safety)
# O backend deve estar em ../backend relativamente ao frontend
COPY --from=backend-types /backend/src/routers.ts /backend-types/src/routers.ts
COPY --from=backend-types /backend/src/rapid7Client.ts /backend-types/src/rapid7Client.ts

# Build Vite
RUN npm run build

# ─── Stage 2: Runtime Nginx ───────────────────────────────────────────────────
FROM nginx:alpine AS runtime

# Copiar build do Vite
COPY --from=builder /app/dist /usr/share/nginx/html

# Copiar configuração do Nginx
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -qO- http://localhost:80 || exit 1

CMD ["nginx", "-g", "daemon off;"]
