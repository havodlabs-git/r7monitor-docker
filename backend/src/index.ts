import "dotenv/config";
import express from "express";
import cors from "cors";
import * as trpcExpress from "@trpc/server/adapters/express";
import { appRouter } from "./routers.js";
import { createContext } from "./trpc.js";
import { ENV } from "./env.js";

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
app.listen(ENV.port, "0.0.0.0", () => {
  console.log(`[R7 Monitor Backend] Running on http://0.0.0.0:${ENV.port}`);
  console.log(`[R7 Monitor Backend] CORS origins: ${ENV.corsOrigins.join(", ")}`);
  console.log(`[R7 Monitor Backend] Environment: ${ENV.nodeEnv}`);
});
