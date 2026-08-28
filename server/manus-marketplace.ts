import { createHash, randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { asternalRecords } from "../drizzle/schema";
import { getDb } from "./db";

type Database = NonNullable<Awaited<ReturnType<typeof getDb>>>;
type MarketplaceKind = "game" | "artwork";
type RecordData = Record<string, unknown>;

function cleanId(value: unknown, label: string): string {
  if (typeof value !== "string" || !/^[a-zA-Z0-9_-]{1,64}$/.test(value)) throw new Error(`${label} no es válido.`);
  return value;
}

function cleanAmount(value: unknown, label = "La cantidad"): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value <= 0 || value > 1_000_000) {
    throw new Error(`${label} debe ser un entero entre 1 y 1000000.`);
  }
  return value;
}

function recordData(value: unknown): RecordData {
  return value && typeof value === "object" && !Array.isArray(value) ? { ...value as RecordData } : {};
}

async function database(): Promise<Database> {
  const db = await getDb();
  if (!db) throw new Error("La base de datos de Manus no está disponible.");
  return db;
}

async function findRecord(db: Database, id: string, collection: string, ownerOpenId?: string) {
  const condition = ownerOpenId
    ? and(eq(asternalRecords.id, id), eq(asternalRecords.collection, collection), eq(asternalRecords.ownerOpenId, ownerOpenId))
    : and(eq(asternalRecords.id, id), eq(asternalRecords.collection, collection));
  const rows = await db.select().from(asternalRecords).where(condition).limit(1);
  return rows[0] ?? null;
}

async function adjustBalance(db: Database, openId: string, delta: number): Promise<number> {
  const profile = await findRecord(db, openId, "profiles", openId);
  if (!profile) throw new Error("No se encontró el perfil de Manus.");
  const data = recordData(profile.data);
  const current = typeof data.orbes === "number" && Number.isSafeInteger(data.orbes) ? Math.max(0, data.orbes) : 0;
  const next = current + delta;
  if (next < 0) throw new Error("No tienes orbes suficientes.");
  data.orbes = next;
  await db.update(asternalRecords).set({ data }).where(and(eq(asternalRecords.id, openId), eq(asternalRecords.collection, "profiles"), eq(asternalRecords.ownerOpenId, openId)));
  return next;
}

function purchaseId(kind: MarketplaceKind, buyerOpenId: string, postId: string): string {
  return `buy_${createHash("sha256").update(`${kind}:${buyerOpenId}:${postId}`).digest("hex").slice(0, 60)}`;
}

async function appendTransaction(db: Database, input: { userOpenId: string; amount: number; kind: "game_purchase" | "adjustment"; postId: string | null; description: string }) {
  await db.insert(asternalRecords).values({
    id: randomUUID(),
    collection: "orbe_transactions",
    ownerOpenId: input.userOpenId,
    visibility: "private",
    data: {
      user_id: input.userOpenId,
      amount: input.amount,
      kind: input.kind,
      post_id: input.postId,
      description: input.description,
    },
  });
}

export async function purchasePostForUser(userOpenId: string, input: { postId: unknown; kind: MarketplaceKind }) {
  const postId = cleanId(input.postId, "El juego");
  const db = await database();
  return db.transaction(async tx => {
    const post = await findRecord(tx, postId, "posts");
    if (!post || post.visibility !== "public") throw new Error("La publicación no existe o no está disponible.");
    const postData = recordData(post.data);
    const expectedCategory = input.kind === "game" ? "game" : "artwork";
    if (postData.category !== expectedCategory) throw new Error("La publicación no coincide con esta compra.");
    const sellerOpenId = input.kind === "artwork" && typeof postData.current_owner_id === "string"
      ? postData.current_owner_id
      : typeof postData.author_id === "string" ? postData.author_id : post.ownerOpenId;
    const resalePrice = input.kind === "artwork" && typeof postData.resale_price_orbes === "number" && Number.isSafeInteger(postData.resale_price_orbes)
      ? Math.max(0, postData.resale_price_orbes)
      : null;
    const basePrice = typeof postData.price_orbes === "number" && Number.isSafeInteger(postData.price_orbes)
      ? Math.max(0, postData.price_orbes)
      : 0;
    const price = resalePrice ?? basePrice;
    if (sellerOpenId === userOpenId || price === 0) return { ok: true, free: true, paid: 0 };

    const id = purchaseId(input.kind, userOpenId, postId);
    const existing = await findRecord(tx, id, "game_purchases", userOpenId);
    if (existing) return { ok: false, already_owned: true };

    const balance = await adjustBalance(tx, userOpenId, -price);
    await adjustBalance(tx, sellerOpenId, price);
    await tx.insert(asternalRecords).values({
      id,
      collection: "game_purchases",
      ownerOpenId: userOpenId,
      visibility: "private",
      data: { user_id: userOpenId, post_id: postId, kind: input.kind, price_orbes: price },
    });
    await appendTransaction(tx, { userOpenId, amount: -price, kind: "game_purchase", postId, description: `Compra de ${input.kind}` });
    await appendTransaction(tx, { userOpenId: sellerOpenId, amount: price, kind: "game_purchase", postId, description: `Venta de ${input.kind}` });
    if (input.kind === "artwork") {
      postData.current_owner_id = userOpenId;
      postData.seller_id = null;
      postData.resale_price_orbes = null;
      await tx.update(asternalRecords).set({ data: postData }).where(and(eq(asternalRecords.id, post.id), eq(asternalRecords.collection, "posts"), eq(asternalRecords.ownerOpenId, post.ownerOpenId)));
    }
    return { ok: true, paid: price, balance };
  });
}

export async function donateOrbsForUser(userOpenId: string, input: { postId: unknown; amount: unknown }) {
  const postId = cleanId(input.postId, "El juego");
  const amount = cleanAmount(input.amount);
  const db = await database();
  return db.transaction(async tx => {
    const post = await findRecord(tx, postId, "posts");
    if (!post || post.visibility !== "public") throw new Error("La publicación no existe o no está disponible.");
    const postData = recordData(post.data);
    if (postData.category !== "game") throw new Error("Solo puedes donar a un juego publicado.");
    const recipientOpenId = typeof postData.author_id === "string" ? postData.author_id : post.ownerOpenId;
    if (recipientOpenId === userOpenId) throw new Error("No puedes donar orbes a tu propio juego.");
    const balance = await adjustBalance(tx, userOpenId, -amount);
    await adjustBalance(tx, recipientOpenId, amount);
    await appendTransaction(tx, { userOpenId, amount: -amount, kind: "adjustment", postId, description: "Donación a juego" });
    await appendTransaction(tx, { userOpenId: recipientOpenId, amount, kind: "adjustment", postId, description: "Donación recibida de un jugador" });
    return { ok: true, balance };
  });
}

export async function claimPlusOrbesForUser(userOpenId: string) {
  const db = await database();
  return db.transaction(async tx => {
    const profile = await findRecord(tx, userOpenId, "profiles", userOpenId);
    if (!profile) throw new Error("No se encontró el perfil de Manus.");
    const data = recordData(profile.data);
    const previous = typeof data.last_plus_claim_at === "string" ? new Date(data.last_plus_claim_at).getTime() : 0;
    const period = 30 * 24 * 60 * 60 * 1000;
    if (Number.isFinite(previous) && previous > 0 && previous + period > Date.now()) {
      return { ok: false, reason: "already_claimed", next_at: new Date(previous + period).toISOString() };
    }
    const current = typeof data.orbes === "number" && Number.isSafeInteger(data.orbes) ? Math.max(0, data.orbes) : 0;
    const amount = 10_000;
    const claimedAt = new Date().toISOString();
    data.orbes = current + amount;
    data.last_plus_claim_at = claimedAt;
    await tx.update(asternalRecords).set({ data }).where(and(eq(asternalRecords.id, userOpenId), eq(asternalRecords.collection, "profiles"), eq(asternalRecords.ownerOpenId, userOpenId)));
    await appendTransaction(tx, { userOpenId, amount, kind: "adjustment", postId: null, description: "Recompensa mensual Plus" });
    return { ok: true, amount, next_at: new Date(Date.now() + period).toISOString() };
  });
}

export async function resellArtworkForUser(userOpenId: string, input: { postId: unknown; price: unknown }) {
  const postId = cleanId(input.postId, "La obra");
  if (typeof input.price !== "number" || !Number.isSafeInteger(input.price) || input.price < 0 || input.price > 1_000_000) {
    throw new Error("El precio debe ser un entero entre 0 y 1000000.");
  }
  const db = await database();
  const post = await findRecord(db, postId, "posts");
  if (!post || post.visibility !== "public") throw new Error("La obra no existe o no está disponible.");
  const data = recordData(post.data);
  if (data.category !== "artwork") throw new Error("La publicación no es una obra de galería.");
  const ownerOpenId = typeof data.current_owner_id === "string"
    ? data.current_owner_id
    : typeof data.author_id === "string" ? data.author_id : post.ownerOpenId;
  if (ownerOpenId !== userOpenId) throw new Error("Solo la persona propietaria puede revender esta obra.");
  data.current_owner_id = userOpenId;
  data.seller_id = input.price > 0 ? userOpenId : null;
  data.resale_price_orbes = input.price > 0 ? input.price : null;
  await db.update(asternalRecords).set({ data }).where(and(eq(asternalRecords.id, post.id), eq(asternalRecords.collection, "posts"), eq(asternalRecords.ownerOpenId, post.ownerOpenId)));
  return { ok: true, on_sale: input.price > 0 };
}
