import { index, int, json, mysqlEnum, mysqlTable, primaryKey, text, timestamp, varchar } from "drizzle-orm/mysql-core";

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

/** Conversaciones compartidas; el acceso a sus mensajes se verifica con la membresía Manus. */
export const asternalChats = mysqlTable("asternal_chats", {
  id: varchar("id", { length: 64 }).primaryKey(),
  type: mysqlEnum("type", ["community", "dm", "group"]).notNull(),
  name: varchar("name", { length: 160 }).notNull(),
  description: text("description"),
  avatarUrl: text("avatarUrl"),
  ownerOpenId: varchar("ownerOpenId", { length: 64 }).notNull(),
  directKey: varchar("directKey", { length: 160 }).unique(),
  lastMessageAt: timestamp("lastMessageAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [
  index("asternal_chats_type_updated_idx").on(table.type, table.updatedAt),
  index("asternal_chats_owner_idx").on(table.ownerOpenId),
]);

export const asternalChatMembers = mysqlTable("asternal_chat_members", {
  chatId: varchar("chatId", { length: 64 }).notNull(),
  userOpenId: varchar("userOpenId", { length: 64 }).notNull(),
  role: mysqlEnum("role", ["owner", "member", "admin", "moderator"]).default("member").notNull(),
  joinedAt: timestamp("joinedAt").defaultNow().notNull(),
  lastReadAt: timestamp("lastReadAt"),
}, table => [
  primaryKey({ columns: [table.chatId, table.userOpenId] }),
  index("asternal_chat_members_user_idx").on(table.userOpenId),
]);

export const asternalChatMessages = mysqlTable("asternal_chat_messages", {
  id: varchar("id", { length: 64 }).primaryKey(),
  chatId: varchar("chatId", { length: 64 }).notNull(),
  senderOpenId: varchar("senderOpenId", { length: 64 }).notNull(),
  content: text("content"),
  mediaUrl: text("mediaUrl"),
  mediaType: varchar("mediaType", { length: 24 }),
  replyToId: varchar("replyToId", { length: 64 }),
  kind: varchar("kind", { length: 32 }),
  pollId: varchar("pollId", { length: 64 }),
  giftId: varchar("giftId", { length: 64 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [
  index("asternal_chat_messages_chat_created_idx").on(table.chatId, table.createdAt),
  index("asternal_chat_messages_sender_idx").on(table.senderOpenId),
]);

export const asternalChatPolls = mysqlTable("asternal_chat_polls", {
  id: varchar("id", { length: 64 }).primaryKey(),
  chatId: varchar("chatId", { length: 64 }).notNull(),
  createdByOpenId: varchar("createdByOpenId", { length: 64 }).notNull(),
  question: varchar("question", { length: 300 }).notNull(),
  options: json("options").notNull(),
  multiple: mysqlEnum("multiple", ["false", "true"]).default("false").notNull(),
  status: mysqlEnum("status", ["open", "closed"]).default("open").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  closedAt: timestamp("closedAt"),
}, table => [index("asternal_chat_polls_chat_idx").on(table.chatId)]);

export const asternalChatPollVotes = mysqlTable("asternal_chat_poll_votes", {
  pollId: varchar("pollId", { length: 64 }).notNull(),
  userOpenId: varchar("userOpenId", { length: 64 }).notNull(),
  optionIndex: int("optionIndex").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [
  primaryKey({ columns: [table.pollId, table.userOpenId, table.optionIndex] }),
  index("asternal_chat_poll_votes_poll_idx").on(table.pollId),
]);

export const asternalOrbGifts = mysqlTable("asternal_orb_gifts", {
  id: varchar("id", { length: 64 }).primaryKey(),
  chatId: varchar("chatId", { length: 64 }).notNull(),
  createdByOpenId: varchar("createdByOpenId", { length: 64 }).notNull(),
  title: varchar("title", { length: 160 }).notNull(),
  amountPerPerson: int("amountPerPerson").notNull(),
  maxClaims: int("maxClaims").notNull(),
  claims: int("claims").default(0).notNull(),
  status: mysqlEnum("status", ["open", "closed", "expired"]).default("open").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  closedAt: timestamp("closedAt"),
  expiresAt: timestamp("expiresAt"),
}, table => [index("asternal_orb_gifts_chat_status_idx").on(table.chatId, table.status)]);

export const asternalOrbGiftClaims = mysqlTable("asternal_orb_gift_claims", {
  giftId: varchar("giftId", { length: 64 }).notNull(),
  userOpenId: varchar("userOpenId", { length: 64 }).notNull(),
  claimedAt: timestamp("claimedAt").defaultNow().notNull(),
}, table => [primaryKey({ columns: [table.giftId, table.userOpenId] })]);
