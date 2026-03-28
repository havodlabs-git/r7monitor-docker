FROM node:20-alpine

WORKDIR /app

# Instala dependências (produção + devDependencies para ts-node/tsx)
COPY package.json ./
RUN npm install

# Copia o código fonte e as migrações
COPY src ./src
COPY drizzle ./drizzle
COPY tsconfig.json ./

ENV NODE_ENV=production

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:3000/api/health || exit 1

CMD ["npx", "tsx", "src/index.ts"]
