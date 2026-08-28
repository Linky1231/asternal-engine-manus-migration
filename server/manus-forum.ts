import { createHash } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { asternalRecords } from "../drizzle/schema";
import { getDb } from "./db";

type Database = NonNullable<Awaited<ReturnType<typeof getDb>>>;
type Data = Record<string, unknown>;

function dataOf(value: unknown): Data {
  return value && typeof value === "object" && !Array.isArray(value) ? { ...(value as Data) } : {};
}

function validId(value: unknown, label: string): string {
  if (typeof value !== "string" || !/^[a-zA-Z0-9_-]{1,64}$/.test(value)) throw new Error(`${label} no es válido.`);
  return value;
}

async function database(): Promise<Database> {
  const db = await getDb();
  if (!db) throw new Error("La base de datos de Manus no está disponible.");
  return db;
}

async function findRecord(db: Database, collection: string, id: string) {
  const rows = await db.select().from(asternalRecords).where(and(eq(asternalRecords.collection, collection), eq(asternalRecords.id, id))).limit(1);
  return rows[0] ?? null;
}

async function updateRecord(db: Database, record: { id: string; ownerOpenId: string; collection: string }, data: Data) {
  await db.update(asternalRecords).set({ data }).where(and(
    eq(asternalRecords.id, record.id),
    eq(asternalRecords.collection, record.collection),
    eq(asternalRecords.ownerOpenId, record.ownerOpenId),
  ));
}

function voteRecordId(kind: "thread" | "post", itemId: string, userOpenId: string) {
  const prefix = kind === "thread" ? "ftv" : "fpv";
  return `${prefix}_${createHash("sha256").update(`${itemId}:${userOpenId}`).digest("hex").slice(0, 60)}`;
}

async function applyVote(userOpenId: string, itemIdValue: unknown, vote: unknown, kind: "thread" | "post") {
  const itemId = validId(itemIdValue, kind === "thread" ? "El hilo" : "La respuesta");
  if (vote !== "up" && vote !== "down") throw new Error("El voto no es válido.");
  const db = await database();
  const collection = kind === "thread" ? "forum_threads" : "forum_posts";
  const votesCollection = kind === "thread" ? "forum_thread_votes" : "forum_votes";
  const key = kind === "thread" ? "thread_id" : "post_id";
  const item = await findRecord(db, collection, itemId);
  if (!item || item.visibility !== "public") throw new Error("El contenido del foro no existe.");
  const id = voteRecordId(kind, itemId, userOpenId);
  const previous = await findRecord(db, votesCollection, id);
  if (previous && dataOf(previous.data).vote === vote) {
    await db.delete(asternalRecords).where(and(eq(asternalRecords.id, id), eq(asternalRecords.collection, votesCollection), eq(asternalRecords.ownerOpenId, userOpenId)));
  } else if (previous) {
    await updateRecord(db, previous, { [key]: itemId, user_id: userOpenId, vote });
  } else {
    await db.insert(asternalRecords).values({
      id,
      collection: votesCollection,
      ownerOpenId: userOpenId,
      visibility: "public",
      data: { [key]: itemId, user_id: userOpenId, vote },
    });
  }
  const rows = await db.select().from(asternalRecords).where(eq(asternalRecords.collection, votesCollection));
  const counts = rows.reduce((acc, row) => {
    const rowData = dataOf(row.data);
    if (rowData[key] !== itemId) return acc;
    if (rowData.vote === "up") acc.upvotes += 1;
    if (rowData.vote === "down") acc.downvotes += 1;
    return acc;
  }, { upvotes: 0, downvotes: 0 });
  const itemData = dataOf(item.data);
  itemData.upvotes = counts.upvotes;
  itemData.downvotes = counts.downvotes;
  await updateRecord(db, item, itemData);
  return counts;
}

export function voteForumThreadForUser(userOpenId: string, threadId: unknown, vote: unknown) {
  return applyVote(userOpenId, threadId, vote, "thread");
}

export function voteForumPostForUser(userOpenId: string, postId: unknown, vote: unknown) {
  return applyVote(userOpenId, postId, vote, "post");
}

export async function incrementForumThreadView(threadIdValue: unknown) {
  const threadId = validId(threadIdValue, "El hilo");
  const db = await database();
  const thread = await findRecord(db, "forum_threads", threadId);
  if (!thread || thread.visibility !== "public") throw new Error("El hilo no existe.");
  const data = dataOf(thread.data);
  data.views = Math.max(0, Number.isSafeInteger(data.views) ? Number(data.views) : 0) + 1;
  await updateRecord(db, thread, data);
  return { views: data.views };
}

export async function touchForumThreadForUser(userOpenId: string, threadIdValue: unknown, change: unknown) {
  const threadId = validId(threadIdValue, "El hilo");
  const delta = change === "remove" ? -1 : 1;
  const db = await database();
  const thread = await findRecord(db, "forum_threads", threadId);
  if (!thread || thread.visibility !== "public") throw new Error("El hilo no existe.");
  const profiles = await db.select().from(asternalRecords).where(and(eq(asternalRecords.collection, "profiles"), eq(asternalRecords.ownerOpenId, userOpenId))).limit(1);
  const profileData = dataOf(profiles[0]?.data);
  const author = typeof profileData.username === "string" && profileData.username ? profileData.username : "Usuario";
  const data = dataOf(thread.data);
  const current = Number.isSafeInteger(data.post_count) ? Number(data.post_count) : 1;
  data.post_count = Math.max(1, current + delta);
  data.last_post_at = new Date().toISOString();
  data.last_post_author = delta > 0 ? author : (typeof data.author_username === "string" ? data.author_username : author);
  await updateRecord(db, thread, data);
  return { post_count: data.post_count, last_post_at: data.last_post_at, last_post_author: data.last_post_author };
}
