import {
  pgTable,
  pgEnum,
  serial,
  integer,
  varchar,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

// ─── Enums ────────────────────────────────────────────────────────────────────
export const roleEnum = pgEnum("role", ["user", "admin"]);

// ─── Tabela users ─────────────────────────────────────────────────────────────
export const users = pgTable("users", {
  id:           serial("id").primaryKey(),
  username:     varchar("username", { length: 64 }).notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name:         text("name"),
  email:        varchar("email", { length: 320 }),
  role:         roleEnum("role").notNull().default("user"),
  createdAt:    timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt:    timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export type User       = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ─── Tabela r7_customers ──────────────────────────────────────────────────────
export const r7Customers = pgTable("r7_customers", {
  id:         serial("id").primaryKey(),
  userId:     integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name:       varchar("name", { length: 128 }).notNull(),
  apiKey:     text("api_key").notNull(),
  region:     varchar("region", { length: 8 }).notNull().default("us"),
  incPattern: varchar("inc_pattern", { length: 32 }).notNull().default("INC"),
  createdAt:  timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt:  timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export type R7Customer       = typeof r7Customers.$inferSelect;
export type InsertR7Customer = typeof r7Customers.$inferInsert;
