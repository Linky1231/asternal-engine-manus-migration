import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { completeOrionChat } from "../orion";
import { authenticateCommunityRequest, rankCommunityFeed, reviewCommunityPost, reviewCommunitySubmission } from "../community-ai";
import { readManusVerification, readManusVerifications, writeManusVerification } from "../verification";

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

app.post("/api/verification/status", async (req, res) => {
  try {
    const targetUserId = typeof req.body?.targetUserId === "string" ? req.body.targetUserId.trim() : "";
    if (!targetUserId) return res.status(400).json({ error: "Falta la cuenta destinataria." });
    res.json(await readManusVerification(req.header("authorization"), targetUserId));
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo consultar la verificación.";
    res.status(400).json({ error: message });
  }
});

app.post("/api/verification/statuses", async (req, res) => {
  try {
    const targetUserIds = Array.isArray(req.body?.targetUserIds) ? req.body.targetUserIds : [];
    res.json(await readManusVerifications(req.header("authorization"), targetUserIds));
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudieron consultar las verificaciones.";
    res.status(400).json({ error: message });
  }
});

app.post("/api/verification/toggle", async (req, res) => {
  try {
    const targetUserId = typeof req.body?.targetUserId === "string" ? req.body.targetUserId.trim() : "";
    if (!targetUserId) return res.status(400).json({ error: "Falta la cuenta destinataria." });
    res.json(await writeManusVerification(req.header("authorization"), targetUserId, req.body?.verified === true));
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo actualizar la verificación.";
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
