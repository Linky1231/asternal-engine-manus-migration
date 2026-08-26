import express from "express";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { completeOrionChat } from "../orion";
import { authenticateCommunityRequest, rankCommunityFeed, reviewCommunityPost, reviewCommunitySubmission } from "../community-ai";
import { sdk } from "./sdk";
import { supabaseAdmin } from "../../src/integrations/supabase/client.server";

const dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json({ limit: "1mb" }));

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
    const { data: listed, error: listError } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (listError) throw listError;
    const existing = listed.users.find(user => user.user_metadata?.manus_open_id === openId || user.email?.toLowerCase() === linkEmail);
    const userResult = existing
      ? await supabaseAdmin.auth.admin.updateUserById(existing.id, { password, user_metadata: { ...existing.user_metadata, manus_open_id: openId, manus_username: username, source: "manus-multimodal" } })
      : await supabaseAdmin.auth.admin.createUser({ email: linkEmail, password, email_confirm: true, user_metadata: { manus_open_id: openId, manus_username: username, source: "manus-multimodal" } });
    if (userResult.error || !userResult.data.user) throw userResult.error ?? new Error("No se pudo crear la cuenta Supabase vinculada.");
    const supabaseUser = userResult.data.user;
    const { error: profileError } = await supabaseAdmin.from("profiles").upsert({ id: supabaseUser.id, username, display_name: manusUser.name || username, updated_at: new Date().toISOString() }, { onConflict: "id" });
    if (profileError) throw profileError;
    const { data: sessionData, error: sessionError } = await supabaseAdmin.auth.signInWithPassword({ email: linkEmail, password });
    if (sessionError || !sessionData.session) throw sessionError ?? new Error("No se pudo iniciar la sesión Supabase vinculada.");
    res.json({ ok: true, username, session: sessionData.session });
  } catch (error) {
    console.error("[Supabase] Manus multimodal link failed", error);
    res.status(401).json({ error: error instanceof Error ? error.message : "No se pudo vincular la cuenta." });
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
