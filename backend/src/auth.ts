import { SignJWT, jwtVerify } from "jose";
import { ENV } from "./env.js";

const COOKIE_NAME = "r7monitor_session";
const secret = new TextEncoder().encode(ENV.jwtSecret);

export { COOKIE_NAME };

export interface SessionPayload {
  userId: number;
  openId: string;
  name?: string | null;
  email?: string | null;
  role: "user" | "admin";
}

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

/** Extrai o token do cookie de sessão do header Cookie */
export function extractSessionToken(cookieHeader: string | undefined): string | null {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${COOKIE_NAME}=([^;]+)`));
  return match ? match[1]! : null;
}
