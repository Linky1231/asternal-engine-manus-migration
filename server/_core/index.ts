import express from "express";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { completeOrionChat } from "../orion";
import { rankCommunityFeed, reviewCommunityPost, reviewCommunitySubmission } from "../community-ai";
import { applySourceProposal, createManualSourceProposal, createSourceProposal, ensureSourceVersion, getSourceFile, listSourceProposals } from "../source-versions";
import { sdk } from "./sdk";
import { registerOAuthRoutes } from "./oauth";
import { COOKIE_NAME } from "../../shared/const";
import { getSessionCookieOptions } from "./cookies";
import { createManusRecord, deleteOwnManusRecord, getOwnManusRecord, listOwnManusRecords, listPublicManusRecords, updateOwnManusRecord } from "../manus-records";
import { getManusCollection, isPublicManusCollection, normalizeManusRecordPayload } from "../manus-collections";
import { storagePut } from "../storage";
import { addGroupMemberForUser, claimOrbGiftForUser, closeChatPollForUser, createAnnouncementForUser, createChatPollForUser, createGroupChatForUser, createOrbGiftForUser, deleteGroupChatForUser, expireOrbGiftsForUser, getChatPollForUser, getChatReadAtForUser, getCommunityChatForUser, getOrCreateDmForUser, getOrbGiftForUser, leaveGroupChatForUser, listChatMessagesForUser, listDmChatsForUser, listGroupChatsForUser, listGroupMembersForUser, listMutualFollowProfilesForUser, markChatReadForUser, removeGroupMemberForUser, sendChatMessageForUser, setGroupRoleForUser, updateGroupChatForUser, voteChatPollForUser } from "../manus-chat";
import { claimPlusOrbesForUser, donateOrbsForUser, purchasePostForUser, resellArtworkForUser } from "../manus-marketplace";
import { isAdminForUser, isModeratorForUser, listManagedUsersForAdmin, setModeratorForAdmin, setVerifiedForAdmin } from "../manus-admin";
import { createEventForUser, deleteEventForUser, joinEventForUser, leaveEventForUser, listEventParticipantsForUser, listEventsForUser, submitToEventForUser, updateEventStatusForUser } from "../manus-events";
import { incrementForumThreadView, touchForumThreadForUser, voteForumPostForUser, voteForumThreadForUser } from "../manus-forum";

const dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json({ limit: "7mb" }));
registerOAuthRoutes(app);

app.get("/api/manus/session", async (req, res) => {
  try {
    const user = await sdk.authenticateRequest(req);
    if (!user) return res.status(401).json({ error: "No hay una sesión de Manus activa." });
    const existingProfile = await getOwnManusRecord(user.openId, user.openId);
    if (!existingProfile) {
      const username = (user.name || `user_${user.openId.slice(-8)}`).trim().toLowerCase().replace(/[^a-z0-9_]/g, "_").slice(0, 32) || `user_${user.openId.slice(-8)}`;
      await createManusRecord({
        id: user.openId,
        collection: "profiles",
        ownerOpenId: user.openId,
        visibility: "public",
        data: { username, display_name: user.name || username, avatar_url: null, bio: null, orbes: 0, show_orbes: true, interests: [] },
      });
    }
    return res.json({ user: { id: user.openId, name: user.name, email: user.email, role: user.role } });
  } catch {
    return res.status(401).json({ error: "No se pudo verificar la sesión de Manus." });
  }
});

app.post("/api/manus/logout", (req, res) => {
  res.clearCookie(COOKIE_NAME, { ...getSessionCookieOptions(req), maxAge: -1 });
  res.json({ success: true });
});

function decodeAssetData(value: unknown): { bytes: Buffer; mimeType: string } {
  if (typeof value !== "string") throw new Error("El recurso debe incluir datos codificados.");
  const match = value.match(/^data:([a-z][a-z0-9!#$&^_.+-]*\/[a-z0-9!#$&^_.+-]+);base64,([a-z0-9+/=]+)$/i);
  if (!match) throw new Error("El formato del recurso no es válido.");
  const bytes = Buffer.from(match[2], "base64");
  if (!bytes.length || bytes.length > 5 * 1024 * 1024) throw new Error("El recurso debe pesar entre 1 byte y 5 MB.");
  return { bytes, mimeType: match[1].toLowerCase() };
}

function safeAssetName(value: unknown) {
  const name = typeof value === "string" ? value : "recurso";
  return name.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 100) || "recurso";
}

app.post("/api/manus/assets", async (req, res) => {
  try {
    const user = await sdk.authenticateRequest(req);
    const { bytes, mimeType } = decodeAssetData(req.body?.data);
    const filename = safeAssetName(req.body?.name);
    const stored = await storagePut(`asternal-assets/${user.openId}/${crypto.randomUUID()}-${filename}`, bytes, mimeType);
    res.status(201).json({ key: stored.key, url: stored.url, mimeType, size: bytes.length });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "No se pudo cargar el recurso en Manus." });
  }
});

app.post("/api/manus/notifications", async (req, res) => {
  try {
    const actor = await sdk.authenticateRequest(req);
    const targetOpenId = typeof req.body?.userId === "string" ? req.body.userId.trim() : "";
    const type = typeof req.body?.type === "string" ? req.body.type : "";
    const allowedTypes = new Set(["comment", "reply", "reaction", "repost", "mention", "follow", "like", "favorite", "game"]);
    if (!targetOpenId || targetOpenId.length > 128 || !allowedTypes.has(type) || targetOpenId === actor.openId) {
      return res.status(204).end();
    }
    const profiles = await listPublicManusRecords("profiles");
    if (!profiles.some(profile => profile.ownerOpenId === targetOpenId)) return res.status(204).end();
    const maybeId = (value: unknown) => typeof value === "string" && /^[a-zA-Z0-9_-]{1,64}$/.test(value) ? value : null;
    await createManusRecord({
      id: crypto.randomUUID(),
      collection: "notifications",
      ownerOpenId: targetOpenId,
      visibility: "private",
      data: {
        user_id: targetOpenId,
        actor_id: actor.openId,
        type,
        post_id: maybeId(req.body?.postId),
        comment_id: maybeId(req.body?.commentId),
        read: false,
      },
    });
    res.status(201).json({ ok: true });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "No se pudo crear la notificación." });
  }
});

app.post("/api/manus/game-plays", async (req, res) => {
  try {
    const user = await sdk.authenticateRequest(req);
    const postId = typeof req.body?.postId === "string" && /^[a-zA-Z0-9_-]{1,64}$/.test(req.body.postId) ? req.body.postId : null;
    if (!postId) return res.status(400).json({ error: "El juego no es válido." });
    await createManusRecord({
      id: crypto.randomUUID(),
      collection: "game_plays",
      ownerOpenId: user.openId,
      visibility: "public",
      data: { post_id: postId, user_id: user.openId },
    });
    res.status(201).json({ success: true });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "No se pudo registrar la jugada." });
  }
});

app.get("/api/manus/game-plays", async (req, res) => {
  try {
    const rawIds = typeof req.query.postIds === "string" ? req.query.postIds.split(",") : [];
    const postIds = new Set(rawIds.filter(id => /^[a-zA-Z0-9_-]{1,64}$/.test(id)).slice(0, 100));
    const counts: Record<string, number> = {};
    if (!postIds.size) return res.json({ counts, cloud: true });
    const since = Date.now() - 24 * 60 * 60 * 1000;
    const plays = await listPublicManusRecords("game_plays");
    for (const play of plays) {
      const postId = typeof play.data.post_id === "string" ? play.data.post_id : null;
      if (postId && postIds.has(postId) && play.createdAt.getTime() >= since) counts[postId] = (counts[postId] ?? 0) + 1;
    }
    res.json({ counts, cloud: true });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "No se pudo calcular el ranking." });
  }
});

app.post("/api/manus/marketplace/purchase", async (req, res) => {
  try {
    const user = await sdk.authenticateRequest(req);
    const kind = req.body?.kind === "game" || req.body?.kind === "artwork" ? req.body.kind : null;
    if (!kind) return res.status(400).json({ error: "El tipo de compra no es válido." });
    res.json(await purchasePostForUser(user.openId, { postId: req.body?.postId, kind }));
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "No se pudo completar la compra." });
  }
});

app.post("/api/manus/marketplace/donations", async (req, res) => {
  try {
    const user = await sdk.authenticateRequest(req);
    res.json(await donateOrbsForUser(user.openId, { postId: req.body?.postId, amount: req.body?.amount }));
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "No se pudo completar la donación." });
  }
});

app.post("/api/manus/marketplace/plus-claim", async (req, res) => {
  try {
    const user = await sdk.authenticateRequest(req);
    res.json(await claimPlusOrbesForUser(user.openId));
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "No se pudo reclamar la recompensa Plus." });
  }
});

app.post("/api/manus/marketplace/artwork-resale", async (req, res) => {
  try {
    const user = await sdk.authenticateRequest(req);
    res.json(await resellArtworkForUser(user.openId, { postId: req.body?.postId, price: req.body?.price }));
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "No se pudo actualizar la reventa de la obra." });
  }
});

app.get("/api/manus/community/settings", async (_req, res) => {
  try {
    const settings = await listPublicManusRecords("community_settings");
    const record = settings.find(item => item.id === "community_about_settings");
    res.json(record ? normalizeRecordPayload(record.id, record.data) : null);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "No se pudieron leer los ajustes comunitarios." });
  }
});

app.put("/api/manus/community/settings", async (req, res) => {
  try {
    const user = await sdk.authenticateRequest(req);
    if (!(await isAdminForUser(user.openId))) return res.status(403).json({ error: "Solo la administración puede actualizar estos ajustes." });
    const content = typeof req.body?.content === "string" ? req.body.content : "";
    if (!content || content.length > 100_000) return res.status(400).json({ error: "El contenido de ajustes no es válido." });
    const id = "community_about_settings";
    const data = { content, category: "system", post_type: "about_settings", created_by: user.openId };
    const record = await updateOwnManusRecord({ id, ownerOpenId: user.openId, data, visibility: "public" })
      ?? await createManusRecord({ id, collection: "community_settings", ownerOpenId: user.openId, visibility: "public", data });
    res.json(normalizeRecordPayload(record.id, record.data));
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "No se pudieron guardar los ajustes comunitarios." });
  }
});

app.post("/api/manus/forum/threads/:threadId/vote", async (req, res) => {
  try {
    const user = await sdk.authenticateRequest(req);
    res.json(await voteForumThreadForUser(user.openId, req.params.threadId, req.body?.vote));
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "No se pudo registrar el voto del hilo." });
  }
});

app.post("/api/manus/forum/posts/:postId/vote", async (req, res) => {
  try {
    const user = await sdk.authenticateRequest(req);
    res.json(await voteForumPostForUser(user.openId, req.params.postId, req.body?.vote));
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "No se pudo registrar el voto de la respuesta." });
  }
});

app.post("/api/manus/forum/threads/:threadId/views", async (req, res) => {
  try {
    await sdk.authenticateRequest(req);
    res.json(await incrementForumThreadView(req.params.threadId));
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "No se pudo registrar la visita." });
  }
});

app.post("/api/manus/forum/threads/:threadId/touch", async (req, res) => {
  try {
    const user = await sdk.authenticateRequest(req);
    res.json(await touchForumThreadForUser(user.openId, req.params.threadId, req.body?.change));
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "No se pudo actualizar la actividad del hilo." });
  }
});

app.get("/api/manus/admin/status", async (req, res) => {
  try {
    const user = await sdk.authenticateRequest(req);
    res.json({ is_admin: await isAdminForUser(user.openId), is_moderator: await isModeratorForUser(user.openId) });
  } catch (error) {
    res.status(401).json({ error: error instanceof Error ? error.message : "No se pudo verificar la sesión." });
  }
});

app.get("/api/manus/admin/users", async (req, res) => {
  try {
    const user = await sdk.authenticateRequest(req);
    res.json(await listManagedUsersForAdmin(user.openId, req.query.search));
  } catch (error) {
    res.status(403).json({ error: error instanceof Error ? error.message : "No se pudo consultar la administración." });
  }
});

app.put("/api/manus/admin/users/:userId/moderator", async (req, res) => {
  try {
    const user = await sdk.authenticateRequest(req);
    res.json(await setModeratorForAdmin(user.openId, req.params.userId, req.body?.enabled));
  } catch (error) {
    res.status(403).json({ error: error instanceof Error ? error.message : "No se pudo actualizar la moderación." });
  }
});

app.put("/api/manus/admin/users/:userId/verified", async (req, res) => {
  try {
    const user = await sdk.authenticateRequest(req);
    res.json(await setVerifiedForAdmin(user.openId, req.params.userId, req.body?.enabled));
  } catch (error) {
    res.status(403).json({ error: error instanceof Error ? error.message : "No se pudo actualizar la verificación." });
  }
});

app.get("/api/manus/events", async (req, res) => {
  try {
    let openId: string | null = null;
    try { openId = (await sdk.authenticateRequest(req)).openId; } catch { /* La agenda es pública. */ }
    res.json(await listEventsForUser(openId));
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "No se pudieron consultar los eventos." });
  }
});

app.post("/api/manus/events", async (req, res) => {
  try {
    const user = await sdk.authenticateRequest(req);
    res.status(201).json(await createEventForUser(user.openId, req.body ?? {}));
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "No se pudo crear el evento." });
  }
});

app.patch("/api/manus/events/:eventId/status", async (req, res) => {
  try {
    const user = await sdk.authenticateRequest(req);
    res.json(await updateEventStatusForUser(user.openId, req.params.eventId, req.body?.status));
  } catch (error) {
    res.status(403).json({ error: error instanceof Error ? error.message : "No se pudo actualizar el evento." });
  }
});

app.delete("/api/manus/events/:eventId", async (req, res) => {
  try {
    const user = await sdk.authenticateRequest(req);
    res.json(await deleteEventForUser(user.openId, req.params.eventId));
  } catch (error) {
    res.status(403).json({ error: error instanceof Error ? error.message : "No se pudo eliminar el evento." });
  }
});

app.post("/api/manus/events/:eventId/submissions", async (req, res) => {
  try {
    const user = await sdk.authenticateRequest(req);
    res.status(201).json(await submitToEventForUser(user.openId, req.params.eventId, req.body?.postId));
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "No se pudo enviar el juego." });
  }
});

app.post("/api/manus/events/:eventId/participants", async (req, res) => {
  try {
    const user = await sdk.authenticateRequest(req);
    res.json(await joinEventForUser(user.openId, req.params.eventId));
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "No se pudo registrar la participación." });
  }
});

app.delete("/api/manus/events/:eventId/participants/me", async (req, res) => {
  try {
    const user = await sdk.authenticateRequest(req);
    res.json(await leaveEventForUser(user.openId, req.params.eventId));
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "No se pudo cancelar la participación." });
  }
});

app.get("/api/manus/events/:eventId/participants", async (req, res) => {
  try {
    const user = await sdk.authenticateRequest(req);
    res.json(await listEventParticipantsForUser(user.openId, req.params.eventId));
  } catch (error) {
    res.status(403).json({ error: error instanceof Error ? error.message : "No se pudieron consultar los participantes." });
  }
});

app.get("/api/manus/chats/community", async (req, res) => {
  try {
    const user = await sdk.authenticateRequest(req);
    res.json(await getCommunityChatForUser(user.openId));
  } catch (error) {
    res.status(401).json({ error: error instanceof Error ? error.message : "No se pudo abrir el chat de Manus." });
  }
});

app.get("/api/manus/chats/:chatId/messages", async (req, res) => {
  try {
    const user = await sdk.authenticateRequest(req);
    res.json(await listChatMessagesForUser(user.openId, req.params.chatId, {
      before: typeof req.query.before === "string" ? { created_at: req.query.before } : undefined,
      limit: typeof req.query.limit === "string" ? Number(req.query.limit) : undefined,
    }));
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "No se pudieron leer los mensajes." });
  }
});

app.post("/api/manus/chats/:chatId/messages", async (req, res) => {
  try {
    const user = await sdk.authenticateRequest(req);
    res.status(201).json(await sendChatMessageForUser(user.openId, req.params.chatId, req.body ?? {}));
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "No se pudo enviar el mensaje." });
  }
});

app.post("/api/manus/chats/:chatId/read", async (req, res) => {
  try {
    const user = await sdk.authenticateRequest(req);
    res.json(await markChatReadForUser(user.openId, req.params.chatId));
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "No se pudo actualizar la lectura." });
  }
});

app.get("/api/manus/chats/:chatId/read", async (req, res) => {
  try {
    const user = await sdk.authenticateRequest(req);
    res.json(await getChatReadAtForUser(user.openId, req.params.chatId));
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "No se pudo consultar la lectura." });
  }
});

app.post("/api/manus/chats/:chatId/polls", async (req, res) => {
  try {
    const user = await sdk.authenticateRequest(req);
    res.status(201).json(await createChatPollForUser(user.openId, req.params.chatId, req.body ?? {}));
  } catch (error) {
    res.status(400).json({ ok: false, error: error instanceof Error ? error.message : "No se pudo crear la encuesta." });
  }
});

app.get("/api/manus/chat-polls/:pollId", async (req, res) => {
  try {
    const user = await sdk.authenticateRequest(req);
    const poll = await getChatPollForUser(user.openId, req.params.pollId);
    if (!poll) return res.status(404).json({ error: "La encuesta no existe." });
    res.json(poll);
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "No se pudo leer la encuesta." });
  }
});

app.post("/api/manus/chat-polls/:pollId/vote", async (req, res) => {
  try {
    const user = await sdk.authenticateRequest(req);
    res.json(await voteChatPollForUser(user.openId, req.params.pollId, req.body?.optionIndex));
  } catch (error) {
    res.status(400).json({ ok: false, error: error instanceof Error ? error.message : "No se pudo registrar el voto." });
  }
});

app.post("/api/manus/chat-polls/:pollId/close", async (req, res) => {
  try {
    const user = await sdk.authenticateRequest(req);
    res.json(await closeChatPollForUser(user.openId, req.params.pollId));
  } catch (error) {
    res.status(400).json({ ok: false, error: error instanceof Error ? error.message : "No se pudo cerrar la encuesta." });
  }
});

app.post("/api/manus/chats/:chatId/announcements", async (req, res) => {
  try {
    const user = await sdk.authenticateRequest(req);
    res.status(201).json(await createAnnouncementForUser(user.openId, req.params.chatId, req.body?.content));
  } catch (error) {
    res.status(400).json({ ok: false, error: error instanceof Error ? error.message : "No se pudo publicar el aviso." });
  }
});

app.post("/api/manus/chats/:chatId/orb-gifts", async (req, res) => {
  try {
    const user = await sdk.authenticateRequest(req);
    res.status(201).json(await createOrbGiftForUser(user.openId, req.params.chatId, req.body ?? {}));
  } catch (error) {
    res.status(400).json({ ok: false, error: error instanceof Error ? error.message : "No se pudo crear el regalo." });
  }
});

app.get("/api/manus/orb-gifts/:giftId", async (req, res) => {
  try {
    const user = await sdk.authenticateRequest(req);
    const gift = await getOrbGiftForUser(user.openId, req.params.giftId);
    if (!gift) return res.status(404).json({ error: "El regalo no existe." });
    res.json(gift);
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "No se pudo leer el regalo." });
  }
});

app.post("/api/manus/orb-gifts/:giftId/claim", async (req, res) => {
  try {
    const user = await sdk.authenticateRequest(req);
    res.json(await claimOrbGiftForUser(user.openId, req.params.giftId));
  } catch (error) {
    res.status(400).json({ ok: false, error: error instanceof Error ? error.message : "No se pudo abrir el regalo." });
  }
});

app.post("/api/manus/orb-gifts/expire", async (req, res) => {
  try {
    const user = await sdk.authenticateRequest(req);
    res.json({ expired: await expireOrbGiftsForUser(user.openId) });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "No se pudieron cerrar los regalos vencidos." });
  }
});

app.post("/api/manus/chats/dm", async (req, res) => {
  try {
    const user = await sdk.authenticateRequest(req);
    res.json(await getOrCreateDmForUser(user.openId, req.body?.otherId));
  } catch (error) {
    res.status(400).json({ ok: false, error: error instanceof Error ? error.message : "No se pudo abrir el chat directo." });
  }
});

app.get("/api/manus/chats/dm", async (req, res) => {
  try {
    const user = await sdk.authenticateRequest(req);
    res.json(await listDmChatsForUser(user.openId));
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "No se pudieron leer los chats directos." });
  }
});

app.get("/api/manus/chats/mutual-follows", async (req, res) => {
  try {
    const user = await sdk.authenticateRequest(req);
    res.json(await listMutualFollowProfilesForUser(user.openId));
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "No se pudieron consultar los seguimientos mutuos." });
  }
});

app.get("/api/manus/chats/groups", async (req, res) => {
  try {
    const user = await sdk.authenticateRequest(req);
    res.json(await listGroupChatsForUser(user.openId));
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "No se pudieron leer los grupos." });
  }
});

app.post("/api/manus/chats/groups", async (req, res) => {
  try {
    const user = await sdk.authenticateRequest(req);
    res.status(201).json(await createGroupChatForUser(user.openId, req.body ?? {}));
  } catch (error) {
    res.status(400).json({ ok: false, error: error instanceof Error ? error.message : "No se pudo crear el grupo." });
  }
});

app.get("/api/manus/chats/:chatId/members", async (req, res) => {
  try {
    const user = await sdk.authenticateRequest(req);
    res.json(await listGroupMembersForUser(user.openId, req.params.chatId));
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "No se pudieron leer los miembros." });
  }
});

app.patch("/api/manus/chats/:chatId/group", async (req, res) => {
  try {
    const user = await sdk.authenticateRequest(req);
    res.json(await updateGroupChatForUser(user.openId, req.params.chatId, req.body ?? {}));
  } catch (error) {
    res.status(400).json({ ok: false, error: error instanceof Error ? error.message : "No se pudo actualizar el grupo." });
  }
});

app.post("/api/manus/chats/:chatId/members", async (req, res) => {
  try {
    const user = await sdk.authenticateRequest(req);
    res.json(await addGroupMemberForUser(user.openId, req.params.chatId, req.body?.userId));
  } catch (error) {
    res.status(400).json({ ok: false, error: error instanceof Error ? error.message : "No se pudo añadir el miembro." });
  }
});

app.patch("/api/manus/chats/:chatId/members/:userId", async (req, res) => {
  try {
    const user = await sdk.authenticateRequest(req);
    res.json(await setGroupRoleForUser(user.openId, req.params.chatId, req.params.userId, req.body?.role));
  } catch (error) {
    res.status(400).json({ ok: false, error: error instanceof Error ? error.message : "No se pudo actualizar el rol." });
  }
});

app.delete("/api/manus/chats/:chatId/members/:userId", async (req, res) => {
  try {
    const user = await sdk.authenticateRequest(req);
    res.json(await removeGroupMemberForUser(user.openId, req.params.chatId, req.params.userId));
  } catch (error) {
    res.status(400).json({ ok: false, error: error instanceof Error ? error.message : "No se pudo retirar el miembro." });
  }
});

app.post("/api/manus/chats/:chatId/leave", async (req, res) => {
  try {
    const user = await sdk.authenticateRequest(req);
    res.json(await leaveGroupChatForUser(user.openId, req.params.chatId));
  } catch (error) {
    res.status(400).json({ ok: false, error: error instanceof Error ? error.message : "No se pudo salir del grupo." });
  }
});

app.delete("/api/manus/chats/:chatId/group", async (req, res) => {
  try {
    const user = await sdk.authenticateRequest(req);
    res.json(await deleteGroupChatForUser(user.openId, req.params.chatId));
  } catch (error) {
    res.status(400).json({ ok: false, error: error instanceof Error ? error.message : "No se pudo eliminar el grupo." });
  }
});

app.get("/api/manus/projects", async (req, res) => {
  try {
    const user = await sdk.authenticateRequest(req);
    const records = await listOwnManusRecords(user.openId, "project");
    res.json(records.map(record => ({
      id: record.id,
      name: typeof record.data.name === "string" ? record.data.name : "Untitled Game",
      data: record.data.data ?? {},
      updated_at: record.updatedAt,
    })));
  } catch (error) {
    res.status(401).json({ error: error instanceof Error ? error.message : "No se pudo leer los proyectos de Manus." });
  }
});

app.post("/api/manus/projects", async (req, res) => {
  try {
    const user = await sdk.authenticateRequest(req);
    const id = typeof req.body?.id === "string" ? req.body.id : crypto.randomUUID();
    const name = typeof req.body?.name === "string" ? req.body.name.slice(0, 160) : "Untitled Game";
    const data = req.body?.data && typeof req.body.data === "object" && !Array.isArray(req.body.data) ? req.body.data : {};
    const existing = typeof req.body?.id === "string" ? await updateOwnManusRecord({ id, ownerOpenId: user.openId, data: { name, data } }) : null;
    const record = existing ?? await createManusRecord({ id, ownerOpenId: user.openId, collection: "project", data: { name, data } });
    if (!record) return res.status(404).json({ error: "El proyecto no pertenece a esta cuenta." });
    res.json({ id: record.id, name, data, updated_at: record.updatedAt });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "No se pudo guardar el proyecto de Manus." });
  }
});

app.delete("/api/manus/projects/:id", async (req, res) => {
  try {
    const user = await sdk.authenticateRequest(req);
    const project = await getOwnManusRecord(user.openId, req.params.id);
    if (!project || project.collection !== "project") return res.status(404).json({ error: "El proyecto no pertenece a esta cuenta." });
    await deleteOwnManusRecord(user.openId, req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(401).json({ error: error instanceof Error ? error.message : "No se pudo eliminar el proyecto de Manus." });
  }
});

function normalizeRecordPayload(id: string, data: Record<string, unknown>) {
  return { ...data, id };
}

app.get("/api/manus/records/:collection", async (req, res) => {
  try {
    const selected = getManusCollection(req.params.collection);
    if (!selected) return res.status(404).json({ error: "Colección no disponible." });
    let openId: string | null = null;
    try { openId = (await sdk.authenticateRequest(req)).openId; } catch { /* Las colecciones públicas admiten lectura anónima. */ }
    if (!openId && !isPublicManusCollection(selected.name)) return res.status(401).json({ error: "Inicia sesión para consultar esta colección." });
    const own = openId ? await listOwnManusRecords(openId, selected.name) : [];
    const publicRows = isPublicManusCollection(selected.name) ? await listPublicManusRecords(selected.name) : [];
    const rows = new Map<string, ReturnType<typeof normalizeRecordPayload>>();
    for (const record of [...publicRows, ...own]) rows.set(record.id, normalizeRecordPayload(record.id, record.data));
    res.json([...rows.values()]);
  } catch (error) {
    res.status(401).json({ error: error instanceof Error ? error.message : "No se pudo leer los registros de Manus." });
  }
});

app.post("/api/manus/records/:collection", async (req, res) => {
  try {
    const selected = getManusCollection(req.params.collection);
    if (!selected) return res.status(404).json({ error: "Colección no disponible." });
    const user = await sdk.authenticateRequest(req);
    const suppliedId = typeof req.body?.id === "string" ? req.body.id : undefined;
    const id = selected.config.idMustEqualOwner ? user.openId : suppliedId ?? crypto.randomUUID();
    const data = normalizeManusRecordPayload(selected.name, id, user.openId, req.body?.data);
    const visibility = selected.config.visibility;
    const updated = typeof req.body?.id === "string" ? await updateOwnManusRecord({ id, ownerOpenId: user.openId, data, visibility }) : null;
    const record = updated ?? await createManusRecord({ id, collection: selected.name, ownerOpenId: user.openId, data, visibility });
    if (!record) return res.status(404).json({ error: "El registro no pertenece a esta cuenta." });
    res.json(normalizeRecordPayload(record.id, record.data));
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "No se pudo guardar el registro de Manus." });
  }
});

app.delete("/api/manus/records/:collection/:id", async (req, res) => {
  try {
    const selected = getManusCollection(req.params.collection);
    if (!selected) return res.status(404).json({ error: "Colección no disponible." });
    const user = await sdk.authenticateRequest(req);
    const record = await getOwnManusRecord(user.openId, req.params.id);
    if (!record || record.collection !== selected.name) return res.status(404).json({ error: "El registro no pertenece a esta colección." });
    await deleteOwnManusRecord(user.openId, req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(401).json({ error: error instanceof Error ? error.message : "No se pudo eliminar el registro de Manus." });
  }
});

app.post("/api/orion/chat", async (req, res) => {
  try {
    const result = await completeOrionChat(req.body?.history, req.body?.options);
    res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo consultar a Orión.";
    res.status(400).json({ error: message });
  }
});

app.post("/api/orion/source-version", async (req, res) => {
  try {
    const user = await sdk.authenticateRequest(req);
    res.json(await ensureSourceVersion(user.openId, req.body?.projectId));
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo crear la versión privada.";
    res.status(400).json({ error: message });
  }
});

app.get("/api/orion/source-file", async (req, res) => {
  try {
    const user = await sdk.authenticateRequest(req);
    res.json(await getSourceFile(user.openId, req.query.projectId, req.query.versionId, req.query.path));
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo leer el archivo privado.";
    res.status(400).json({ error: message });
  }
});

app.post("/api/orion/source-proposal", async (req, res) => {
  try {
    const user = await sdk.authenticateRequest(req);
    res.json(await createSourceProposal(user.openId, req.body ?? {}));
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo preparar el cambio interno.";
    res.status(400).json({ error: message });
  }
});

app.post("/api/orion/source-apply", async (req, res) => {
  try {
    const user = await sdk.authenticateRequest(req);
    res.json(await applySourceProposal(user.openId, req.body ?? {}));
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo crear la versión candidata.";
    res.status(400).json({ error: message });
  }
});

app.post("/api/orion/source-edit", async (req, res) => {
  try {
    const user = await sdk.authenticateRequest(req);
    res.json(await createManualSourceProposal(user.openId, req.body ?? {}));
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo guardar la edición manual.";
    res.status(400).json({ error: message });
  }
});

app.get("/api/orion/source-proposals", async (req, res) => {
  try {
    const user = await sdk.authenticateRequest(req);
    res.json(await listSourceProposals(user.openId, req.query.projectId));
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudieron consultar los cambios internos.";
    res.status(400).json({ error: message });
  }
});

app.post("/api/orion/review-post", async (req, res) => {
  try {
    await sdk.authenticateRequest(req);
    res.json(await reviewCommunityPost(req.body));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Orión no pudo revisar la publicación.";
    res.status(400).json({ error: message });
  }
});

app.post("/api/orion/review-submission", async (req, res) => {
  try {
    await sdk.authenticateRequest(req);
    res.json(await reviewCommunitySubmission(req.body));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Orión no pudo revisar este contenido.";
    res.status(400).json({ error: message });
  }
});

app.post("/api/orion/rank-feed", async (req, res) => {
  try {
    await sdk.authenticateRequest(req);
    res.json(await rankCommunityFeed(req.body));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Orión no pudo ordenar el feed.";
    res.status(400).json({ error: message });
  }
});

app.get("/api/health", (_req, res) => res.json({ ok: true }));

app.use((error: unknown, _req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (error && typeof error === "object" && "type" in error && error.type === "entity.too.large") {
    return res.status(413).json({ error: "La publicación es demasiado grande para que Orión la revise. Reduce los adjuntos o el contenido e inténtalo de nuevo." });
  }
  return next(error);
});

// El bundle del servidor queda en `dist/index.js` y Vite genera el cliente en
// `dist/public`, que también es el directorio exigido por el publicador.
const publicDirectory = path.join(dirname, "public");
app.use(express.static(publicDirectory));
app.use((_req, res) => res.sendFile(path.join(publicDirectory, "index.html")));

const port = Number(process.env.PORT);
if (!Number.isFinite(port) || port <= 0) throw new Error("El entorno debe proporcionar un puerto para iniciar el servidor.");
app.listen(port, () => console.log(`Asternal disponible en el puerto ${port}`));
