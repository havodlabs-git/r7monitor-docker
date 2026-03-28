import { pgEnum, pgTable, serial, text, varchar, timestamp } from "drizzle-orm/pg-core";

// ─── Enums ────────────────────────────────────────────────────────────────────
export const roleEnum = pgEnum("role", ["user", "admin"]);

// ─── Users ────────────────────────────────────────────────────────────────────
export const users = pgTable("users", {
  id:          serial("id").primaryKey(),
  openId:      varchar("open_id", { length: 64 }).notNull().unique(),
  name:        text("name"),
  email:       varchar("email", { length: 320 }),
  loginMethod: varchar("login_method", { length: 64 }),
  role:        roleEnum("role").default("user").notNull(),
  createdAt:   timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt:   timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  lastSignedIn: timestamp("last_signed_in", { withTimezone: true }).defaultNow().notNull(),
});

export type User       = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ─── R7 Customers ─────────────────────────────────────────────────────────────
/**
 * Cada customer representa um tenant Rapid7 com a sua própria API Key.
 * Suporta múltiplos customers por utilizador.
 */
export const r7Customers = pgTable("r7_customers", {
  id:         serial("id").primaryKey(),
  userId:     serial("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name:       varchar("name", { length: 128 }).notNull(),
  apiKey:     text("api_key").notNull(),
  region:     varchar("region", { length: 8 }).notNull().default("us"),
  incPattern: varchar("inc_pattern", { length: 32 }).notNull().default("INC"),
  createdAt:  timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt:  timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export type R7Customer       = typeof r7Customers.$inferSelect;
export type InsertR7Customer = typeof r7Customers.$inferInsert;
