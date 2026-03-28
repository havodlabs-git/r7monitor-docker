import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { ENV } from "./env.js";

export const COOKIE_NAME = "r7monitor_session";
const SALT_ROUNDS = 12;
const secret = new TextEncoder().encode(ENV.jwtSecret);

// ─── Tipos ────────────────────────────────────────────────────────────────────
export interface SessionPayload {
  userId:   number;
  username: string;
  name?:    string | null;
  email?:   string | null;
  role:     "user" | "admin";
}

// ─── JWT ──────────────────────────────────────────────────────────────────────
export async function signSession(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(secret);
}

export async function verifySession(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret);
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

/** Extrai o token JWT do cookie de sessão */
export function extractSessionToken(cookieHeader: string | undefined): string | null {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${COOKIE_NAME}=([^;]+)`));
  return match ? match[1]! : null;
}

// ─── Bcrypt ───────────────────────────────────────────────────────────────────
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
