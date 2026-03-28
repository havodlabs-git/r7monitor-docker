-- R7 Monitor — Migração inicial (PostgreSQL)
-- Executada automaticamente pelo docker-entrypoint-initdb.d na primeira inicialização

-- ─── Enum de roles ────────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE role AS ENUM ('user', 'admin');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── Tabela users ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id            SERIAL       PRIMARY KEY,
  username      VARCHAR(64)  NOT NULL UNIQUE,
  password_hash TEXT         NOT NULL,
  name          TEXT,
  email         VARCHAR(320),
  role          role         NOT NULL DEFAULT 'user',
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ─── Tabela r7_customers ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS r7_customers (
  id          SERIAL       PRIMARY KEY,
  user_id     INTEGER      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name        VARCHAR(128) NOT NULL,
  api_key     TEXT         NOT NULL,
  region      VARCHAR(8)   NOT NULL DEFAULT 'us',
  inc_pattern VARCHAR(32)  NOT NULL DEFAULT 'INC',
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ─── Índices ──────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_r7_customers_user_id ON r7_customers(user_id);
