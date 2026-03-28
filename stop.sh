#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════════
# R7 Monitor — Script de paragem (docker run)
# Para e remove os containers. O volume da BD é preservado por defeito.
# Uso:  ./stop.sh          → para containers (dados preservados)
#       ./stop.sh --clean  → para containers E remove volume da BD (APAGA DADOS)
# ═══════════════════════════════════════════════════════════════════════════════
set -euo pipefail

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
info()  { echo -e "${GREEN}[R7]${NC} $*"; }
warn()  { echo -e "${YELLOW}[R7]${NC} $*"; }
error() { echo -e "${RED}[R7]${NC} $*" >&2; }

CONTAINERS=("r7monitor-frontend" "r7monitor-api" "r7monitor-db")
VOLUME_DB="r7monitor_db_data"
NETWORK="r7net"
CLEAN=${1:-""}

info "A parar containers R7 Monitor..."

for CONTAINER in "${CONTAINERS[@]}"; do
  if docker ps -a --format '{{.Names}}' | grep -q "^${CONTAINER}$"; then
    info "  A parar e remover '$CONTAINER'..."
    docker stop "$CONTAINER" &>/dev/null || true
    docker rm   "$CONTAINER" &>/dev/null || true
  else
    warn "  Container '$CONTAINER' não encontrado — ignorado."
  fi
done

if [ "$CLEAN" = "--clean" ]; then
  warn "Modo --clean: a remover volume da base de dados '$VOLUME_DB'..."
  warn "ATENÇÃO: todos os dados serão perdidos!"
  read -r -p "Confirmar remoção do volume? [s/N] " CONFIRM
  if [[ "$CONFIRM" =~ ^[sS]$ ]]; then
    docker volume rm "$VOLUME_DB" &>/dev/null || true
    info "Volume removido."
  else
    info "Remoção cancelada. Volume preservado."
  fi
fi

# Remover rede se não tiver containers ligados
if docker network inspect "$NETWORK" &>/dev/null; then
  CONNECTED=$(docker network inspect "$NETWORK" --format '{{len .Containers}}')
  if [ "$CONNECTED" = "0" ]; then
    docker network rm "$NETWORK" &>/dev/null || true
    info "Rede '$NETWORK' removida."
  fi
fi

info "R7 Monitor parado."
