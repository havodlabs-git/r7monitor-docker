import { initTRPC, TRPCError } from "@trpc/server";
import { Request, Response } from "express";
import superjson from "superjson";
import { extractSessionToken, verifySession, SessionPayload } from "./auth.js";

export interface TrpcContext {
  req: Request;
  res: Response;
  user: SessionPayload | null;
}

export async function createContext({ req, res }: { req: Request; res: Response }): Promise<TrpcContext> {
  const token = extractSessionToken(req.headers.cookie);
  const user = token ? await verifySession(token) : null;
  return { req, res, user };
}

const t = initTRPC.context<TrpcContext>().create({ transformer: superjson });

export const router = t.router;
export const publicProcedure = t.procedure;
export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED", message: "Not authenticated" });
  return next({ ctx: { ...ctx, user: ctx.user } });
});
