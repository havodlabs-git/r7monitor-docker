#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════════
# R7 Monitor — Script de arranque (docker run)
# Sobe: db (PostgreSQL 16) → api (backend) → frontend (Nginx HTTPS)
# Uso:  ./start.sh [--build]
# ═══════════════════════════════════════════════════════════════════════════════
set -euo pipefail

# ─── Cores ────────────────────────────────────────────────────────────────────
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
info()    { echo -e "${GREEN}[R7]${NC} $*"; }
warn()    { echo -e "${YELLOW}[R7]${NC} $*"; }
error()   { echo -e "${RED}[R7]${NC} $*" >&2; }

# ─── Carregar .env ────────────────────────────────────────────────────────────
if [ -f ".env" ]; then
  # shellcheck disable=SC2046
  export $(grep -v '^#' .env | grep -v '^$' | xargs)
fi
if [ -f "backend/.env" ]; then
  # shellcheck disable=SC2046
  export $(grep -v '^#' backend/.env | grep -v '^$' | xargs)
fi

# ─── Configuração ─────────────────────────────────────────────────────────────
NETWORK="r7net"
VOLUME_DB="r7monitor_db_data"

DB_CONTAINER="r7monitor-db"
API_CONTAINER="r7monitor-api"
FRONTEND_CONTAINER="r7monitor-frontend"

DB_USER="${POSTGRES_USER:-r7monitor}"
DB_PASSWORD="${DB_PASSWORD:-changeme}"
DB_NAME="${POSTGRES_DB:-r7monitor}"
DB_PORT="${DB_PORT:-5432}"

API_PORT="${PORT:-3000}"
FRONTEND_PORT="${FRONTEND_PORT:-443}"
CERTS_PATH="${CERTS_PATH:-./certs}"

BUILD=${1:-""}

# ─── Verificar Docker ─────────────────────────────────────────────────────────
if ! command -v docker &>/dev/null; then
  error "Docker não encontrado. Instale o Docker antes de continuar."
  exit 1
fi

# ─── Build (opcional) ─────────────────────────────────────────────────────────
if [ "$BUILD" = "--build" ]; then
  info "A construir imagens..."
  docker build -t r7monitor-api:latest ./backend
  docker build -t r7monitor-frontend:latest ./frontend
  info "Imagens construídas com sucesso."
fi

# ─── Rede ─────────────────────────────────────────────────────────────────────
if ! docker network inspect "$NETWORK" &>/dev/null; then
  info "A criar rede Docker '$NETWORK'..."
  docker network create "$NETWORK"
fi

# ─── Volume da BD ─────────────────────────────────────────────────────────────
if ! docker volume inspect "$VOLUME_DB" &>/dev/null; then
  info "A criar volume '$VOLUME_DB' para persistência da base de dados..."
  docker volume create "$VOLUME_DB"
fi

# ─── Parar containers existentes ──────────────────────────────────────────────
for CONTAINER in "$DB_CONTAINER" "$API_CONTAINER" "$FRONTEND_CONTAINER"; do
  if docker ps -a --format '{{.Names}}' | grep -q "^${CONTAINER}$"; then
    warn "Container '$CONTAINER' já existe — a parar e remover..."
    docker stop "$CONTAINER" &>/dev/null || true
    docker rm   "$CONTAINER" &>/dev/null || true
  fi
done

# ─── 1. Base de dados (PostgreSQL 16) ─────────────────────────────────────────
info "A iniciar container da base de dados ($DB_CONTAINER)..."
docker run -d \
  --name "$DB_CONTAINER" \
  --network "$NETWORK" \
  --restart unless-stopped \
  -e POSTGRES_USER="$DB_USER" \
  -e POSTGRES_PASSWORD="$DB_PASSWORD" \
  -e POSTGRES_DB="$DB_NAME" \
  -v "${VOLUME_DB}:/var/lib/postgresql/data" \
  -v "$(pwd)/backend/drizzle/migrations/0000_init.sql:/docker-entrypoint-initdb.d/0000_init.sql:ro" \
  -p "${DB_PORT}:5432" \
  postgres:16-alpine

# Aguardar a BD estar pronta
info "A aguardar que a base de dados esteja pronta..."
RETRIES=30
until docker exec "$DB_CONTAINER" pg_isready -U "$DB_USER" -d "$DB_NAME" &>/dev/null; do
  RETRIES=$((RETRIES - 1))
  if [ "$RETRIES" -eq 0 ]; then
    error "Timeout a aguardar pela base de dados. Verifique os logs: docker logs $DB_CONTAINER"
    exit 1
  fi
  sleep 2
done
info "Base de dados pronta."

# ─── 2. Backend (API Node.js/tRPC) ────────────────────────────────────────────
info "A iniciar container do backend ($API_CONTAINER)..."
docker run -d \
  --name "$API_CONTAINER" \
  --network "$NETWORK" \
  --restart unless-stopped \
  -e NODE_ENV=production \
  -e PORT="$API_PORT" \
  -e DATABASE_URL="postgresql://${DB_USER}:${DB_PASSWORD}@${DB_CONTAINER}:5432/${DB_NAME}" \
  -e JWT_SECRET="${JWT_SECRET:-change-this-to-a-random-64-char-secret}" \
  -e CORS_ORIGINS="${CORS_ORIGINS:-https://localhost}" \
  r7monitor-api:latest

# Aguardar o backend estar pronto
info "A aguardar que o backend esteja pronto..."
RETRIES=20
until docker exec "$API_CONTAINER" wget -qO- "http://localhost:${API_PORT}/api/health" &>/dev/null; do
  RETRIES=$((RETRIES - 1))
  if [ "$RETRIES" -eq 0 ]; then
    error "Timeout a aguardar pelo backend. Verifique os logs: docker logs $API_CONTAINER"
    exit 1
  fi
  sleep 3
done
info "Backend pronto."

# ─── 3. Frontend (React + Nginx HTTPS) ────────────────────────────────────────
info "A iniciar container do frontend ($FRONTEND_CONTAINER)..."

# Verificar certificados SSL
if [ ! -f "${CERTS_PATH}/fullchain.pem" ] || [ ! -f "${CERTS_PATH}/privkey.pem" ]; then
  warn "Certificados SSL não encontrados em '${CERTS_PATH}'."
  warn "Para desenvolvimento local, gere um certificado auto-assinado:"
  warn "  mkdir -p ${CERTS_PATH}"
  warn "  openssl req -x509 -nodes -days 365 -newkey rsa:2048 \\"
  warn "    -keyout ${CERTS_PATH}/privkey.pem -out ${CERTS_PATH}/fullchain.pem \\"
  warn "    -subj '/CN=localhost'"
fi

docker run -d \
  --name "$FRONTEND_CONTAINER" \
  --network "$NETWORK" \
  --restart unless-stopped \
  -e BACKEND_HOST="$API_CONTAINER" \
  -e BACKEND_PORT="$API_PORT" \
  -v "$(realpath "${CERTS_PATH}"):/etc/nginx/certs:ro" \
  -p "${FRONTEND_PORT}:443" \
  r7monitor-frontend:latest

# ─── Resumo ───────────────────────────────────────────────────────────────────
echo ""
info "════════════════════════════════════════════"
info " R7 Monitor iniciado com sucesso!"
info "════════════════════════════════════════════"
info " Frontend  → https://localhost:${FRONTEND_PORT}"
info " Backend   → http://localhost:${API_PORT}/api/health"
info " Base de dados → localhost:${DB_PORT} (PostgreSQL)"
echo ""
info "Comandos úteis:"
info "  Ver logs do backend:   docker logs -f $API_CONTAINER"
info "  Ver logs do frontend:  docker logs -f $FRONTEND_CONTAINER"
info "  Ver logs da BD:        docker logs -f $DB_CONTAINER"
info "  Parar tudo:            ./stop.sh"
info "════════════════════════════════════════════"
