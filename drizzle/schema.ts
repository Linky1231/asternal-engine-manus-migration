import { index, int, json, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
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

/**
 * Registro extensible de la comunidad y del motor. Reemplaza las colecciones
 * de Supabase sin guardar bytes de archivos ni exponer una escritura directa
 * del cliente. Cada fila pertenece a una cuenta Manus.
 */
export const asternalRecords = mysqlTable("asternal_records", {
  id: varchar("id", { length: 64 }).primaryKey(),
  collection: varchar("collection", { length: 64 }).notNull(),
  ownerOpenId: varchar("ownerOpenId", { length: 64 }).notNull(),
  visibility: mysqlEnum("visibility", ["private", "public"]).default("private").notNull(),
  data: json("data").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [
  index("asternal_records_owner_collection_idx").on(table.ownerOpenId, table.collection),
  index("asternal_records_collection_visibility_idx").on(table.collection, table.visibility),
]);

export type AsternalRecord = typeof asternalRecords.$inferSelect;
export type InsertAsternalRecord = typeof asternalRecords.$inferInsert;
