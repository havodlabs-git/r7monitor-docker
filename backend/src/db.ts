import { eq, and } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { users, r7Customers, InsertUser, InsertR7Customer, R7Customer } from "../drizzle/schema.js";
import { ENV } from "./env.js";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && ENV.databaseUrl) {
    try {
      _db = drizzle(ENV.databaseUrl);
    } catch (error) {
      console.warn("[DB] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ─── Users ────────────────────────────────────────────────────────────────────

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("openId required");
  const db = await getDb();
  if (!db) return;

  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};

  const fields = ["name", "email", "loginMethod"] as const;
  for (const f of fields) {
    if (user[f] !== undefined) {
      values[f] = user[f] ?? null;
      updateSet[f] = user[f] ?? null;
    }
  }

  if (user.lastSignedIn) { values.lastSignedIn = user.lastSignedIn; updateSet.lastSignedIn = user.lastSignedIn; }
  if (user.role) { values.role = user.role; updateSet.role = user.role; }
  else if (user.openId === ENV.ownerOpenId) { values.role = "admin"; updateSet.role = "admin"; }

  if (!values.lastSignedIn) values.lastSignedIn = new Date();
  if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();

  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0] ?? undefined;
}

// ─── R7 Customers ─────────────────────────────────────────────────────────────

export async function listR7Customers(userId: number): Promise<R7Customer[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(r7Customers).where(eq(r7Customers.userId, userId));
}

export async function getR7Customer(userId: number, customerId: number): Promise<R7Customer | null> {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(r7Customers)
    .where(and(eq(r7Customers.id, customerId), eq(r7Customers.userId, userId)))
    .limit(1);
  return result[0] ?? null;
}

export async function createR7Customer(
  userId: number,
  data: { name: string; apiKey: string; region: string; incPattern: string }
): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(r7Customers).values({ userId, ...data });
  return (result as unknown as { insertId: number }).insertId;
}

export async function updateR7Customer(
  userId: number,
  customerId: number,
  data: Partial<{ name: string; apiKey: string; region: string; incPattern: string }>
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(r7Customers)
    .set(data)
    .where(and(eq(r7Customers.id, customerId), eq(r7Customers.userId, userId)));
}

export async function deleteR7Customer(userId: number, customerId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(r7Customers)
    .where(and(eq(r7Customers.id, customerId), eq(r7Customers.userId, userId)));
}
