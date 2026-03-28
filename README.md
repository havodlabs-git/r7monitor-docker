# R7 Monitor

Sistema de monitorização centralizada para o **Rapid7 InsightIDR / InsightConnect**, focado em três áreas críticas de operações de segurança.

---

## Módulos

| Módulo | Descrição |
|--------|-----------|
| **Workflows** | Jobs falhados do InsightConnect agrupados por workflow, com detalhes de erro e filtros de tempo |
| **Investigations** | Investigations abertas sem referência a INC/ticket do ServiceNow nos comentários |
| **Log Sources** | Log sources sem EPS (eventos por segundo = 0), inativas (>24h) ou com erros de status |

---

## Estrutura do Repositório

```
r7monitor/
├── backend/                  # API Node.js / Express / tRPC
│   ├── src/
│   │   ├── index.ts          # Ponto de entrada do servidor
│   │   ├── routers.ts        # Routers tRPC (customers, workflows, investigations, logSources)
│   │   ├── rapid7Client.ts   # Cliente Rapid7 com cache em memória (TTL 2min)
│   │   ├── db.ts             # Helpers da base de dados (Drizzle ORM)
│   │   ├── auth.ts           # Autenticação JWT
│   │   ├── trpc.ts           # Configuração tRPC + contexto
│   │   └── env.ts            # Variáveis de ambiente validadas
│   ├── drizzle/
│   │   ├── schema.ts         # Schema da base de dados
│   │   └── migrations/       # Migrações SQL
│   ├── Dockerfile            # Build multi-stage Node.js 20 Alpine
│   ├── package.json
│   └── .env.example
│
├── frontend/                 # React 19 / Vite / Tailwind 4 / shadcn/ui
│   ├── src/
│   │   ├── pages/            # Páginas: Dashboard, Workflows, Investigations, LogSources, Customers, Settings
│   │   ├── components/r7/    # Componentes reutilizáveis: MetricCard, StatusBadge, TimeRangeSelector
│   │   ├── components/ui/    # shadcn/ui components
│   │   ├── contexts/         # CustomerContext (customer ativo)
│   │   └── lib/trpc.ts       # Cliente tRPC
│   ├── nginx.conf            # Nginx com proxy /api → backend + SPA fallback
│   ├── Dockerfile            # Build standalone (sem acesso aos tipos do backend)
│   ├── Dockerfile.compose    # Build via docker-compose (com acesso aos tipos do backend)
│   ├── package.json
│   └── .env.example
│
├── docker-compose.yml        # Orquestração: frontend + backend + MySQL
├── .env.example              # Template de variáveis de ambiente
└── README.md
```

---

## Pré-requisitos

- [Docker](https://docs.docker.com/get-docker/) 24+
- [Docker Compose](https://docs.docker.com/compose/) v2+

---

## Deploy Rápido

```bash
# 1. Clonar o repositório
git clone https://github.com/havodlabs-git/r7monitor.git
cd r7monitor

# 2. Configurar variáveis de ambiente
cp .env.example .env
# Editar .env com as passwords e o JWT_SECRET

# 3. Subir todos os serviços
docker compose up -d --build

# 4. Verificar que os serviços estão a correr
docker compose ps
docker compose logs -f
```

O frontend estará disponível em **http://localhost:80** (ou na porta configurada em `FRONTEND_PORT`).

---

## Configuração Inicial

Após o primeiro deploy:

1. Aceder a **http://localhost** no browser
2. Navegar para **Customers** na sidebar
3. Clicar em **Adicionar Customer**
4. Preencher:
   - **Nome**: nome do cliente/ambiente (ex: "Produção", "Cliente ABC")
   - **API Key**: chave da Rapid7 Insight Platform
   - **Região**: US, EU, CA, AU ou AP
   - **Padrão INC**: prefixo dos tickets (ex: `INC`, `RITM`, `CHG`)
5. Selecionar o customer no dropdown da sidebar para ver os dados

---

## APIs Rapid7 Utilizadas

| Produto | Endpoint | Descrição |
|---------|----------|-----------|
| InsightConnect | `GET /connect/v1/jobs` | Jobs de workflows (filtrado por `status=failed`) |
| InsightConnect | `GET /connect/v2/workflows/{id}` | Detalhes de um workflow |
| InsightIDR v2 | `GET /idr/v2/investigations` | Lista de investigations abertas |
| InsightIDR v2 | `GET /idr/v2/investigations/{id}/comments` | Comentários de uma investigation |
| Log Search | `GET /management/logs` | Log sources e métricas de EPS |

---

## Desenvolvimento Local

### Backend

```bash
cd backend
cp .env.example .env
# Editar .env com DATABASE_URL e JWT_SECRET
npm install
npm run dev
```

O backend fica disponível em **http://localhost:3000**.

### Frontend

```bash
cd frontend
cp .env.example .env
# VITE_API_URL=http://localhost:3000 (já configurado por padrão)
npm install
npm run dev
```

O frontend fica disponível em **http://localhost:5173** com proxy automático para o backend.

---

## Variáveis de Ambiente

### Raiz (docker-compose)

| Variável | Obrigatória | Descrição |
|----------|-------------|-----------|
| `MYSQL_ROOT_PASSWORD` | Sim | Password root do MySQL |
| `MYSQL_PASSWORD` | Sim | Password do utilizador da BD |
| `JWT_SECRET` | Sim | Segredo JWT (mínimo 32 chars) |
| `MYSQL_DATABASE` | Não | Nome da BD (padrão: `r7monitor`) |
| `MYSQL_USER` | Não | Utilizador da BD (padrão: `r7monitor`) |
| `FRONTEND_PORT` | Não | Porta do frontend (padrão: `80`) |
| `BACKEND_PORT` | Não | Porta do backend (padrão: `3000`) |

### Backend (`backend/.env`)

| Variável | Descrição |
|----------|-----------|
| `DATABASE_URL` | `mysql://user:pass@host:3306/db` |
| `JWT_SECRET` | Segredo para assinar tokens de sessão |
| `PORT` | Porta do servidor (padrão: `3000`) |
| `CORS_ORIGINS` | Origens permitidas (separadas por vírgula) |

---

## Comandos Úteis

```bash
# Ver logs em tempo real
docker compose logs -f backend
docker compose logs -f frontend

# Reiniciar um serviço
docker compose restart backend

# Parar tudo
docker compose down

# Parar e remover volumes (APAGA OS DADOS)
docker compose down -v

# Entrar no container do backend
docker compose exec backend sh

# Verificar saúde dos serviços
docker compose ps
```

---

## Cache

O backend implementa cache em memória com **TTL de 2 minutos** para todas as chamadas às APIs do Rapid7, evitando rate limiting. O cache pode ser limpo manualmente na página de **Definições** de cada customer.

---

## Intervalos de Tempo

Todos os módulos suportam filtros de tempo configuráveis: **15min, 30min, 1h, 6h, 24h, 7d**.

---

## Licença

MIT
