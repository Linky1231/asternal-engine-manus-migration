import express from "express";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { completeOrionChat } from "../orion";
import { authenticateCommunityRequest, rankCommunityFeed, reviewCommunityPost, reviewCommunitySubmission } from "../community-ai";
import { sdk } from "./sdk";
import { registerOAuthRoutes } from "./oauth";
import { createSupabaseUser, listSupabaseUsers, signInSupabaseUser, updateSupabaseUser, upsertSupabaseProfile } from "./supabase-admin-fetch";
import { ENV } from "./env";
import { publishGlobalTexture, readGlobalTextureManifest } from "../global-textures";

const dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json({ limit: "1mb" }));
registerOAuthRoutes(app);

app.post("/api/orion/chat", async (req, res) => {
  try {
    const result = await completeOrionChat(req.body?.history, req.body?.options);
    res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo consultar a Orión.";
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

app.post("/api/supabase/link-manus", async (req, res) => {
  try {
    const manusUser = await sdk.authenticateRequest(req);
    const username = String(req.body?.username || manusUser.name || `user_${manusUser.openId.slice(-8)}`)
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, "_")
      .slice(0, 32) || `user_${manusUser.openId.slice(-8)}`;
    const openId = manusUser.openId;
    const linkEmail = manusUser.email?.trim().toLowerCase() || `${crypto.createHash("sha256").update(openId).digest("hex").slice(0, 24)}@manus-link.invalid`;
    const password = crypto.randomBytes(32).toString("base64url");
    const users = await listSupabaseUsers();
    const existing = users.find(user => user.user_metadata?.manus_open_id === openId || user.email?.toLowerCase() === linkEmail);
    const metadata = { ...(existing?.user_metadata ?? {}), manus_open_id: openId, manus_username: username, source: "manus-multimodal" };
    const supabaseUser = existing
      ? await updateSupabaseUser(existing.id, { password, metadata })
      : await createSupabaseUser({ email: linkEmail, password, metadata });
    await upsertSupabaseProfile({ id: supabaseUser.id, username, displayName: manusUser.name || username });
    const sessionData = await signInSupabaseUser(linkEmail, password);
    res.json({ ok: true, username, session: sessionData });
  } catch (error) {
    console.error("[Supabase] Manus multimodal link failed", error);
    res.status(401).json({ error: error instanceof Error ? error.message : "No se pudo vincular la cuenta." });
  }
});

app.get("/api/textures/catalog", async (_req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.json(await readGlobalTextureManifest());
});

app.post("/api/textures/publish", express.raw({ type: ["image/png", "image/jpeg", "image/webp"], limit: "5mb" }), async (req, res) => {
  try {
    const manusUser = await sdk.authenticateRequest(req);
    if (!ENV.ownerOpenId || manusUser.openId !== ENV.ownerOpenId) return res.status(403).json({ error: "Solo el responsable de Asternal puede publicar texturas globales." });
    const bytes = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body ?? []);
    const mimeType = String(req.header("content-type") ?? "").split(";", 1)[0];
    const manifest = await publishGlobalTexture({ bytes, mimeType, name: String(req.header("x-texture-name") ?? "texture") });
    res.json(manifest);
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "No se pudo publicar la textura." });
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
