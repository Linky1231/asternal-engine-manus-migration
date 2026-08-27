import express from "express";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { completeOrionChat } from "../orion";
import { authenticateCommunityRequest, rankCommunityFeed, reviewCommunityPost, reviewCommunitySubmission } from "../community-ai";
import { applySourceProposal, createManualSourceProposal, createSourceProposal, ensureSourceVersion, getSourceFile, listSourceProposals } from "../source-versions";
import { sdk } from "./sdk";
import { registerOAuthRoutes } from "./oauth";
import { COOKIE_NAME } from "../../shared/const";
import { getSessionCookieOptions } from "./cookies";
import { createManusRecord, deleteOwnManusRecord, getOwnManusRecord, listOwnManusRecords, listPublicManusRecords, updateOwnManusRecord } from "../manus-records";

const dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json({ limit: "1mb" }));
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
    await deleteOwnManusRecord(user.openId, req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(401).json({ error: error instanceof Error ? error.message : "No se pudo eliminar el proyecto de Manus." });
  }
});

const MANUS_COLLECTIONS = new Set([
  "profiles", "posts", "comments", "reactions", "reposts", "follows", "notifications", "reports", "blocks",
  "tags", "post_tags", "post_polls", "post_poll_votes", "game_purchases", "game_plays", "orbe_transactions",
  "forum_categories", "forum_threads", "forum_posts", "forum_thread_votes", "forum_votes", "chats", "chat_members",
  "chat_messages", "stickers", "events", "event_submissions", "event_participants", "trust_points_history",
]);
const PUBLIC_MANUS_COLLECTIONS = new Set(["profiles", "posts", "comments", "tags", "forum_categories", "forum_threads", "forum_posts", "stickers", "events"]);

function recordCollection(value: unknown): string | null {
  return typeof value === "string" && MANUS_COLLECTIONS.has(value) ? value : null;
}

function normalizeRecordPayload(id: string, data: Record<string, unknown>) {
  return { ...data, id };
}

app.get("/api/manus/records/:collection", async (req, res) => {
  try {
    const collection = recordCollection(req.params.collection);
    if (!collection) return res.status(404).json({ error: "Colección no disponible." });
    const user = await sdk.authenticateRequest(req);
    const own = await listOwnManusRecords(user.openId, collection);
    const publicRows = PUBLIC_MANUS_COLLECTIONS.has(collection) ? await listPublicManusRecords(collection) : [];
    const rows = new Map<string, ReturnType<typeof normalizeRecordPayload>>();
    for (const record of [...publicRows, ...own]) rows.set(record.id, normalizeRecordPayload(record.id, record.data));
    res.json([...rows.values()]);
  } catch (error) {
    res.status(401).json({ error: error instanceof Error ? error.message : "No se pudo leer los registros de Manus." });
  }
});

app.post("/api/manus/records/:collection", async (req, res) => {
  try {
    const collection = recordCollection(req.params.collection);
    if (!collection) return res.status(404).json({ error: "Colección no disponible." });
    const user = await sdk.authenticateRequest(req);
    const supplied = req.body?.data;
    if (!supplied || typeof supplied !== "object" || Array.isArray(supplied)) return res.status(400).json({ error: "El registro debe ser un objeto." });
    const id = typeof req.body?.id === "string" && req.body.id.length <= 64 ? req.body.id : crypto.randomUUID();
    const visibility = PUBLIC_MANUS_COLLECTIONS.has(collection) ? "public" as const : "private" as const;
    const data = { ...(supplied as Record<string, unknown>) };
    delete data.id;
    const updated = typeof req.body?.id === "string" ? await updateOwnManusRecord({ id, ownerOpenId: user.openId, data, visibility }) : null;
    const record = updated ?? await createManusRecord({ id, collection, ownerOpenId: user.openId, data, visibility });
    res.json(normalizeRecordPayload(record.id, record.data));
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "No se pudo guardar el registro de Manus." });
  }
});

app.delete("/api/manus/records/:collection/:id", async (req, res) => {
  try {
    const collection = recordCollection(req.params.collection);
    if (!collection) return res.status(404).json({ error: "Colección no disponible." });
    const user = await sdk.authenticateRequest(req);
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
    const user = await authenticateCommunityRequest(req.header("authorization"));
    res.json(await ensureSourceVersion(user.id, req.body?.projectId));
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo crear la versión privada.";
    res.status(400).json({ error: message });
  }
});

app.get("/api/orion/source-file", async (req, res) => {
  try {
    const user = await authenticateCommunityRequest(req.header("authorization"));
    res.json(await getSourceFile(user.id, req.query.projectId, req.query.versionId, req.query.path));
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo leer el archivo privado.";
    res.status(400).json({ error: message });
  }
});

app.post("/api/orion/source-proposal", async (req, res) => {
  try {
    const user = await authenticateCommunityRequest(req.header("authorization"));
    res.json(await createSourceProposal(user.id, req.body ?? {}));
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo preparar el cambio interno.";
    res.status(400).json({ error: message });
  }
});

app.post("/api/orion/source-apply", async (req, res) => {
  try {
    const user = await authenticateCommunityRequest(req.header("authorization"));
    res.json(await applySourceProposal(user.id, req.body ?? {}));
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo crear la versión candidata.";
    res.status(400).json({ error: message });
  }
});

app.post("/api/orion/source-edit", async (req, res) => {
  try {
    const user = await authenticateCommunityRequest(req.header("authorization"));
    res.json(await createManualSourceProposal(user.id, req.body ?? {}));
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo guardar la edición manual.";
    res.status(400).json({ error: message });
  }
});

app.get("/api/orion/source-proposals", async (req, res) => {
  try {
    const user = await authenticateCommunityRequest(req.header("authorization"));
    res.json(await listSourceProposals(user.id, req.query.projectId));
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudieron consultar los cambios internos.";
    res.status(400).json({ error: message });
  }
});

app.post("/api/orion/review-post", async (req, res) => {
  try {
    await authenticateCommunityRequest(req.header("authorization"));
    res.json(await reviewCommunityPost(req.body));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Orión no pudo revisar la publicación.";
    res.status(400).json({ error: message });
  }
});

app.post("/api/orion/review-submission", async (req, res) => {
  try {
    await authenticateCommunityRequest(req.header("authorization"));
    res.json(await reviewCommunitySubmission(req.body));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Orión no pudo revisar este contenido.";
    res.status(400).json({ error: message });
  }
});

app.post("/api/orion/rank-feed", async (req, res) => {
  try {
    await authenticateCommunityRequest(req.header("authorization"));
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
