// @ts-nocheck — Adaptador de chat compatible con los contratos históricos de la interfaz.
import { signMediaUrls, uploadMedia } from "@/lib/social/api";
import type { Profile } from "@/lib/social/api";

export type ChatMessage = {
  id: string;
  chat_id: string;
  sender_id: string;
  content: string | null;
  media_url: string | null;
  media_type: string | null;
  reply_to_id: string | null;
  kind?: string | null;
  gift_id?: string | null;
  poll_id?: string | null;
  created_at: string;
};

// Chat único de la comunidad: un ID fijo evita duplicados en carreras de creación.
export const COMMUNITY_CHAT_ID = "c0000000-0000-4000-8000-000000000000";
export const COMMUNITY_CHAT_NAME = "Asternal · Comunidad";

export const CHAT_ERR = {
  AUTH_REQUIRED: "AUTH_REQUIRED",
  REAL_AUTH_REQUIRED: "REAL_AUTH_REQUIRED",
} as const;

function chatError(code: string, message: string): Error {
  return Object.assign(new Error(message), { code });
}

async function manusChatRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const body = await response.json().catch(() => ({})) as T & { error?: string };
  if (!response.ok) throw new Error(body.error || "No se pudo completar la operación de chat en Manus.");
  return body;
}

/**
 * Identidad actual del usuario. Distingue si viene de una sesión real de
 * Manus activa. La marca `isLocal` se conserva temporalmente para mantener el
 * contrato de la interfaz, pero las operaciones compartidas usan Manus.
 */
async function getMeId(): Promise<{ id: string; isLocal: boolean } | null> {
  try {
    const response = await fetch("/api/manus/session", { credentials: "include" });
    const body = await response.json().catch(() => null) as { user?: { id?: unknown } } | null;
    if (response.ok && typeof body?.user?.id === "string") return { id: body.user.id, isLocal: false };
  } catch {
    /* La interfaz comunica el acceso requerido al llamar requireMe. */
  }
  return null;
}

/**
 * Igual que getMeId pero lanza un error con código cuando no hay NINGUNA
 * identidad (ni real ni local) para que la UI muestre la acción correcta.
 * La interfaz puede usar este código para mostrar la acción de acceso oficial.
 */
async function requireMe(): Promise<{ id: string; isLocal: boolean }> {
  const me = await getMeId();
  if (!me) throw chatError(CHAT_ERR.AUTH_REQUIRED, "Inicia sesión para usar el chat");
  return me;
}

/**
 * Compatibilidad temporal para ramas históricas del componente de chat.
 */
async function isLocalIdentity(): Promise<boolean> {
  const me = await getMeId();
  return !!me?.isLocal;
}

// ───── Adaptador local (localStorage) ─────
// Caché transitoria para la cola local de red; no almacena conversaciones compartidas.

function localRows<T = Record<string, unknown>>(table: string): T[] {
  try {
    const raw = localStorage.getItem(`_local_data_${table}`);
    return raw ? (JSON.parse(raw) as T[]) : [];
  } catch {
    return [];
  }
}

function localSave(table: string, rows: unknown[]): void {
  try {
    localStorage.setItem(`_local_data_${table}`, JSON.stringify(rows));
  } catch {
    /* sin espacio (modo local): se ignora */
  }
}

function localStorePath(path: string): string | null {
  try {
    return localStorage.getItem(`_local_storage_post-media_${path}`);
  } catch {
    return null;
  }
}

async function localUploadMedia(file: File, userId: string): Promise<string> {
  const ext = file.name.split(".").pop() || "bin";
  const path = `${userId}/${crypto.randomUUID()}.${ext}`;
  const url = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("No se pudo leer el archivo"));
    reader.readAsDataURL(file);
  });
  try {
    localStorage.setItem(`_local_storage_post-media_${path}`, url);
  } catch {
    throw new Error("Sin espacio de almacenamiento local");
  }
  return path;
}

/**
 * Devuelve el chat compartido de la comunidad. Si no existe (primer usuario),
 * lo crea con el ID fijo; en cualquier caso añade al usuario actual como miembro
 * (auto-join) y devuelve el número de miembros.
 */
export async function getCommunityChat(): Promise<{ id: string; name: string; memberCount: number; memberOk: boolean; local: boolean }> {
  await requireMe();
  const response = await fetch("/api/manus/chats/community", { credentials: "include" });
  const payload = await response.json().catch(() => ({})) as { error?: string } & { id?: string; name?: string; memberCount?: number; memberOk?: boolean; local?: boolean };
  if (!response.ok || !payload.id || !payload.name) throw new Error(payload.error || "No se pudo preparar el chat de la comunidad.");
  return { id: payload.id, name: payload.name, memberCount: payload.memberCount ?? 0, memberOk: payload.memberOk !== false, local: false };
}

/** Cursor de paginación: el mensaje más antiguo de la página actual. */
export type MessageCursor = { created_at: string; id: string };

/**
 * Paginación por cursor: devuelve la página de mensajes MÁS RECIENTES (o los
 * anteriores a `before`) ordenados de antiguo a nuevo, listos para renderizar.
 * `hasMore` indica si existen mensajes más antiguos que cargar.
 */
export async function fetchChatMessages(
  chatId: string,
  opts: { before?: MessageCursor; limit?: number } = {}
): Promise<{ messages: ChatMessage[]; hasMore: boolean }> {
  const limit = opts.limit ?? 60;
  const params = new URLSearchParams({ limit: String(limit) });
  if (opts.before?.created_at) params.set("before", opts.before.created_at);
  const response = await fetch(`/api/manus/chats/${encodeURIComponent(chatId)}/messages?${params.toString()}`, { credentials: "include" });
  const payload = await response.json().catch(() => ({})) as { error?: string; messages?: ChatMessage[]; hasMore?: boolean };
  if (!response.ok) throw new Error(payload.error || "No se pudieron leer los mensajes.");
  return { messages: payload.messages ?? [], hasMore: payload.hasMore === true };
}

export async function sendChatMessage(
  chatId: string,
  opts: { content?: string; mediaUrl?: string; mediaType?: "image" | "video" | "audio" | "sticker"; replyToId?: string | null }
): Promise<ChatMessage> {
  await requireMe();
  const response = await fetch(`/api/manus/chats/${encodeURIComponent(chatId)}/messages`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      content: opts.content ?? null,
      mediaUrl: opts.mediaUrl ?? null,
      mediaType: opts.mediaType ?? (opts.mediaUrl ? "image" : null),
      replyToId: opts.replyToId ?? null,
    }),
  });
  const payload = await response.json().catch(() => ({})) as ChatMessage & { error?: string };
  if (!response.ok || !payload.id) throw new Error(payload.error || "No se pudo enviar el mensaje.");
  return payload;
}

export function isAudioMessage(m: Pick<ChatMessage, "media_type" | "media_url">): boolean {
  return !!m.media_url && (m.media_type === "audio" || /^audio\//.test(m.media_url ?? ""));
}

/** ¿Es un vídeo? (se renderiza con un reproductor). */
export function isVideoMessage(m: Pick<ChatMessage, "media_type" | "media_url">): boolean {
  return !!m.media_url && (m.media_type === "video" || /^video\//.test(m.media_url ?? ""));
}

/** ¿Es una imagen normal (foto, no sticker)? */
export function isImageMessage(m: Pick<ChatMessage, "media_type" | "media_url">): boolean {
  return !!m.media_url && m.media_type === "image";
}

export type ChatEvent =
  | { type: "INSERT"; message: ChatMessage }
  | { type: "UPDATE"; message: ChatMessage }
  | { type: "DELETE"; message: ChatMessage };

/** Actualiza mensajes nuevos mediante las rutas autenticadas de Manus. */
export function subscribeToChat(chatId: string, onEvent: (ev: ChatEvent) => void): () => void {
  const seen = new Set<string>();
  let cancelled = false;
  const refresh = async () => {
    try {
      const { messages } = await fetchChatMessages(chatId, { limit: 100 });
      for (const message of messages) {
        if (!seen.has(message.id)) onEvent({ type: "INSERT", message });
      }
      seen.clear();
      messages.forEach(message => seen.add(message.id));
    } catch {
      /* El siguiente ciclo intentará recuperar la conexión. */
    }
  };
  void refresh();
  const interval = window.setInterval(() => { if (!cancelled) void refresh(); }, 6_000);
  return () => {
    cancelled = true;
    window.clearInterval(interval);
  };
}

// ───── Chats individuales (DMs) ─────
// Entre dos personas que se siguen mutuamente. Reutilizan las tablas del chat
// (chats con type='dm', chat_members y chat_messages). Sin paquetes de regalo.

export type DmChat = {
  chat_id: string;
  other: Profile | null;
  last_message: ChatMessage | null;
  last_at: string | null;
  unread: number;
};

/** Crea (o devuelve) el chat individual con otro usuario. Exige seguimiento mutuo. */
export async function getOrCreateDm(otherId: string): Promise<{ ok: boolean; chatId?: string; error?: string }> {
  try {
    const result = await manusChatRequest<{ ok: boolean; chatId?: string }>("/api/manus/chats/dm", {
      method: "POST",
      body: JSON.stringify({ otherId }),
    });
    return result;
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "No se pudo abrir el chat directo." };
  }
}

/** Lista mis chats individuales con el perfil del otro usuario y no leídos. */
export async function fetchMyDmChats(): Promise<DmChat[]> {
  return manusChatRequest<DmChat[]>("/api/manus/chats/dm");
}

/** Perfiles con los que me sigo mutuamente (posibles chats individuales). */
export async function fetchMutualFollows(): Promise<Profile[]> {
  return manusChatRequest<Profile[]>("/api/manus/chats/mutual-follows");
}

/** Marca como leído un chat individual (actualiza last_read_at del participante). */
export async function markDmRead(chatId: string): Promise<void> {
  try {
    await manusChatRequest(`/api/manus/chats/${encodeURIComponent(chatId)}/read`, { method: "POST" });
  } catch {
    /* best effort */
  }
}

/**
 * Última lectura del usuario en un chat, sincronizada por cuenta
 * (lastReadAt en Manus). El respaldo visual local solo se usa si no hay red.
 */
export async function fetchChatReadAt(chatId: string): Promise<number | null> {
  try {
    const result = await manusChatRequest<{ lastReadAt: string | null }>(`/api/manus/chats/${encodeURIComponent(chatId)}/read`);
    return result.lastReadAt ? new Date(result.lastReadAt).getTime() : null;
  } catch {
    return null;
  }
}

// ───── Grupos personalizados ─────
// Chats grupales que cualquier usuario crea con amigos (seguimiento mutuo).
// Tienen nombre, descripción y foto de perfil. El creador es el owner y puede
// editar el grupo y gestionar miembros.

export type GroupChat = {
  chat_id: string;
  name: string;
  description: string | null;
  avatar_url: string | null;
  created_by: string | null;
  my_role: "owner" | "member" | "admin" | "moderator" | null;
  member_count: number;
  last_message: ChatMessage | null;
  last_at: string | null;
  unread: number;
};

export type GroupMember = {
  profile: Profile;
  role: "owner" | "member" | "admin" | "moderator";
  joined_at: string;
};

/** Crea un grupo personalizado con amigos (solo seguimiento mutuo). */
export async function createGroupChat(
  opts: { name: string; description?: string; avatarUrl?: string | null; memberIds: string[] }
): Promise<{ ok: boolean; chatId?: string; error?: string }> {
  try {
    return await manusChatRequest<{ ok: boolean; chatId?: string }>("/api/manus/chats/groups", {
      method: "POST",
      body: JSON.stringify(opts),
    });
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "No se pudo crear el grupo." };
  }
}

/** Lista mis grupos personalizados (no la comunidad) con no leídos. */
export async function fetchMyGroupChats(): Promise<GroupChat[]> {
  return manusChatRequest<GroupChat[]>("/api/manus/chats/groups");
}

/** Miembros de un grupo personalizado (perfil + rol). */
export async function fetchGroupMembers(chatId: string): Promise<GroupMember[]> {
  return manusChatRequest<GroupMember[]>(`/api/manus/chats/${encodeURIComponent(chatId)}/members`);
}

/** Edita nombre / descripción / foto de un grupo (solo el owner). */
export async function updateGroupChat(
  chatId: string,
  opts: { name: string; description?: string; avatarUrl?: string | null }
): Promise<{ ok: boolean; error?: string }> {
  try {
    return await manusChatRequest<{ ok: boolean }>(`/api/manus/chats/${encodeURIComponent(chatId)}/group`, {
      method: "PATCH",
      body: JSON.stringify(opts),
    });
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "No se pudo actualizar el grupo." };
  }
}

/** Añade un miembro al grupo (solo el owner y si se siguen mutuamente). */
export async function addGroupMember(chatId: string, userId: string): Promise<{ ok: boolean; error?: string }> {
  try {
    return await manusChatRequest<{ ok: boolean }>(`/api/manus/chats/${encodeURIComponent(chatId)}/members`, {
      method: "POST",
      body: JSON.stringify({ userId }),
    });
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "No se pudo añadir el miembro." };
  }
}

/** Quita a un miembro del grupo (solo el owner). */
export async function removeGroupMember(chatId: string, userId: string): Promise<{ ok: boolean; error?: string }> {
  try {
    return await manusChatRequest<{ ok: boolean }>(`/api/manus/chats/${encodeURIComponent(chatId)}/members/${encodeURIComponent(userId)}`, { method: "DELETE" });
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "No se pudo retirar el miembro." };
  }
}

/** Sale de un grupo (cualquier miembro). Si el owner sale, pasa a otro. */
export async function leaveGroupChat(chatId: string): Promise<{ ok: boolean; error?: string }> {
  try {
    return await manusChatRequest<{ ok: boolean }>(`/api/manus/chats/${encodeURIComponent(chatId)}/leave`, { method: "POST" });
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "No se pudo salir del grupo." };
  }
}

/** Cambia el rol de un miembro del grupo (solo el creador). */
export async function setGroupRole(
  chatId: string,
  userId: string,
  role: "admin" | "moderator" | "member"
): Promise<{ ok: boolean; error?: string }> {
  try {
    return await manusChatRequest<{ ok: boolean }>(`/api/manus/chats/${encodeURIComponent(chatId)}/members/${encodeURIComponent(userId)}`, {
      method: "PATCH",
      body: JSON.stringify({ role }),
    });
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "No se pudo actualizar el rol." };
  }
}

/** Elimina el grupo y todo su contenido (solo el creador o un administrador). */
export async function deleteGroupChat(chatId: string): Promise<{ ok: boolean; error?: string }> {
  try {
    return await manusChatRequest<{ ok: boolean }>(`/api/manus/chats/${encodeURIComponent(chatId)}/group`, { method: "DELETE" });
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "No se pudo eliminar el grupo." };
  }
}

// ───── Encuestas del chat ─────
// Las crea el administrador de la comunidad o el creador/administrador de un
// grupo personalizado. Cualquier miembro vota una vez; el recuento se agrega
// en el servidor (get_chat_poll) sin exponer quién votó a qué.

export type ChatPoll = {
  id: string;
  chat_id: string;
  created_by: string;
  question: string;
  options: string[];
  multiple: boolean;
  status: "open" | "closed";
  created_at: string;
  closed_at: string | null;
  votes: { option_index: number; count: number }[];
  total_votes: number;
  my_votes: number[];
};

/** ¿Es un mensaje de encuesta (kind='poll' con poll_id)? */
export function isPollMessage(m: Pick<ChatMessage, "kind" | "poll_id">): boolean {
  return m.kind === "poll" && !!m.poll_id;
}

// En modo local las encuestas viven en localStorage: los votos se guardan por
// usuario del navegador (varios perfiles locales comparten el dispositivo).
type LocalPoll = {
  id: string;
  chat_id: string;
  created_by: string;
  question: string;
  options: string[];
  multiple: boolean;
  status: "open" | "closed";
  created_at: string;
  closed_at: string | null;
  votes_by_user: Record<string, number>;
};

function localPollToRemote(p: LocalPoll, meId: string | null): ChatPoll {
  const votes: { option_index: number; count: number }[] = [];
  const byOption = new Map<number, number>();
  const myVotes: number[] = [];
  for (const [uid, opt] of Object.entries(p.votes_by_user ?? {})) {
    byOption.set(opt, (byOption.get(opt) ?? 0) + 1);
    if (uid === meId) myVotes.push(opt);
  }
  for (const [opt, count] of byOption) votes.push({ option_index: opt, count });
  votes.sort((a, b) => a.option_index - b.option_index);
  return {
    id: p.id,
    chat_id: p.chat_id,
    created_by: p.created_by,
    question: p.question,
    options: p.options,
    multiple: p.multiple,
    status: p.status,
    created_at: p.created_at,
    closed_at: p.closed_at,
    votes,
    total_votes: Object.keys(p.votes_by_user ?? {}).length,
    my_votes: myVotes,
  };
}

/** Crea una encuesta y publica su mensaje en el chat (solo admin/creador). */
export async function createPoll(
  chatId: string,
  opts: { question: string; options: string[]; multiple?: boolean }
): Promise<{ ok: boolean; pollId?: string; message?: ChatMessage; error?: string }> {
  try {
    return await manusChatRequest<{ ok: boolean; pollId?: string; message?: ChatMessage }>(`/api/manus/chats/${encodeURIComponent(chatId)}/polls`, {
      method: "POST",
      body: JSON.stringify(opts),
    });
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "No se pudo crear la encuesta." };
  }
}

/** Estado actual de una encuesta (opciones + recuento + mi voto). */
export async function fetchPoll(pollId: string): Promise<ChatPoll | null> {
  try {
    return await manusChatRequest<ChatPoll>(`/api/manus/chat-polls/${encodeURIComponent(pollId)}`);
  } catch {
    return null;
  }
}

/** Vota (o cambia el voto) en una encuesta abierta. */
export async function votePoll(pollId: string, optionIndex: number): Promise<{ ok: boolean; error?: string }> {
  try {
    return await manusChatRequest<{ ok: boolean }>(`/api/manus/chat-polls/${encodeURIComponent(pollId)}/vote`, {
      method: "POST",
      body: JSON.stringify({ optionIndex }),
    });
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "No se pudo registrar el voto." };
  }
}

/** Cierra una encuesta (creador / admin de la comunidad / admin del grupo). */
export async function closePoll(pollId: string): Promise<{ ok: boolean; error?: string }> {
  try {
    return await manusChatRequest<{ ok: boolean }>(`/api/manus/chat-polls/${encodeURIComponent(pollId)}/close`, { method: "POST" });
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "No se pudo cerrar la encuesta." };
  }
}

/**
 * Realtime de las encuestas: cuando alguien vota o se cierra una encuesta,
 * todos los clientes conectados la recargan para ver los resultados en vivo.
 * En modo local no hay realtime (los datos viven en este navegador).
 */
export function subscribeToPolls(
  chatId: string,
  onChange: (type: "INSERT" | "UPDATE" | "DELETE", pollId: string) => void
): () => void {
  void chatId;
  void onChange;
  return () => {};
}

/**
 * Busca perfiles para las menciones @usuario (por nombre de usuario o
 * nombre visible). Devuelve los que coinciden, limitados.
 */
export async function searchProfilesForMention(query: string, limit = 8): Promise<Profile[]> {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const profiles = await manusChatRequest<Profile[]>("/api/manus/records/profiles");
  return profiles.filter(profile =>
    profile.username?.toLowerCase().includes(q) || profile.display_name?.toLowerCase().includes(q)
  ).slice(0, Math.max(1, Math.min(limit, 20)));
}

export type ChatSticker = { id: string; path: string; title: string };

/**
 * Sube un sticker y lo guarda en la biblioteca de stickers de la cuenta.
 * Devuelve la ruta del archivo y el id de la fila creada en la tabla stickers.
 */
export async function uploadSticker(file: File): Promise<{ path: string; id: string }> {
  const me = await requireMe();
  const path = await uploadMedia(file, me.id);
  const id = crypto.randomUUID();
  await manusChatRequest(`/api/manus/records/stickers`, {
    method: "POST",
    body: JSON.stringify({ id, data: { user_id: me.id, path, created_at: new Date().toISOString() } }),
  });
  return { path, id };
}

/** Stickers guardados de la cuenta actual (persisten entre sesiones y dispositivos). */
export async function fetchMyStickers(): Promise<ChatSticker[]> {
  const me = await getMeId();
  if (!me) return [];
  const rows = await manusChatRequest<Array<Record<string, unknown>>>("/api/manus/records/stickers");
  return rows
    .filter(row => row.user_id === me.id && typeof row.id === "string" && typeof row.path === "string")
    .sort((a, b) => String(b.created_at ?? "").localeCompare(String(a.created_at ?? "")))
    .slice(0, 60)
    .map(row => ({ id: row.id as string, path: row.path as string, title: "Sticker" }));
}

/** Elimina un sticker de la biblioteca de la cuenta actual. */
export async function deleteSticker(id: string): Promise<void> {
  await requireMe();
  await manusChatRequest(`/api/manus/records/stickers/${encodeURIComponent(id)}`, { method: "DELETE" });
}

/** Resuelve rutas de media a URLs listas para <img>/<audio>. En modo local usa los data-URLs guardados. */
export async function signMedia(paths: string[]): Promise<string[]> {
  return paths.map(path => path.startsWith("/manus-storage/") ? path : "");
}

/** Sube un media (sticker/audio) respetando el modo activo del chat. */
export async function uploadChatMedia(file: File, userId: string): Promise<string> {
  return uploadMedia(file, userId);
}

/** Perfiles de los remitentes respetando el modo activo del chat. */
export async function fetchChatProfiles(ids: string[]): Promise<Map<string, Profile>> {
  if (!ids.length) return new Map();
  const rows = await manusChatRequest<Profile[]>("/api/manus/records/profiles");
  return new Map(rows.filter(profile => ids.includes(profile.id)).map(profile => [profile.id, profile]));
}

// ───── Cola de mensajes pendientes ─────
// Si un envío falla porque el servidor no responde (red), el mensaje se guarda
// en esta cola local y se reenvía automáticamente cuando vuelve la conexión o
// al abrir el chat de nuevo. Así el usuario nunca pierde un mensaje ni ve un
// aviso de «sin internet» cuando su conexión está bien.
type PendingSend = {
  chatId: string;
  content?: string;
  mediaUrl?: string;
  mediaType?: "image" | "video" | "audio" | "sticker";
  replyToId?: string | null;
  queuedAt: string;
};

const PENDING_KEY = "_chat_pending_queue";

/** ¿Es un fallo de red (el servidor no respondió) en lugar de un error de la app? */
export function isNetworkError(err: unknown): boolean {
  const msg = (err as Error)?.message ?? "";
  return /failed to fetch|networkerror|load failed|network request failed|err_|abort|timeout/i.test(msg);
}

/** Guarda un mensaje en la cola local para reenviarlo cuando haya conexión. */
export function queuePendingMessage(
  chatId: string,
  opts: { content?: string; mediaUrl?: string; mediaType?: "image" | "video" | "audio" | "sticker"; replyToId?: string | null }
): void {
  try {
    const list: PendingSend[] = JSON.parse(localStorage.getItem(PENDING_KEY) || "[]");
    list.push({
      chatId,
      content: opts.content,
      mediaUrl: opts.mediaUrl,
      mediaType: opts.mediaType,
      replyToId: opts.replyToId ?? null,
      queuedAt: new Date().toISOString(),
    });
    localStorage.setItem(PENDING_KEY, JSON.stringify(list.slice(-50)));
  } catch {
    /* noop */
  }
}

/**
 * Reenvía los mensajes pendientes. Devuelve cuántos se enviaron.
 * - Si la red sigue caída, los no enviados permanecen en la cola.
 * - Los que fallan por un motivo permanente (permisos, clave inválida…) se
 *   descartan para no quedarse reintentando en bucle.
 */
export async function flushPendingMessages(): Promise<number> {
  let list: PendingSend[] = [];
  try {
    list = JSON.parse(localStorage.getItem(PENDING_KEY) || "[]") as PendingSend[];
  } catch {
    /* noop */
  }
  if (!list.length) return 0;
  let sent = 0;
  const remaining: PendingSend[] = [];
  for (const item of list) {
    try {
      await sendChatMessage(item.chatId, {
        content: item.content,
        mediaUrl: item.mediaUrl,
        mediaType: item.mediaType,
        replyToId: item.replyToId ?? null,
      });
      sent += 1;
    } catch (err) {
      if (isNetworkError(err)) {
        remaining.push(item);
        break; // la red sigue caída: no machacar con más peticiones
      }
      // Error permanente (permisos, clave…): se descarta para evitar bucle.
    }
  }
  try {
    localStorage.setItem(PENDING_KEY, JSON.stringify(remaining));
  } catch {
    /* noop */
  }
  return sent;
}

/**
 * ¿La tabla del chat está desactualizada (sin la columna media_type)?
 * Se usa al abrir el chat para avisar de reinstalar el esquema antes de que
 * falle el envío de audios. En modo local no aplica (no hay esquema real).
 */
export async function isChatSchemaOutdated(): Promise<boolean> {
  return false;
}

// ───── Avisos del grupo y paquetes de regalo ─────
// Los avisos solo los publica el administrador (linkyteam989@gmail.com) y son
// visibles para todos. Los paquetes de regalo reparten orbes: el admin elige
// la cantidad por persona (par, mínimo 100) y cuántas personas pueden abrirlo;
// al llenarse, el paquete se cierra automáticamente.

export function isAnnouncement(m: Pick<ChatMessage, "kind">): boolean {
  return m.kind === "announcement";
}

export function isGiftMessage(m: Pick<ChatMessage, "kind">): boolean {
  return m.kind === "gift";
}

export type OrbGift = {
  id: string;
  chat_id: string;
  created_by: string;
  amount_per_person: number;
  max_claims: number;
  claims: number;
  total_orbes: number;
  status: "open" | "closed" | "expired";
  created_at: string;
  closed_at: string | null;
  expires_at?: string | null;
  claimed_by_me?: boolean;
};

/**
 * Caduca los paquetes de regalo abiertos que superaron las 24 horas y
 * devuelve al creador los orbes que nadie reclamó. Devuelve cuántos se
 * cerraron (0 si no había ninguno vencido).
 */
export async function expireOrbGifts(): Promise<number> {
  try {
    const result = await manusChatRequest<{ expired: number }>("/api/manus/orb-gifts/expire", { method: "POST" });
    return Number.isInteger(result.expired) ? result.expired : 0;
  } catch {
    return 0;
  }
}

/** Publica un aviso del grupo en el chat (solo el administrador). */
export async function createAnnouncement(
  chatId: string,
  content: string
): Promise<{ ok: boolean; message?: ChatMessage; error?: string }> {
  try {
    return await manusChatRequest<{ ok: boolean; message?: ChatMessage }>(`/api/manus/chats/${encodeURIComponent(chatId)}/announcements`, {
      method: "POST",
      body: JSON.stringify({ content }),
    });
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "No se pudo publicar el aviso." };
  }
}

/** Crea un paquete de regalos de orbes en el chat (solo el administrador). */
export async function createOrbGift(
  chatId: string,
  opts: { title?: string; amountPerPerson: number; maxClaims: number }
): Promise<{ ok: boolean; giftId?: string; message?: ChatMessage; error?: string }> {
  try {
    return await manusChatRequest<{ ok: boolean; giftId?: string; message?: ChatMessage }>(`/api/manus/chats/${encodeURIComponent(chatId)}/orb-gifts`, {
      method: "POST",
      body: JSON.stringify(opts),
    });
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "No se pudo crear el regalo." };
  }
}

/** Abre un regalo del paquete y acredita los orbes al usuario. */
export async function claimOrbGift(
  giftId: string
): Promise<{ ok: boolean; amount?: number; claims?: number; closed?: boolean; error?: string }> {
  try {
    return await manusChatRequest<{ ok: boolean; amount?: number; claims?: number; closed?: boolean }>(`/api/manus/orb-gifts/${encodeURIComponent(giftId)}/claim`, { method: "POST" });
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "No se pudo abrir el regalo." };
  }
}

/** Estado actual de un paquete de regalo (para renderizar la tarjeta). */
export async function fetchOrbGift(giftId: string): Promise<OrbGift | null> {
  try {
    return await manusChatRequest<OrbGift>(`/api/manus/orb-gifts/${encodeURIComponent(giftId)}`);
  } catch {
    return null;
  }
}

/**
 * Realtime de los paquetes de regalo: cuando alguien abre un regalo o el
 * paquete se cierra, todos los clientes conectados lo ven al instante.
 */
export function subscribeToOrbGifts(
  onChange: (type: "INSERT" | "UPDATE" | "DELETE", gift: OrbGift) => void
): () => void {
  void onChange;
  return () => {};
}
