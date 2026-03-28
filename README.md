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
r7monitor-docker/
├── backend/                  # API Node.js 20 / Express / tRPC / Drizzle ORM
│   ├── src/
│   │   ├── index.ts          # Servidor Express com waitForDb (padrão IOCS)
│   │   ├── routers.ts        # Routers tRPC (customers, workflows, investigations, logSources)
│   │   ├── rapid7Client.ts   # Cliente Rapid7 com cache em memória (TTL 2min)
│   │   ├── db.ts             # Helpers PostgreSQL (Drizzle ORM + pg Pool)
│   │   ├── auth.ts           # Autenticação JWT
│   │   ├── trpc.ts           # Configuração tRPC + contexto
│   │   └── env.ts            # Variáveis de ambiente validadas
│   ├── drizzle/
│   │   ├── schema.ts         # Schema PostgreSQL (pgTable, pgEnum, serial)
│   │   └── migrations/
│   │       └── 0000_init.sql # Migração inicial (aplicada automaticamente pelo PostgreSQL)
│   ├── Dockerfile            # Node.js 20 Alpine + tsx runtime (sem build step)
│   ├── package.json
│   └── .env.example
│
├── frontend/                 # React 19 / Vite 7 / Tailwind 4 / shadcn/ui
│   ├── src/
│   │   ├── pages/            # Dashboard, Workflows, Investigations, LogSources, Customers, Settings
│   │   ├── components/r7/    # MetricCard, StatusBadge, TimeRangeSelector, PageHeader
│   │   ├── components/ui/    # shadcn/ui components
│   │   ├── contexts/         # CustomerContext (customer ativo)
│   │   └── lib/trpc.ts       # Cliente tRPC
│   ├── error_pages/
│   │   ├── 404.html          # Página de erro 404
│   │   └── 50x.html          # Página de erro 5xx
│   ├── nginx.conf            # Template Nginx: HTTPS + envsubst + security headers + proxy /api
│   ├── Dockerfile            # Build Vite multi-stage + Nginx Alpine com envsubst
│   ├── package.json
│   └── .env.example
│
├── docker-compose.yml        # Orquestra: db (PostgreSQL 16) + api (backend) + frontend (Nginx HTTPS)
├── .env.example              # Variáveis de ambiente da raiz (DB_PASSWORD, CERTS_PATH)
└── README.md
```

---

## Pré-requisitos

- [Docker](https://docs.docker.com/get-docker/) 24+
- [Docker Compose](https://docs.docker.com/compose/) v2+
- Certificados SSL (`fullchain.pem` + `privkey.pem`) — ver secção [SSL](#ssl)

---

## Deploy

### 1. Clonar o repositório

```bash
git clone https://github.com/havodlabs-git/r7monitor-docker.git
cd r7monitor-docker
```

### 2. Configurar variáveis de ambiente

```bash
# Raiz (DB_PASSWORD e CERTS_PATH)
cp .env.example .env

# Backend (DATABASE_URL, JWT_SECRET, CORS_ORIGINS, etc.)
cp backend/.env.example backend/.env
```

Editar os dois ficheiros `.env` com os valores correctos.

### 3. Certificados SSL {#ssl}

Colocar os certificados na pasta definida em `CERTS_PATH` (padrão: `./certs`):

```bash
mkdir -p ./certs
cp /etc/letsencrypt/live/r7monitor.example.com/fullchain.pem ./certs/
cp /etc/letsencrypt/live/r7monitor.example.com/privkey.pem   ./certs/
```

> **Desenvolvimento local** — certificado auto-assinado:
> ```bash
> openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
>   -keyout ./certs/privkey.pem -out ./certs/fullchain.pem \
>   -subj "/CN=localhost"
> ```

### 4. Iniciar os serviços

```bash
docker compose up -d --build
```

O sistema ficará disponível em **https://localhost** (porta 443).

---

## Configuração Inicial

Após o primeiro deploy:

1. Aceder a **https://localhost** no browser
2. Navegar para **Customers** na sidebar
3. Clicar em **Adicionar Customer**
4. Preencher:
   - **Nome**: nome do cliente/ambiente (ex: "Produção", "Cliente ABC")
   - **API Key**: chave da Rapid7 Insight Platform
   - **Região**: US, EU, CA, AU ou AP
   - **Padrão INC**: prefixo dos tickets (ex: `INC`, `RITM`, `CHG`)
5. Selecionar o customer no dropdown da sidebar para ver os dados

---

## Variáveis de Ambiente

### Raiz (`.env`)

| Variável | Padrão | Descrição |
|----------|--------|-----------|
| `DB_PASSWORD` | `changeme` | Password do PostgreSQL |
| `CERTS_PATH` | `./certs` | Caminho para os certificados SSL no host |

### Backend (`backend/.env`)

| Variável | Obrigatória | Descrição |
|----------|-------------|-----------|
| `DATABASE_URL` | Sim | `postgresql://r7monitor:<password>@db:5432/r7monitor` |
| `JWT_SECRET` | Sim | Segredo JWT (mínimo 32 chars) — gerar com `openssl rand -hex 32` |
| `PORT` | Não (3000) | Porta do servidor backend |
| `CORS_ORIGINS` | Não | Origens CORS permitidas (separadas por vírgula) |
| `OAUTH_SERVER_URL` | Não | URL do servidor Manus OAuth (deixar vazio para desativar) |
| `OWNER_OPEN_ID` | Não | OpenID do proprietário (para role admin automático) |

---

## Serviços

| Serviço | Porta | Descrição |
|---------|-------|-----------|
| `frontend` | 443 | Nginx HTTPS — serve o React e faz proxy `/api/*` → backend |
| `api` | 3000 | Backend Node.js/Express/tRPC |
| `db` | 5432 | PostgreSQL 16 |

---

## APIs Rapid7 Utilizadas

| Produto | Endpoint | Módulo |
|---------|----------|--------|
| InsightConnect | `GET /connect/v1/jobs?status=failed` | Workflows |
| InsightConnect | `GET /connect/v2/workflows/{id}` | Workflows |
| InsightIDR v2 | `GET /idr/v2/investigations` | Investigations |
| InsightIDR v2 | `GET /idr/v2/investigations/{id}/comments` | Investigations |
| Log Search | `GET /management/logs` | Log Sources |

Regiões suportadas: `us`, `eu`, `ca`, `au`, `ap`.

---

## Comandos Úteis

```bash
# Ver logs em tempo real
docker compose logs -f

# Ver logs de um serviço específico
docker compose logs -f api
docker compose logs -f frontend

# Reiniciar um serviço
docker compose restart api

# Parar todos os serviços
docker compose down

# Parar e remover volumes (APAGA OS DADOS)
docker compose down -v

# Reconstruir e reiniciar
docker compose up -d --build
```

---

## Licença

MIT
