import { eq, and } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { users, r7Customers, InsertUser, R7Customer } from "../drizzle/schema.js";
import { ENV } from "./env.js";

// ─── Pool PostgreSQL ──────────────────────────────────────────────────────────
let _pool: Pool | null = null;
let _db: ReturnType<typeof drizzle> | null = null;

function getPool(): Pool {
  if (!_pool) {
    _pool = new Pool({ connectionString: ENV.databaseUrl });
  }
  return _pool;
}

export async function getDb() {
  if (!_db) {
    _db = drizzle(getPool());
  }
  return _db;
}

/**
 * Aguarda a base de dados ficar disponível — padrão IOCS.
 */
export async function waitForDb({ maxAttempts = 60, delayMs = 1000 } = {}): Promise<void> {
  let lastErr: unknown = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const client = await getPool().connect();
      try {
        await client.query("SELECT 1");
        console.log(`[DB] PostgreSQL disponível (tentativa ${attempt})`);
        return;
      } finally {
        client.release();
      }
    } catch (err) {
      lastErr = err;
      console.log(`[DB] Aguardando PostgreSQL... (tentativa ${attempt}/${maxAttempts})`);
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  throw lastErr ?? new Error("DB_NOT_READY");
}

export type User = typeof users.$inferSelect;

// ─── Users ────────────────────────────────────────────────────────────────────
export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("openId required");
  const db = await getDb();

  const existing = await db.select().from(users).where(eq(users.openId, user.openId)).limit(1);

  if (existing.length > 0) {
    const updateSet: Partial<InsertUser> = { lastSignedIn: new Date(), updatedAt: new Date() };
    if (user.name        !== undefined) updateSet.name        = user.name;
    if (user.email       !== undefined) updateSet.email       = user.email;
    if (user.loginMethod !== undefined) updateSet.loginMethod = user.loginMethod;
    await db.update(users).set(updateSet).where(eq(users.openId, user.openId));
  } else {
    await db.insert(users).values({
      openId:      user.openId,
      name:        user.name        ?? null,
      email:       user.email       ?? null,
      loginMethod: user.loginMethod ?? null,
      role:        user.openId === ENV.ownerOpenId ? "admin" : (user.role ?? "user"),
      lastSignedIn: new Date(),
    });
  }
}

export async function getUserByOpenId(openId: string): Promise<User | undefined> {
  const db = await getDb();
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

// ─── R7 Customers ─────────────────────────────────────────────────────────────
export async function listR7Customers(userId: number): Promise<R7Customer[]> {
  const db = await getDb();
  return db.select().from(r7Customers).where(eq(r7Customers.userId, userId));
}

export async function getR7Customer(userId: number, customerId: number): Promise<R7Customer | null> {
  const db = await getDb();
  const result = await db
    .select()
    .from(r7Customers)
    .where(and(eq(r7Customers.id, customerId), eq(r7Customers.userId, userId)))
    .limit(1);
  return result[0] ?? null;
}

export async function createR7Customer(
  userId: number,
  data: { name: string; apiKey: string; region: string; incPattern: string }
): Promise<number> {
  const db = await getDb();
  const result = await db
    .insert(r7Customers)
    .values({ userId, ...data })
    .returning({ id: r7Customers.id });
  return result[0]!.id;
}

export async function updateR7Customer(
  userId: number,
  customerId: number,
  data: Partial<{ name: string; apiKey: string; region: string; incPattern: string }>
): Promise<void> {
  const db = await getDb();
  await db
    .update(r7Customers)
    .set({ ...data, updatedAt: new Date() })
    .where(and(eq(r7Customers.id, customerId), eq(r7Customers.userId, userId)));
}

export async function deleteR7Customer(userId: number, customerId: number): Promise<void> {
  const db = await getDb();
  await db
    .delete(r7Customers)
    .where(and(eq(r7Customers.id, customerId), eq(r7Customers.userId, userId)));
}
