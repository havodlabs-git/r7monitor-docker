import { int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

// ─── Users ────────────────────────────────────────────────────────────────────
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ─── R7 Customers ─────────────────────────────────────────────────────────────
/**
 * Cada customer representa um tenant Rapid7 com a sua própria API Key.
 * Suporta múltiplos customers por utilizador.
 */
export const r7Customers = mysqlTable("r7_customers", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  name: varchar("name", { length: 128 }).notNull(),
  apiKey: text("apiKey").notNull(),
  region: varchar("region", { length: 8 }).notNull().default("us"),
  incPattern: varchar("incPattern", { length: 32 }).notNull().default("INC"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type R7Customer = typeof r7Customers.$inferSelect;
export type InsertR7Customer = typeof r7Customers.$inferInsert;
