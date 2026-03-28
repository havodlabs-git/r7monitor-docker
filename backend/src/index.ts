import "dotenv/config";
import express from "express";
import cors from "cors";
import * as trpcExpress from "@trpc/server/adapters/express";
import { appRouter } from "./routers.js";
import { createContext } from "./trpc.js";
import { ENV } from "./env.js";
import { waitForDb } from "./db.js";

const app = express();

// ─── CORS ─────────────────────────────────────────────────────────────────────
app.use(cors({
  origin: ENV.corsOrigins,
  credentials: true,
}));

app.use(express.json({ limit: "1mb" }));

// ─── Health check ─────────────────────────────────────────────────────────────
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ─── tRPC ─────────────────────────────────────────────────────────────────────
app.use(
  "/api/trpc",
  trpcExpress.createExpressMiddleware({
    router: appRouter,
    createContext,
  })
);

// ─── Start ────────────────────────────────────────────────────────────────────
async function main() {
  // Aguarda a BD ficar disponível antes de arrancar — padrão IOCS
  await waitForDb({ maxAttempts: 60, delayMs: 1000 });

  app.listen(ENV.port, "0.0.0.0", () => {
    console.log(`[R7 Monitor] Backend a correr em http://0.0.0.0:${ENV.port}`);
    console.log(`[R7 Monitor] CORS origins: ${ENV.corsOrigins.join(", ")}`);
    console.log(`[R7 Monitor] Ambiente: ${ENV.nodeEnv}`);
  });
}

main().catch((err) => {
  console.error("[FATAL] Falha ao iniciar:", err);
  process.exit(1);
});
