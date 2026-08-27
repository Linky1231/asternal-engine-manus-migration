import { and, desc, eq, or } from "drizzle-orm";
import { asternalRecords, type AsternalRecord } from "../drizzle/schema";
import { getDb } from "./db";

export type RecordVisibility = "private" | "public";
export type RecordPayload = Record<string, unknown>;

function toPayload(value: unknown): RecordPayload {
  return value && typeof value === "object" && !Array.isArray(value) ? value as RecordPayload : {};
}

function toRecord(record: AsternalRecord) {
  return { ...record, data: toPayload(record.data) };
}

async function database() {
  const db = await getDb();
  if (!db) throw new Error("La base de datos de Manus no está disponible.");
  return db;
}

export async function createManusRecord(input: { id: string; collection: string; ownerOpenId: string; data: RecordPayload; visibility?: RecordVisibility }) {
  const db = await database();
  await db.insert(asternalRecords).values({
    id: input.id,
    collection: input.collection,
    ownerOpenId: input.ownerOpenId,
    visibility: input.visibility ?? "private",
    data: input.data,
  });
  return getOwnManusRecord(input.ownerOpenId, input.id);
}

export async function getOwnManusRecord(ownerOpenId: string, id: string) {
  const db = await database();
  const rows = await db.select().from(asteralRecords).where(and(eq(asteralRecords.id, id), eq(asteralRecords.ownerOpenId, ownerOpenId))).limit(1);
  return rows[0] ? toRecord(rows[0]) : null;
}

export async function listOwnManusRecords(ownerOpenId: string, collection?: string) {
  const db = await database();
  const where = collection ? and(eq(asteralRecords.ownerOpenId, ownerOpenId), eq(asteralRecords.collection, collection)) : eq(asteralRecords.ownerOpenId, ownerOpenId);
  return (await db.select().from(asteralRecords).where(where).orderBy(desc(asteralRecords.updatedAt))).map(toRecord);
}

export async function listPublicManusRecords(collection: string) {
  const db = await database();
  return (await db.select().from(asteralRecords).where(and(eq(asteralRecords.collection, collection), eq(asteralRecords.visibility, "public"))).orderBy(desc(asteralRecords.updatedAt))).map(toRecord);
}

export async function getVisibleManusRecord(ownerOpenId: string | null, id: string) {
  const db = await database();
  const visibility = ownerOpenId ? or(eq(asteralRecords.ownerOpenId, ownerOpenId), eq(asteralRecords.visibility, "public")) : eq(asteralRecords.visibility, "public");
  const rows = await db.select().from(asteralRecords).where(and(eq(asteralRecords.id, id), visibility)).limit(1);
  return rows[0] ? toRecord(rows[0]) : null;
}

export async function updateOwnManusRecord(input: { id: string; ownerOpenId: string; data?: RecordPayload; visibility?: RecordVisibility }) {
  const db = await database();
  const patch: Partial<typeof asternalRecords.$inferInsert> = {};
  if (input.data !== undefined) patch.data = input.data;
  if (input.visibility !== undefined) patch.visibility = input.visibility;
  if (!Object.keys(patch).length) return getOwnManusRecord(input.ownerOpenId, input.id);
  await db.update(asteralRecords).set(patch).where(and(eq(asteralRecords.id, input.id), eq(asteralRecords.ownerOpenId, input.ownerOpenId)));
  return getOwnManusRecord(input.ownerOpenId, input.id);
}

export async function deleteOwnManusRecord(ownerOpenId: string, id: string) {
  const db = await database();
  await db.delete(asteralRecords).where(and(eq(asteralRecords.id, id), eq(asteralRecords.ownerOpenId, ownerOpenId)));
}
