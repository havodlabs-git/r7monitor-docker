import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, publicProcedure, protectedProcedure } from "./trpc.js";
import {
  COOKIE_NAME,
  signSession,
  hashPassword,
  verifyPassword,
} from "./auth.js";
import {
  getUserByUsername,
  getUserById,
  createUser,
  countUsers,
  listR7Customers,
  getR7Customer,
  createR7Customer,
  updateR7Customer,
  deleteR7Customer,
} from "./db.js";
import * as r7 from "./rapid7Client.js";

// ─── Constantes ───────────────────────────────────────────────────────────────
const VALID_REGIONS = ["us", "eu", "ca", "au", "ap"] as const;

/**
 * Intervalos de tempo válidos em minutos.
 * 15 = 15min | 30 = 30min | 60 = 1h | 360 = 6h | 1440 = 24h | 10080 = 7d
 */
const VALID_MINUTES = [15, 30, 60, 360, 1440, 10080] as const;
const minutesAgoSchema = z.number().refine(
  (v) => (VALID_MINUTES as readonly number[]).includes(v),
  { message: `minutesAgo deve ser um de: ${VALID_MINUTES.join(", ")}` }
);

// ─── Helper: cookie de sessão ─────────────────────────────────────────────────
function setSessionCookie(res: import("express").Response, token: string, isHttps: boolean) {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: isHttps,
    sameSite: isHttps ? "none" : "lax",
    path: "/",
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 dias
  });
}

// ─── Helper: obter customer e validar ownership ───────────────────────────────
async function requireCustomer(userId: number, customerId: number) {
  const c = await getR7Customer(userId, customerId);
  if (!c) throw new TRPCError({ code: "NOT_FOUND", message: "Customer não encontrado" });
  return c;
}

// ─── Auth Router ──────────────────────────────────────────────────────────────
const authRouter = router({
  /** Retorna o utilizador da sessão atual (null se não autenticado) */
  me: publicProcedure.query(({ ctx }) => ctx.user),

  /**
   * Registo de novo utilizador.
   * O primeiro utilizador a registar-se torna-se automaticamente admin.
   */
  register: publicProcedure
    .input(z.object({
      username: z.string().min(3).max(64).regex(/^[a-zA-Z0-9_.-]+$/, "Username inválido"),
      password: z.string().min(8, "Password deve ter pelo menos 8 caracteres"),
      name:     z.string().max(128).optional(),
      email:    z.string().email().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Verificar se o username já existe
      const existing = await getUserByUsername(input.username);
      if (existing) {
        throw new TRPCError({ code: "CONFLICT", message: "Username já está em uso" });
      }

      // O primeiro utilizador é admin
      const total = await countUsers();
      const role = total === 0 ? "admin" : "user";

      const passwordHash = await hashPassword(input.password);
      const userId = await createUser({
        username:     input.username,
        passwordHash,
        name:         input.name ?? null,
        email:        input.email ?? null,
        role,
      });

      const user = await getUserById(userId);
      if (!user) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const token = await signSession({
        userId:   user.id,
        username: user.username,
        name:     user.name,
        email:    user.email,
        role:     user.role,
      });

      const isHttps = ctx.req.protocol === "https" || ctx.req.headers["x-forwarded-proto"] === "https";
      setSessionCookie(ctx.res, token, isHttps);

      return {
        user: { id: user.id, username: user.username, name: user.name, email: user.email, role: user.role },
      };
    }),

  /** Login com username + password */
  login: publicProcedure
    .input(z.object({
      username: z.string().min(1),
      password: z.string().min(1),
    }))
    .mutation(async ({ ctx, input }) => {
      const user = await getUserByUsername(input.username);
      if (!user) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Credenciais inválidas" });
      }

      const valid = await verifyPassword(input.password, user.passwordHash);
      if (!valid) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Credenciais inválidas" });
      }

      const token = await signSession({
        userId:   user.id,
        username: user.username,
        name:     user.name,
        email:    user.email,
        role:     user.role,
      });

      const isHttps = ctx.req.protocol === "https" || ctx.req.headers["x-forwarded-proto"] === "https";
      setSessionCookie(ctx.res, token, isHttps);

      return {
        user: { id: user.id, username: user.username, name: user.name, email: user.email, role: user.role },
      };
    }),

  /** Logout — limpa o cookie de sessão */
  logout: publicProcedure.mutation(({ ctx }) => {
    ctx.res.clearCookie(COOKIE_NAME, {
      httpOnly: true,
      secure: ctx.req.protocol === "https" || ctx.req.headers["x-forwarded-proto"] === "https",
      sameSite: "lax",
      path: "/",
    });
    return { success: true } as const;
  }),
});

// ─── Customers Router ─────────────────────────────────────────────────────────
const customersRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const customers = await listR7Customers(ctx.user.userId);
    return customers.map((c) => ({
      id:            c.id,
      name:          c.name,
      region:        c.region,
      incPattern:    c.incPattern,
      apiKeyPreview: c.apiKey ? `****${c.apiKey.slice(-4)}` : "****",
      createdAt:     c.createdAt,
    }));
  }),

  create: protectedProcedure
    .input(z.object({
      name:       z.string().min(1).max(128),
      apiKey:     z.string().min(10),
      region:     z.enum(VALID_REGIONS),
      incPattern: z.string().min(1).max(32).default("INC"),
    }))
    .mutation(async ({ ctx, input }) => {
      // Validar a API Key antes de guardar
      try {
        await r7.getInvestigations(input.apiKey, input.region, { size: 1 });
      } catch {
        throw new TRPCError({ code: "BAD_REQUEST", message: "API Key inválida ou sem permissões para a região selecionada" });
      }
      const id = await createR7Customer(ctx.user.userId, input);
      return { id };
    }),

  update: protectedProcedure
    .input(z.object({
      id:         z.number(),
      name:       z.string().min(1).max(128).optional(),
      apiKey:     z.string().min(10).optional(),
      region:     z.enum(VALID_REGIONS).optional(),
      incPattern: z.string().min(1).max(32).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await requireCustomer(ctx.user.userId, input.id);
      const { id, ...data } = input;
      await updateR7Customer(ctx.user.userId, id, data);
      return { success: true };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await requireCustomer(ctx.user.userId, input.id);
      await deleteR7Customer(ctx.user.userId, input.id);
      return { success: true };
    }),

  testConnection: protectedProcedure
    .input(z.object({ customerId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const c = await requireCustomer(ctx.user.userId, input.customerId);
      try {
        await r7.getInvestigations(c.apiKey, c.region, { size: 1 });
        return { success: true, message: "Conexão estabelecida com sucesso" };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Erro desconhecido";
        return { success: false, message: msg };
      }
    }),
});

// ─── Workflows Router ─────────────────────────────────────────────────────────
const workflowsRouter = router({
  failedJobs: protectedProcedure
    .input(z.object({
      customerId: z.number(),
      minutesAgo: minutesAgoSchema,
    }))
    .query(async ({ ctx, input }) => {
      const c = await requireCustomer(ctx.user.userId, input.customerId);
      const since = new Date(Date.now() - input.minutesAgo * 60_000).toISOString();
      const jobsData = await r7.getFailedJobs(c.apiKey, c.region, since);
      const jobs = jobsData?.data ?? [];
      return {
        jobs,
        total: jobs.length,
        since,
        minutesAgo: input.minutesAgo,
      };
    }),

  stats: protectedProcedure
    .input(z.object({
      customerId: z.number(),
      minutesAgo: minutesAgoSchema,
    }))
    .query(async ({ ctx, input }) => {
      const c = await requireCustomer(ctx.user.userId, input.customerId);
      const since = new Date(Date.now() - input.minutesAgo * 60_000).toISOString();
      const jobsData = await r7.getFailedJobs(c.apiKey, c.region, since);
      const jobs = jobsData?.data ?? [];

      // Agrupar por workflow
      const byWorkflow: Record<string, { name: string; count: number; lastFailed: string }> = {};
      for (const job of jobs) {
        const wfId   = job.workflow_id   ?? "unknown";
        const wfName = job.workflow_name ?? wfId;
        if (!byWorkflow[wfId]) {
          byWorkflow[wfId] = { name: wfName, count: 0, lastFailed: job.start_time ?? "" };
        }
        byWorkflow[wfId]!.count++;
        if ((job.start_time ?? "") > byWorkflow[wfId]!.lastFailed) {
          byWorkflow[wfId]!.lastFailed = job.start_time ?? "";
        }
      }

      const topWorkflows = Object.entries(byWorkflow)
        .map(([id, v]) => ({ id, ...v }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      return {
        total: jobs.length,
        uniqueWorkflows: Object.keys(byWorkflow).length,
        topWorkflows,
        since,
      };
    }),
});

// ─── Investigations Router ────────────────────────────────────────────────────
const investigationsRouter = router({
  withoutInc: protectedProcedure
    .input(z.object({
      customerId: z.number(),
      minutesAgo: minutesAgoSchema,
      priorities: z.array(z.string()).optional(),
    }))
    .query(async ({ ctx, input }) => {
      const c = await requireCustomer(ctx.user.userId, input.customerId);
      const since = new Date(Date.now() - input.minutesAgo * 60_000).toISOString();
      const invData = await r7.getInvestigations(c.apiKey, c.region, {
        statuses:   "OPEN,INVESTIGATING",
        size:       100,
        start_time: since,
      });
      let investigations = invData?.data ?? [];

      if (input.priorities?.length) {
        investigations = investigations.filter((inv) =>
          input.priorities!.includes(inv.priority?.toUpperCase() ?? "")
        );
      }

      // Verificar comentários para cada investigation
      const results = await Promise.allSettled(
        investigations.map(async (inv) => {
          try {
            const commentsData = await r7.getInvestigationComments(c.apiKey, c.region, inv.id);
            const comments = commentsData?.data ?? [];
            const allText = comments.map((cm) => cm.body ?? cm.content ?? cm.text ?? "").join(" ");
            const { found, ref } = r7.hasIncReference(allText, c.incPattern);
            return { inv, hasInc: found, incRef: ref ?? null, commentCount: comments.length };
          } catch {
            return { inv, hasInc: false, incRef: null, commentCount: 0 };
          }
        })
      );

      const withoutInc = results
        .filter((r) => r.status === "fulfilled" && !r.value.hasInc)
        .map((r) => {
          const { inv, incRef, commentCount } = (r as PromiseFulfilledResult<{
            inv: r7.Investigation;
            hasInc: boolean;
            incRef: string | null;
            commentCount: number;
          }>).value;
          return {
            id:          inv.id,
            title:       inv.title,
            status:      inv.status,
            priority:    inv.priority,
            createdTime: inv.created_time,
            assignee:    inv.assignee?.name ?? null,
            commentCount,
            incRef,
          };
        });

      return {
        investigations: withoutInc,
        total:          withoutInc.length,
        totalChecked:   investigations.length,
        since,
      };
    }),

  stats: protectedProcedure
    .input(z.object({
      customerId: z.number(),
      minutesAgo: minutesAgoSchema,
    }))
    .query(async ({ ctx, input }) => {
      const c = await requireCustomer(ctx.user.userId, input.customerId);
      const since = new Date(Date.now() - input.minutesAgo * 60_000).toISOString();
      const invData = await r7.getInvestigations(c.apiKey, c.region, {
        statuses:   "OPEN,INVESTIGATING",
        size:       100,
        start_time: since,
      });
      const investigations = invData?.data ?? [];

      const byPriority: Record<string, { total: number; withInc: number; withoutInc: number }> = {};
      for (const inv of investigations) {
        const p = inv.priority?.toUpperCase() ?? "UNKNOWN";
        if (!byPriority[p]) byPriority[p] = { total: 0, withInc: 0, withoutInc: 0 };
        byPriority[p]!.total++;
      }

      // Verificar INC em paralelo
      const checks = await Promise.allSettled(
        investigations.map(async (inv) => {
          try {
            const commentsData = await r7.getInvestigationComments(c.apiKey, c.region, inv.id);
            const allText = (commentsData?.data ?? []).map((cm) => cm.body ?? cm.content ?? cm.text ?? "").join(" ");
            return { priority: inv.priority?.toUpperCase() ?? "UNKNOWN", hasInc: r7.hasIncReference(allText, c.incPattern).found };
          } catch {
            return { priority: inv.priority?.toUpperCase() ?? "UNKNOWN", hasInc: false };
          }
        })
      );

      for (const check of checks) {
        if (check.status !== "fulfilled") continue;
        const { priority, hasInc } = check.value;
        if (!byPriority[priority]) byPriority[priority] = { total: 0, withInc: 0, withoutInc: 0 };
        if (hasInc) byPriority[priority]!.withInc++;
        else        byPriority[priority]!.withoutInc++;
      }

      const totalWithoutInc = Object.values(byPriority).reduce((s, v) => s + v.withoutInc, 0);
      return {
        total: investigations.length,
        totalWithoutInc,
        byPriority,
        since,
      };
    }),
});

// ─── Log Sources Router ───────────────────────────────────────────────────────
function analyzeLog(log: r7.LogSource, staleMinutes: number) {
  const userData    = log.user_data ?? {};
  const eps         = Number(userData["eps"] ?? userData["events_per_second"] ?? userData["eventsPerSecond"] ?? -1);
  const status      = (userData["status"] ?? "").toLowerCase();
  const lastReceived = userData["last_received"] ?? userData["lastReceived"] ?? userData["last_event_time"] ?? null;
  const hasTokens   = (log.tokens?.length ?? 0) > 0;
  const hasLogsets  = (log.logsets_info?.length ?? 0) > 0;

  const errorStatuses = ["error", "failed", "disconnected", "inactive", "disabled", "stopped"];
  if (errorStatuses.some((s) => status.includes(s))) {
    return { hasIssue: true, issueType: "STATUS_ERROR", issueReason: `Status: ${userData["status"] ?? "error"}` };
  }
  if (eps === 0) {
    return { hasIssue: true, issueType: "NO_EPS", issueReason: "EPS = 0 (sem eventos por segundo)" };
  }
  if (!hasTokens && !hasLogsets) {
    return { hasIssue: true, issueType: "STALE", issueReason: "Log source sem tokens e sem logsets associados" };
  }
  if (lastReceived) {
    const minutesSince = (Date.now() - new Date(lastReceived).getTime()) / 60_000;
    if (minutesSince > staleMinutes) {
      const h = Math.round(minutesSince / 60);
      return { hasIssue: true, issueType: "STALE", issueReason: `Sem eventos há ${h}h (limiar: ${Math.round(staleMinutes / 60)}h)` };
    }
  }
  return { hasIssue: false, issueType: null, issueReason: null };
}

const logSourcesRouter = router({
  issues: protectedProcedure
    .input(z.object({
      customerId: z.number(),
      minutesAgo: minutesAgoSchema,
    }))
    .query(async ({ ctx, input }) => {
      const c = await requireCustomer(ctx.user.userId, input.customerId);
      const logsData = await r7.getLogs(c.apiKey, c.region);
      const logs = logsData?.logs ?? [];
      const issues = logs
        .map((log) => {
          const analysis = analyzeLog(log, input.minutesAgo);
          if (!analysis.hasIssue) return null;
          return {
            id:          log.id,
            name:        log.name,
            sourceType:  log.source_type ?? "Unknown",
            logsets:     (log.logsets_info ?? []).map((ls) => ls.name).join(", ") || "—",
            tokensCount: log.tokens?.length ?? 0,
            issueType:   analysis.issueType,
            issueReason: analysis.issueReason,
          };
        })
        .filter(Boolean);

      return {
        issues,
        total:     issues.length,
        totalLogs: logs.length,
        breakdown: {
          noEps:       issues.filter((i) => i?.issueType === "NO_EPS").length,
          stale:       issues.filter((i) => i?.issueType === "STALE").length,
          statusError: issues.filter((i) => i?.issueType === "STATUS_ERROR").length,
        },
      };
    }),

  stats: protectedProcedure
    .input(z.object({
      customerId: z.number(),
      minutesAgo: minutesAgoSchema,
    }))
    .query(async ({ ctx, input }) => {
      const c = await requireCustomer(ctx.user.userId, input.customerId);
      const logsData = await r7.getLogs(c.apiKey, c.region);
      const logs = logsData?.logs ?? [];
      let healthy = 0, noEps = 0, stale = 0, statusError = 0;
      for (const log of logs) {
        const a = analyzeLog(log, input.minutesAgo);
        if (!a.hasIssue)              healthy++;
        else if (a.issueType === "NO_EPS")       noEps++;
        else if (a.issueType === "STALE")        stale++;
        else                          statusError++;
      }
      return {
        total: logs.length, healthy, noEps, stale, statusError,
        issueRate: logs.length > 0 ? Math.round(((noEps + stale + statusError) / logs.length) * 100) : 0,
      };
    }),
});

// ─── App Router ───────────────────────────────────────────────────────────────
export const appRouter = router({
  auth:           authRouter,
  customers:      customersRouter,
  workflows:      workflowsRouter,
  investigations: investigationsRouter,
  logSources:     logSourcesRouter,
});

export type AppRouter = typeof appRouter;
