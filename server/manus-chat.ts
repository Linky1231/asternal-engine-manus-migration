import { and, desc, eq, inArray, lt } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { asternalChatMembers, asternalChatMessages, asternalChatPollVotes, asternalChatPolls, asternalChats, asternalOrbGiftClaims, asternalOrbGifts, asternalRecords } from "../drizzle/schema";
import { getDb } from "./db";
import { ENV } from "./_core/env";

export const COMMUNITY_CHAT_ID = "c0000000-0000-4000-8000-000000000000";
export const COMMUNITY_CHAT_NAME = "Asternal · Comunidad";

export type ChatMessageDto = {
  id: string;
  chat_id: string;
  sender_id: string;
  content: string | null;
  media_url: string | null;
  media_type: string | null;
  reply_to_id: string | null;
  kind: string | null;
  gift_id: string | null;
  poll_id: string | null;
  created_at: string;
};

type ChatRole = "owner" | "member" | "admin" | "moderator";
type ChatRow = typeof asternalChats.$inferSelect;

function toIso(value: Date | null | undefined) {
  return (value ?? new Date(0)).toISOString();
}

function toMessage(row: typeof asternalChatMessages.$inferSelect): ChatMessageDto {
  return {
    id: row.id,
    chat_id: row.chatId,
    sender_id: row.senderOpenId,
    content: row.content,
    media_url: row.mediaUrl,
    media_type: row.mediaType,
    reply_to_id: row.replyToId,
    kind: row.kind,
    gift_id: row.giftId,
    poll_id: row.pollId,
    created_at: toIso(row.createdAt),
  };
}

function cleanId(value: unknown, label: string) {
  if (typeof value !== "string" || !/^[a-zA-Z0-9_-]{1,64}$/.test(value)) throw new Error(`${label} no es válido.`);
  return value;
}

function cleanText(value: unknown, limit: number, label: string, required = false): string | null {
  if (value === null || value === undefined) {
    if (required) throw new Error(`${label} es obligatorio.`);
    return null;
  }
  if (typeof value !== "string") throw new Error(`${label} no es válido.`);
  const text = value.trim().slice(0, limit);
  if (required && !text) throw new Error(`${label} es obligatorio.`);
  return text || null;
}

function cleanMediaType(value: unknown): "image" | "video" | "audio" | "sticker" | null {
  return value === "image" || value === "video" || value === "audio" || value === "sticker" ? value : null;
}

async function database() {
  const db = await getDb();
  if (!db) throw new Error("La base de datos de Manus no está disponible.");
  return db;
}

async function ensureCommunityMembership(userOpenId: string) {
  const db = await database();
  const existing = await db.select().from(asternalChats).where(eq(asternalChats.id, COMMUNITY_CHAT_ID)).limit(1);
  if (!existing[0]) {
    await db.insert(asternalChats).values({
      id: COMMUNITY_CHAT_ID,
      type: "community",
      name: COMMUNITY_CHAT_NAME,
      ownerOpenId: userOpenId,
    }).onDuplicateKeyUpdate({ set: { name: COMMUNITY_CHAT_NAME } });
  }
  await db.insert(asternalChatMembers).values({ chatId: COMMUNITY_CHAT_ID, userOpenId, role: "member" })
    .onDuplicateKeyUpdate({ set: { userOpenId } });
  const chat = (await db.select().from(asternalChats).where(eq(asternalChats.id, COMMUNITY_CHAT_ID)).limit(1))[0];
  if (!chat) throw new Error("No se pudo preparar el chat de la comunidad.");
  return { db, chat };
}

async function findMemberChat(userOpenId: string, rawChatId: unknown): Promise<{ db: NonNullable<Awaited<ReturnType<typeof getDb>>>; chat: ChatRow; role: ChatRole }> {
  const chatId = cleanId(rawChatId, "El chat");
  if (chatId === COMMUNITY_CHAT_ID) {
    const { db, chat } = await ensureCommunityMembership(userOpenId);
    return { db, chat, role: "member" };
  }
  const db = await database();
  const chat = (await db.select().from(asternalChats).where(eq(asternalChats.id, chatId)).limit(1))[0];
  if (!chat) throw new Error("El chat no existe.");
  const member = (await db.select().from(asternalChatMembers).where(and(eq(asternalChatMembers.chatId, chatId), eq(asternalChatMembers.userOpenId, userOpenId))).limit(1))[0];
  if (!member) throw new Error("No perteneces a este chat.");
  return { db, chat, role: member.role };
}

export async function getCommunityChatForUser(userOpenId: string) {
  const { db, chat } = await ensureCommunityMembership(userOpenId);
  const members = await db.select({ userOpenId: asternalChatMembers.userOpenId }).from(asternalChatMembers)
    .where(eq(asternalChatMembers.chatId, chat.id));
  return { id: chat.id, name: chat.name, memberCount: members.length, memberOk: true, local: false };
}

export async function listChatMessagesForUser(userOpenId: string, rawChatId: unknown, input: { before?: unknown; limit?: unknown } = {}) {
  const { db, chat } = await findMemberChat(userOpenId, rawChatId);
  const limit = typeof input.limit === "number" && Number.isInteger(input.limit) ? Math.min(Math.max(input.limit, 1), 100) : 60;
  const before = input.before && typeof input.before === "object" ? input.before as { created_at?: unknown } : null;
  const beforeAt = typeof before?.created_at === "string" && Number.isFinite(Date.parse(before.created_at)) ? new Date(before.created_at) : null;
  const conditions = beforeAt ? and(eq(asternalChatMessages.chatId, chat.id), lt(asternalChatMessages.createdAt, beforeAt)) : eq(asternalChatMessages.chatId, chat.id);
  const rows = await db.select().from(asternalChatMessages).where(conditions).orderBy(desc(asternalChatMessages.createdAt), desc(asternalChatMessages.id)).limit(limit + 1);
  const hasMore = rows.length > limit;
  return { messages: rows.slice(0, limit).reverse().map(toMessage), hasMore };
}

export async function sendChatMessageForUser(userOpenId: string, rawChatId: unknown, input: Record<string, unknown>): Promise<ChatMessageDto> {
  const { db, chat } = await findMemberChat(userOpenId, rawChatId);
  const content = cleanText(input.content, 5_000, "El mensaje");
  const mediaUrl = cleanText(input.mediaUrl, 2_000, "El recurso");
  const mediaType = cleanMediaType(input.mediaType);
  if (!content && !mediaUrl) throw new Error("Escribe un mensaje o adjunta un recurso.");
  if (mediaUrl && !mediaUrl.startsWith("/manus-storage/")) throw new Error("Los recursos del chat deben estar almacenados en Manus.");
  const replyToId = input.replyToId === null || input.replyToId === undefined ? null : cleanId(input.replyToId, "La respuesta");
  const kind = cleanText(input.kind, 32, "El tipo de mensaje");
  const pollId = input.pollId === null || input.pollId === undefined ? null : cleanId(input.pollId, "La encuesta");
  const giftId = input.giftId === null || input.giftId === undefined ? null : cleanId(input.giftId, "El regalo");
  const id = randomUUID();
  await db.insert(asternalChatMessages).values({
    id,
    chatId: chat.id,
    senderOpenId: userOpenId,
    content,
    mediaUrl,
    mediaType,
    replyToId,
    kind,
    pollId,
    giftId,
  });
  const created = (await db.select().from(asternalChatMessages).where(eq(asternalChatMessages.id, id)).limit(1))[0];
  if (!created) throw new Error("No se pudo guardar el mensaje.");
  await db.update(asternalChats).set({ lastMessageAt: created.createdAt }).where(eq(asternalChats.id, chat.id));
  return toMessage(created);
}

export async function markChatReadForUser(userOpenId: string, rawChatId: unknown) {
  const { db, chat } = await findMemberChat(userOpenId, rawChatId);
  await db.update(asternalChatMembers).set({ lastReadAt: new Date() })
    .where(and(eq(asternalChatMembers.chatId, chat.id), eq(asternalChatMembers.userOpenId, userOpenId)));
  return { success: true };
}

export async function getChatReadAtForUser(userOpenId: string, rawChatId: unknown) {
  const { db, chat } = await findMemberChat(userOpenId, rawChatId);
  const member = (await db.select({ lastReadAt: asternalChatMembers.lastReadAt }).from(asternalChatMembers)
    .where(and(eq(asternalChatMembers.chatId, chat.id), eq(asternalChatMembers.userOpenId, userOpenId))).limit(1))[0];
  return { lastReadAt: member?.lastReadAt ? toIso(member.lastReadAt) : null };
}

export async function listMemberChatIds(userOpenId: string) {
  const db = await database();
  const memberships = await db.select({ chatId: asternalChatMembers.chatId }).from(asternalChatMembers).where(eq(asternalChatMembers.userOpenId, userOpenId));
  const ids = memberships.map(member => member.chatId);
  if (!ids.length) return [];
  return db.select().from(asternalChats).where(inArray(asternalChats.id, ids)).orderBy(desc(asternalChats.lastMessageAt));
}

type ProfileSummary = Record<string, unknown> & { id: string };

function toProfile(record: typeof asternalRecords.$inferSelect | undefined, openId: string): ProfileSummary {
  const data = record?.data && typeof record.data === "object" && !Array.isArray(record.data) ? record.data as Record<string, unknown> : {};
  return { id: openId, username: typeof data.username === "string" ? data.username : `user_${openId.slice(-8)}`, ...data };
}

async function getProfileSummaries(db: NonNullable<Awaited<ReturnType<typeof getDb>>>, openIds: string[]): Promise<Map<string, ProfileSummary>> {
  const distinct = [...new Set(openIds)].filter(Boolean);
  if (!distinct.length) return new Map();
  const records = await db.select().from(asternalRecords).where(and(eq(asternalRecords.collection, "profiles"), inArray(asternalRecords.id, distinct)));
  const map = new Map(records.map(record => [record.id, toProfile(record, record.id)]));
  distinct.forEach(openId => { if (!map.has(openId)) map.set(openId, toProfile(undefined, openId)); });
  return map;
}

async function assertMutualFollow(db: NonNullable<Awaited<ReturnType<typeof getDb>>>, userOpenId: string, otherOpenId: string) {
  const other = cleanId(otherOpenId, "La cuenta");
  if (other === userOpenId) throw new Error("No puedes abrir un chat directo contigo mismo.");
  const records = await db.select().from(asternalRecords).where(and(eq(asternalRecords.collection, "follows"), eq(asternalRecords.visibility, "public")));
  const follows = records.map(record => record.data && typeof record.data === "object" && !Array.isArray(record.data) ? record.data as Record<string, unknown> : {});
  const followsOther = follows.some(follow => follow.follower_id === userOpenId && follow.following_id === other);
  const followsUser = follows.some(follow => follow.follower_id === other && follow.following_id === userOpenId);
  if (!followsOther || !followsUser) throw new Error("Los chats privados requieren seguimiento mutuo.");
  return other;
}

async function lastMessageForChat(db: NonNullable<Awaited<ReturnType<typeof getDb>>>, chatId: string) {
  const row = (await db.select().from(asternalChatMessages).where(eq(asternalChatMessages.chatId, chatId)).orderBy(desc(asternalChatMessages.createdAt), desc(asternalChatMessages.id)).limit(1))[0];
  return row ? toMessage(row) : null;
}

export async function getOrCreateDmForUser(userOpenId: string, rawOtherOpenId: unknown) {
  const db = await database();
  const otherOpenId = await assertMutualFollow(db, userOpenId, typeof rawOtherOpenId === "string" ? rawOtherOpenId : "");
  const directKey = [userOpenId, otherOpenId].sort().join(":");
  let chat = (await db.select().from(asternalChats).where(eq(asternalChats.directKey, directKey)).limit(1))[0];
  if (!chat) {
    const id = randomUUID();
    await db.insert(asternalChats).values({ id, type: "dm", name: "Conversación directa", ownerOpenId: userOpenId, directKey })
      .onDuplicateKeyUpdate({ set: { directKey } });
    chat = (await db.select().from(asternalChats).where(eq(asternalChats.directKey, directKey)).limit(1))[0];
    if (!chat) throw new Error("No se pudo crear el chat directo.");
    await db.insert(asternalChatMembers).values([
      { chatId: chat.id, userOpenId, role: "owner" },
      { chatId: chat.id, userOpenId: otherOpenId, role: "member" },
    ]).onDuplicateKeyUpdate({ set: { userOpenId } });
  }
  return { ok: true, chatId: chat.id };
}

export async function listDmChatsForUser(userOpenId: string) {
  const db = await database();
  const chats = (await listMemberChatIds(userOpenId)).filter(chat => chat.type === "dm");
  const memberRows = chats.length ? await db.select().from(asternalChatMembers).where(inArray(asternalChatMembers.chatId, chats.map(chat => chat.id))) : [];
  const otherIds = memberRows.filter(member => member.userOpenId !== userOpenId).map(member => member.userOpenId);
  const profiles = await getProfileSummaries(db, otherIds);
  return Promise.all(chats.map(async chat => {
    const otherId = memberRows.find(member => member.chatId === chat.id && member.userOpenId !== userOpenId)?.userOpenId;
    const myMember = memberRows.find(member => member.chatId === chat.id && member.userOpenId === userOpenId);
    const lastMessage = await lastMessageForChat(db, chat.id);
    return {
      chat_id: chat.id,
      other: otherId ? profiles.get(otherId) ?? null : null,
      last_message: lastMessage,
      last_at: lastMessage?.created_at ?? (chat.lastMessageAt ? toIso(chat.lastMessageAt) : null),
      unread: lastMessage && (!myMember?.lastReadAt || lastMessage.createdAt > myMember.lastReadAt) ? 1 : 0,
    };
  }));
}

export async function listMutualFollowProfilesForUser(userOpenId: string) {
  const db = await database();
  const records = await db.select().from(asternalRecords).where(and(eq(asternalRecords.collection, "follows"), eq(asternalRecords.visibility, "public")));
  const follows = records.map(record => record.data && typeof record.data === "object" && !Array.isArray(record.data) ? record.data as Record<string, unknown> : {});
  const following = follows.filter(follow => follow.follower_id === userOpenId && typeof follow.following_id === "string").map(follow => follow.following_id as string);
  const mutualIds = following.filter(other => follows.some(follow => follow.follower_id === other && follow.following_id === userOpenId));
  return [...(await getProfileSummaries(db, mutualIds)).values()];
}

function cleanGroupName(value: unknown) {
  return cleanText(value, 160, "El nombre del grupo", true) as string;
}

async function requireGroupOwner(userOpenId: string, chatId: unknown) {
  const context = await findMemberChat(userOpenId, chatId);
  if (context.chat.type !== "group" || context.chat.ownerOpenId !== userOpenId) throw new Error("Solo la cuenta creadora puede administrar este grupo.");
  return context;
}

export async function createGroupChatForUser(userOpenId: string, input: Record<string, unknown>) {
  const db = await database();
  const name = cleanGroupName(input.name);
  const description = cleanText(input.description, 1_000, "La descripción");
  const avatarUrl = cleanText(input.avatarUrl, 2_000, "La imagen");
  if (avatarUrl && !avatarUrl.startsWith("/manus-storage/")) throw new Error("La imagen del grupo debe almacenarse en Manus.");
  const requested = Array.isArray(input.memberIds) ? input.memberIds.filter((id): id is string => typeof id === "string").slice(0, 50) : [];
  const memberIds = [...new Set(requested.filter(id => id !== userOpenId))];
  for (const memberId of memberIds) await assertMutualFollow(db, userOpenId, memberId);
  const id = randomUUID();
  await db.insert(asternalChats).values({ id, type: "group", name, description, avatarUrl, ownerOpenId: userOpenId });
  await db.insert(asternalChatMembers).values([
    { chatId: id, userOpenId, role: "owner" },
    ...memberIds.map(memberId => ({ chatId: id, userOpenId: memberId, role: "member" as const })),
  ]);
  return { ok: true, chatId: id };
}

export async function listGroupChatsForUser(userOpenId: string) {
  const db = await database();
  const chats = (await listMemberChatIds(userOpenId)).filter(chat => chat.type === "group");
  const memberRows = chats.length ? await db.select().from(asternalChatMembers).where(and(eq(asternalChatMembers.userOpenId, userOpenId), inArray(asternalChatMembers.chatId, chats.map(chat => chat.id)))) : [];
  return Promise.all(chats.map(async chat => {
    const lastMessage = await lastMessageForChat(db, chat.id);
    const members = await db.select({ userOpenId: asternalChatMembers.userOpenId }).from(asternalChatMembers).where(eq(asternalChatMembers.chatId, chat.id));
    const myMember = memberRows.find(member => member.chatId === chat.id);
    return {
      chat_id: chat.id,
      name: chat.name,
      description: chat.description,
      avatar_url: chat.avatarUrl,
      created_by: chat.ownerOpenId,
      my_role: myMember?.role ?? null,
      member_count: members.length,
      last_message: lastMessage,
      last_at: lastMessage?.created_at ?? (chat.lastMessageAt ? toIso(chat.lastMessageAt) : null),
      unread: lastMessage && (!myMember?.lastReadAt || lastMessage.createdAt > myMember.lastReadAt) ? 1 : 0,
    };
  }));
}

export async function listGroupMembersForUser(userOpenId: string, chatId: unknown) {
  const { db, chat } = await findMemberChat(userOpenId, chatId);
  if (chat.type !== "group") throw new Error("El chat no es un grupo.");
  const members = await db.select().from(asternalChatMembers).where(eq(asternalChatMembers.chatId, chat.id));
  const profiles = await getProfileSummaries(db, members.map(member => member.userOpenId));
  return members.map(member => ({ profile: profiles.get(member.userOpenId)!, role: member.role, joined_at: toIso(member.joinedAt) }));
}

export async function updateGroupChatForUser(userOpenId: string, chatId: unknown, input: Record<string, unknown>) {
  const { db, chat } = await requireGroupOwner(userOpenId, chatId);
  const name = cleanGroupName(input.name);
  const description = cleanText(input.description, 1_000, "La descripción");
  const avatarUrl = cleanText(input.avatarUrl, 2_000, "La imagen");
  if (avatarUrl && !avatarUrl.startsWith("/manus-storage/")) throw new Error("La imagen del grupo debe almacenarse en Manus.");
  await db.update(asternalChats).set({ name, description, avatarUrl }).where(eq(asternalChats.id, chat.id));
  return { ok: true };
}

export async function addGroupMemberForUser(userOpenId: string, chatId: unknown, rawMemberId: unknown) {
  const { db, chat } = await requireGroupOwner(userOpenId, chatId);
  const memberId = await assertMutualFollow(db, userOpenId, typeof rawMemberId === "string" ? rawMemberId : "");
  await db.insert(asternalChatMembers).values({ chatId: chat.id, userOpenId: memberId, role: "member" }).onDuplicateKeyUpdate({ set: { userOpenId: memberId } });
  return { ok: true };
}

export async function removeGroupMemberForUser(userOpenId: string, chatId: unknown, rawMemberId: unknown) {
  const { db, chat } = await requireGroupOwner(userOpenId, chatId);
  const memberId = cleanId(rawMemberId, "La cuenta");
  if (memberId === userOpenId) throw new Error("La cuenta creadora debe usar la opción para salir del grupo.");
  await db.delete(asternalChatMembers).where(and(eq(asternalChatMembers.chatId, chat.id), eq(asternalChatMembers.userOpenId, memberId)));
  return { ok: true };
}

export async function setGroupRoleForUser(userOpenId: string, chatId: unknown, rawMemberId: unknown, rawRole: unknown) {
  const { db, chat } = await requireGroupOwner(userOpenId, chatId);
  const memberId = cleanId(rawMemberId, "La cuenta");
  if (memberId === userOpenId) throw new Error("No puedes cambiar el rol de la cuenta creadora.");
  if (rawRole !== "admin" && rawRole !== "moderator" && rawRole !== "member") throw new Error("El rol no es válido.");
  await db.update(asternalChatMembers).set({ role: rawRole }).where(and(eq(asternalChatMembers.chatId, chat.id), eq(asternalChatMembers.userOpenId, memberId)));
  return { ok: true };
}

export async function leaveGroupChatForUser(userOpenId: string, rawChatId: unknown) {
  const { db, chat } = await findMemberChat(userOpenId, rawChatId);
  if (chat.type !== "group") throw new Error("Solo puedes salir de grupos personalizados.");
  const members = await db.select().from(asternalChatMembers).where(eq(asternalChatMembers.chatId, chat.id)).orderBy(asternalChatMembers.joinedAt);
  if (chat.ownerOpenId === userOpenId) {
    const successor = members.find(member => member.userOpenId !== userOpenId);
    if (successor) {
      await db.update(asternalChats).set({ ownerOpenId: successor.userOpenId }).where(eq(asternalChats.id, chat.id));
      await db.update(asternalChatMembers).set({ role: "owner" }).where(and(eq(asternalChatMembers.chatId, chat.id), eq(asternalChatMembers.userOpenId, successor.userOpenId)));
    }
  }
  await db.delete(asternalChatMembers).where(and(eq(asternalChatMembers.chatId, chat.id), eq(asternalChatMembers.userOpenId, userOpenId)));
  if (members.length <= 1) await db.delete(asternalChats).where(eq(asternalChats.id, chat.id));
  return { ok: true };
}

export async function deleteGroupChatForUser(userOpenId: string, chatId: unknown) {
  const { db, chat } = await requireGroupOwner(userOpenId, chatId);
  await db.delete(asternalChatMessages).where(eq(asternalChatMessages.chatId, chat.id));
  await db.delete(asternalChatMembers).where(eq(asternalChatMembers.chatId, chat.id));
  await db.delete(asternalChats).where(eq(asternalChats.id, chat.id));
  return { ok: true };
}

type ChatPollDto = {
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

function canManageChat(userOpenId: string, chat: ChatRow, role: ChatRole) {
  return (chat.type === "community" && userOpenId === ENV.ownerOpenId) || role === "owner" || role === "admin" || role === "moderator";
}

function cleanPollOptions(value: unknown) {
  if (!Array.isArray(value)) throw new Error("La encuesta debe incluir opciones.");
  const options = value.map(option => cleanText(option, 120, "Una opción", true) as string).filter(Boolean).slice(0, 6);
  if (options.length < 2) throw new Error("La encuesta necesita al menos dos opciones.");
  return options;
}

async function pollDto(db: NonNullable<Awaited<ReturnType<typeof getDb>>>, poll: typeof asternalChatPolls.$inferSelect, userOpenId: string): Promise<ChatPollDto> {
  const votes = await db.select().from(asternalChatPollVotes).where(eq(asternalChatPollVotes.pollId, poll.id));
  const counts = new Map<number, number>();
  votes.forEach(vote => counts.set(vote.optionIndex, (counts.get(vote.optionIndex) ?? 0) + 1));
  const options = Array.isArray(poll.options) ? poll.options.filter((option): option is string => typeof option === "string") : [];
  return {
    id: poll.id,
    chat_id: poll.chatId,
    created_by: poll.createdByOpenId,
    question: poll.question,
    options,
    multiple: poll.multiple === "true",
    status: poll.status,
    created_at: toIso(poll.createdAt),
    closed_at: poll.closedAt ? toIso(poll.closedAt) : null,
    votes: [...counts.entries()].map(([option_index, count]) => ({ option_index, count })).sort((a, b) => a.option_index - b.option_index),
    total_votes: votes.length,
    my_votes: votes.filter(vote => vote.userOpenId === userOpenId).map(vote => vote.optionIndex).sort((a, b) => a - b),
  };
}

export async function createChatPollForUser(userOpenId: string, rawChatId: unknown, input: Record<string, unknown>) {
  const context = await findMemberChat(userOpenId, rawChatId);
  if (!canManageChat(userOpenId, context.chat, context.role)) throw new Error("No tienes permisos para crear encuestas en este chat.");
  const question = cleanText(input.question, 300, "La pregunta", true) as string;
  const options = cleanPollOptions(input.options);
  const multiple = input.multiple === true ? "true" as const : "false" as const;
  const id = randomUUID();
  await context.db.insert(asternalChatPolls).values({ id, chatId: context.chat.id, createdByOpenId: userOpenId, question, options, multiple });
  const message = await sendChatMessageForUser(userOpenId, context.chat.id, { content: question, kind: "poll", pollId: id });
  return { ok: true, pollId: id, message };
}

export async function getChatPollForUser(userOpenId: string, rawPollId: unknown): Promise<ChatPollDto | null> {
  const pollId = cleanId(rawPollId, "La encuesta");
  const db = await database();
  const poll = (await db.select().from(asternalChatPolls).where(eq(asternalChatPolls.id, pollId)).limit(1))[0];
  if (!poll) return null;
  await findMemberChat(userOpenId, poll.chatId);
  return pollDto(db, poll, userOpenId);
}

export async function voteChatPollForUser(userOpenId: string, rawPollId: unknown, rawOptionIndex: unknown) {
  const pollId = cleanId(rawPollId, "La encuesta");
  if (typeof rawOptionIndex !== "number" || !Number.isInteger(rawOptionIndex)) throw new Error("La opción no es válida.");
  const db = await database();
  const poll = (await db.select().from(asternalChatPolls).where(eq(asternalChatPolls.id, pollId)).limit(1))[0];
  if (!poll) throw new Error("La encuesta no existe.");
  await findMemberChat(userOpenId, poll.chatId);
  if (poll.status !== "open") throw new Error("Esta encuesta ya está cerrada.");
  const options = Array.isArray(poll.options) ? poll.options : [];
  if (rawOptionIndex < 0 || rawOptionIndex >= options.length) throw new Error("La opción no existe.");
  if (poll.multiple === "false") {
    await db.delete(asternalChatPollVotes).where(and(eq(asternalChatPollVotes.pollId, poll.id), eq(asternalChatPollVotes.userOpenId, userOpenId)));
  }
  await db.insert(asternalChatPollVotes).values({ pollId: poll.id, userOpenId, optionIndex: rawOptionIndex })
    .onDuplicateKeyUpdate({ set: { optionIndex: rawOptionIndex } });
  return { ok: true };
}

export async function closeChatPollForUser(userOpenId: string, rawPollId: unknown) {
  const pollId = cleanId(rawPollId, "La encuesta");
  const db = await database();
  const poll = (await db.select().from(asternalChatPolls).where(eq(asternalChatPolls.id, pollId)).limit(1))[0];
  if (!poll) throw new Error("La encuesta no existe.");
  const context = await findMemberChat(userOpenId, poll.chatId);
  if (poll.createdByOpenId !== userOpenId && !canManageChat(userOpenId, context.chat, context.role)) throw new Error("No tienes permisos para cerrar esta encuesta.");
  await db.update(asternalChatPolls).set({ status: "closed", closedAt: new Date() }).where(eq(asternalChatPolls.id, poll.id));
  return { ok: true };
}

type OrbGiftDto = {
  id: string;
  chat_id: string;
  created_by: string;
  title: string;
  amount_per_person: number;
  max_claims: number;
  claims: number;
  total_orbes: number;
  status: "open" | "closed" | "expired";
  created_at: string;
  closed_at: string | null;
  expires_at: string | null;
  claimed_by_me: boolean;
};

function profileData(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? { ...value as Record<string, unknown> } : {};
}

async function adjustOrbes(db: NonNullable<Awaited<ReturnType<typeof getDb>>>, userOpenId: string, delta: number) {
  const profile = (await db.select().from(asternalRecords).where(and(eq(asternalRecords.id, userOpenId), eq(asternalRecords.collection, "profiles"), eq(asternalRecords.ownerOpenId, userOpenId))).limit(1))[0];
  if (!profile) throw new Error("No se encontró el perfil de Manus.");
  const data = profileData(profile.data);
  const balance = typeof data.orbes === "number" && Number.isFinite(data.orbes) ? Math.max(0, Math.floor(data.orbes)) : 0;
  const next = balance + delta;
  if (next < 0) throw new Error("No tienes orbes suficientes.");
  data.orbes = next;
  await db.update(asternalRecords).set({ data }).where(and(eq(asternalRecords.id, userOpenId), eq(asternalRecords.ownerOpenId, userOpenId)));
  return next;
}

async function giftDto(db: NonNullable<Awaited<ReturnType<typeof getDb>>>, gift: typeof asternalOrbGifts.$inferSelect, userOpenId: string): Promise<OrbGiftDto> {
  const claimed = (await db.select({ userOpenId: asternalOrbGiftClaims.userOpenId }).from(asternalOrbGiftClaims)
    .where(and(eq(asternalOrbGiftClaims.giftId, gift.id), eq(asternalOrbGiftClaims.userOpenId, userOpenId))).limit(1))[0];
  return {
    id: gift.id,
    chat_id: gift.chatId,
    created_by: gift.createdByOpenId,
    title: gift.title,
    amount_per_person: gift.amountPerPerson,
    max_claims: gift.maxClaims,
    claims: gift.claims,
    total_orbes: gift.amountPerPerson * gift.maxClaims,
    status: gift.status,
    created_at: toIso(gift.createdAt),
    closed_at: gift.closedAt ? toIso(gift.closedAt) : null,
    expires_at: gift.expiresAt ? toIso(gift.expiresAt) : null,
    claimed_by_me: Boolean(claimed),
  };
}

export async function createAnnouncementForUser(userOpenId: string, rawChatId: unknown, rawContent: unknown) {
  const context = await findMemberChat(userOpenId, rawChatId);
  if (context.chat.type !== "community" || userOpenId !== ENV.ownerOpenId) throw new Error("Solo la administración puede publicar avisos.");
  const content = cleanText(rawContent, 2_000, "El aviso", true) as string;
  const message = await sendChatMessageForUser(userOpenId, context.chat.id, { content, kind: "announcement" });
  return { ok: true, message };
}

export async function createOrbGiftForUser(userOpenId: string, rawChatId: unknown, input: Record<string, unknown>) {
  const context = await findMemberChat(userOpenId, rawChatId);
  if (context.chat.type !== "community" || userOpenId !== ENV.ownerOpenId) throw new Error("Solo la administración puede crear regalos de orbes.");
  const amount = typeof input.amountPerPerson === "number" && Number.isInteger(input.amountPerPerson) ? input.amountPerPerson : 0;
  const maxClaims = typeof input.maxClaims === "number" && Number.isInteger(input.maxClaims) ? input.maxClaims : 0;
  if (amount < 100 || amount > 100_000 || amount % 2 !== 0) throw new Error("El regalo debe asignar una cantidad par entre 100 y 100000 orbes.");
  if (maxClaims < 1 || maxClaims > 200) throw new Error("El regalo debe permitir entre una y 200 aperturas.");
  const title = cleanText(input.title, 160, "El título") ?? "Regalo de orbes";
  const id = randomUUID();
  await adjustOrbes(context.db, userOpenId, -(amount * maxClaims));
  await context.db.insert(asternalOrbGifts).values({
    id,
    chatId: context.chat.id,
    createdByOpenId: userOpenId,
    title,
    amountPerPerson: amount,
    maxClaims,
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
  });
  const message = await sendChatMessageForUser(userOpenId, context.chat.id, { content: title, kind: "gift", giftId: id });
  return { ok: true, giftId: id, message };
}

export async function getOrbGiftForUser(userOpenId: string, rawGiftId: unknown): Promise<OrbGiftDto | null> {
  const giftId = cleanId(rawGiftId, "El regalo");
  const db = await database();
  const gift = (await db.select().from(asternalOrbGifts).where(eq(asternalOrbGifts.id, giftId)).limit(1))[0];
  if (!gift) return null;
  await findMemberChat(userOpenId, gift.chatId);
  return giftDto(db, gift, userOpenId);
}

export async function claimOrbGiftForUser(userOpenId: string, rawGiftId: unknown) {
  const giftId = cleanId(rawGiftId, "El regalo");
  const db = await database();
  const gift = (await db.select().from(asternalOrbGifts).where(eq(asternalOrbGifts.id, giftId)).limit(1))[0];
  if (!gift) throw new Error("El regalo no existe.");
  await findMemberChat(userOpenId, gift.chatId);
  if (gift.createdByOpenId === userOpenId) throw new Error("No puedes abrir tu propio regalo.");
  if (gift.status !== "open" || (gift.expiresAt && gift.expiresAt <= new Date())) throw new Error("Este regalo ya no está disponible.");
  const alreadyClaimed = (await db.select().from(asternalOrbGiftClaims).where(and(eq(asternalOrbGiftClaims.giftId, gift.id), eq(asternalOrbGiftClaims.userOpenId, userOpenId))).limit(1))[0];
  if (alreadyClaimed) throw new Error("Ya abriste este regalo.");
  if (gift.claims >= gift.maxClaims) throw new Error("El regalo ya fue reclamado por completo.");
  await db.insert(asternalOrbGiftClaims).values({ giftId: gift.id, userOpenId });
  const claims = gift.claims + 1;
  const closed = claims >= gift.maxClaims;
  await db.update(asternalOrbGifts).set({ claims, status: closed ? "closed" : "open", closedAt: closed ? new Date() : null }).where(eq(asternalOrbGifts.id, gift.id));
  const balance = await adjustOrbes(db, userOpenId, gift.amountPerPerson);
  return { ok: true, amount: gift.amountPerPerson, claims, closed, balance };
}

export async function expireOrbGiftsForUser(userOpenId: string) {
  if (userOpenId !== ENV.ownerOpenId) throw new Error("Solo la administración puede cerrar regalos vencidos.");
  const db = await database();
  const expired = await db.select().from(asternalOrbGifts).where(and(eq(asternalOrbGifts.status, "open"), lt(asternalOrbGifts.expiresAt, new Date())));
  for (const gift of expired) {
    await db.update(asternalOrbGifts).set({ status: "expired", closedAt: new Date() }).where(eq(asternalOrbGifts.id, gift.id));
    const remaining = Math.max(0, gift.maxClaims - gift.claims);
    if (remaining) await adjustOrbes(db, gift.createdByOpenId, remaining * gift.amountPerPerson);
  }
  return expired.length;
}
