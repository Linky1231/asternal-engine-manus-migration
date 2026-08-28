import type { RecordPayload, RecordVisibility } from "./manus-records";

type CollectionConfig = {
  visibility: RecordVisibility;
  ownerFields: string[];
  idMustEqualOwner?: boolean;
};

const COLLECTION_CONFIG = {
  profiles: { visibility: "public", ownerFields: [], idMustEqualOwner: true },
  posts: { visibility: "public", ownerFields: ["author_id"] },
  comments: { visibility: "public", ownerFields: ["author_id"] },
  reactions: { visibility: "public", ownerFields: ["user_id"] },
  reposts: { visibility: "public", ownerFields: ["user_id"] },
  follows: { visibility: "public", ownerFields: ["follower_id"] },
  notifications: { visibility: "private", ownerFields: ["user_id"] },
  reports: { visibility: "private", ownerFields: ["reporter_id"] },
  blocks: { visibility: "private", ownerFields: ["blocker_id"] },
  tags: { visibility: "public", ownerFields: [] },
  post_tags: { visibility: "public", ownerFields: [] },
  post_polls: { visibility: "public", ownerFields: ["author_id"] },
  post_poll_votes: { visibility: "public", ownerFields: ["user_id"] },
  game_purchases: { visibility: "private", ownerFields: ["user_id"] },
  user_projects: { visibility: "private", ownerFields: ["user_id"] },
  game_plays: { visibility: "public", ownerFields: ["user_id"] },
  orbe_transactions: { visibility: "private", ownerFields: ["user_id"] },
  forum_categories: { visibility: "public", ownerFields: ["created_by"] },
  forum_threads: { visibility: "public", ownerFields: ["author_id"] },
  forum_posts: { visibility: "public", ownerFields: ["author_id"] },
  forum_thread_votes: { visibility: "public", ownerFields: ["user_id"] },
  forum_votes: { visibility: "public", ownerFields: ["user_id"] },
  chats: { visibility: "private", ownerFields: ["created_by"] },
  chat_members: { visibility: "private", ownerFields: ["user_id"] },
  chat_messages: { visibility: "private", ownerFields: ["sender_id"] },
  stickers: { visibility: "public", ownerFields: ["user_id"] },
  events: { visibility: "public", ownerFields: ["host_id"] },
  event_submissions: { visibility: "public", ownerFields: ["user_id"] },
  event_participants: { visibility: "public", ownerFields: ["user_id"] },
  trust_points_history: { visibility: "private", ownerFields: ["user_id"] },
  community_settings: { visibility: "public", ownerFields: ["created_by"] },
} as const satisfies Record<string, CollectionConfig>;

export type ManusCollection = keyof typeof COLLECTION_CONFIG;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function cleanJson(value: unknown, depth = 0): unknown {
  if (depth > 12) throw new Error("El registro es demasiado profundo.");
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (Array.isArray(value)) {
    if (value.length > 500) throw new Error("El registro contiene demasiados elementos.");
    return value.map(item => cleanJson(item, depth + 1));
  }
  if (isPlainObject(value)) {
    const result: Record<string, unknown> = {};
    const entries = Object.entries(value);
    if (entries.length > 240) throw new Error("El registro contiene demasiados campos.");
    for (const [key, item] of entries) {
      if (!/^[a-zA-Z0-9_]{1,80}$/.test(key) || key === "__proto__" || key === "constructor" || key === "prototype") continue;
      result[key] = cleanJson(item, depth + 1);
    }
    return result;
  }
  throw new Error("El registro contiene un valor no permitido.");
}

export function getManusCollection(value: unknown): { name: ManusCollection; config: CollectionConfig } | null {
  if (typeof value !== "string" || !(value in COLLECTION_CONFIG)) return null;
  const name = value as ManusCollection;
  return { name, config: COLLECTION_CONFIG[name] };
}

export function normalizeManusRecordPayload(collection: ManusCollection, id: string, ownerOpenId: string, value: unknown): RecordPayload {
  if (!/^[a-zA-Z0-9_-]{1,64}$/.test(id)) throw new Error("El identificador del registro no es válido.");
  if (!isPlainObject(value)) throw new Error("El registro debe ser un objeto.");
  const config = COLLECTION_CONFIG[collection];
  if (config.idMustEqualOwner && id !== ownerOpenId) throw new Error("El perfil solo se puede guardar con la identidad de Manus activa.");
  const data = cleanJson(value) as RecordPayload;
  delete data.id;
  delete data.ownerOpenId;
  delete data.owner_open_id;
  for (const field of config.ownerFields) {
    const provided = data[field];
    if (provided !== undefined && provided !== ownerOpenId) throw new Error("El registro no puede atribuirse a otra cuenta.");
    data[field] = ownerOpenId;
  }
  const encoded = JSON.stringify(data);
  if (encoded.length > 500_000) throw new Error("El registro supera el tamaño permitido.");
  return data;
}

export function isPublicManusCollection(collection: ManusCollection): boolean {
  return COLLECTION_CONFIG[collection].visibility === "public";
}
