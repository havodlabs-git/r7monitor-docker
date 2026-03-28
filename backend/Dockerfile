# ─── Stage 1: Build ───────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Instalar dependências
COPY package.json ./
RUN npm install

# Copiar código fonte
COPY . .

# Compilar com esbuild
RUN npm run build

# ─── Stage 2: Runtime ─────────────────────────────────────────────────────────
FROM node:20-alpine AS runtime

WORKDIR /app

# Apenas dependências de produção
COPY package.json ./
RUN npm install --omit=dev

# Copiar build
COPY --from=builder /app/dist ./dist

# Copiar migrações SQL
COPY drizzle/migrations ./drizzle/migrations

# Utilizador não-root
RUN addgroup -S r7 && adduser -S r7 -G r7
USER r7

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3000/api/health || exit 1

CMD ["node", "dist/index.js"]
