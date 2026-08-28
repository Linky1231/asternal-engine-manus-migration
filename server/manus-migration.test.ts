import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "..");
const read = (relative: string) => readFileSync(resolve(root, relative), "utf8");

describe("migración de servicios externos a Manus", () => {
  it("declara un registro propietario para los datos limpios de Asternal", () => {
    const schema = read("drizzle/schema.ts");
    expect(schema).toContain('mysqlTable("asternal_records"');
    expect(schema).toContain('ownerOpenId');
    expect(schema).toContain('visibility');
  });

  it("protege las rutas internas de registros y proyectos con la sesión de Manus", () => {
    const server = read("server/_core/index.ts");
    expect(server).toContain('app.get("/api/manus/session"');
    expect(server).toContain('app.get("/api/manus/projects"');
    expect(server).toContain('app.get("/api/manus/records/:collection"');
    expect(server).toContain("sdk.authenticateRequest(req)");
    expect(server).not.toContain('/api/supabase/link-manus');
  });

  it("desconecta las credenciales externas y sincroniza proyectos por Manus", () => {
    const client = read("src/integrations/manus/data-client.ts");
    const projectSync = read("src/lib/engine/cloud-sync.ts");
    expect(client).not.toContain("createClient<Database>");
    expect(client).not.toContain("supabase.co");
    expect(client).toContain('"/api/manus/session"');
    expect(projectSync).not.toContain('import { supabase }');
    expect(projectSync).toContain('"/api/manus/projects"');
  });

  it("mantiene las versiones privadas y las revisiones comunitarias dentro de Manus", () => {
    const sourceVersions = read("server/source-versions.ts");
    const communityAi = read("server/community-ai.ts");
    const communityClient = read("src/lib/ai/community-orion.ts");
    const viteConfig = read("vite.config.ts");

    expect(sourceVersions).toContain('createManusRecord');
    expect(sourceVersions).toContain('listOwnManusRecords');
    expect(sourceVersions).not.toMatch(/SUPABASE|supabase/i);
    expect(communityAi).not.toMatch(/SUPABASE|supabase/i);
    expect(communityClient).toContain('credentials: "include"');
    expect(communityClient).not.toContain('Authorization: `Bearer ${token}`');
    expect(viteConfig).not.toMatch(/SUPABASE|supabase/i);
  });

  it("traslada mensajes, grupos, encuestas y regalos del chat a Manus", () => {
    const schema = read("drizzle/schema.ts");
    const chatService = read("server/manus-chat.ts");
    const chatClient = read("src/lib/social/chat.ts");
    const server = read("server/_core/index.ts");

    expect(schema).toContain('mysqlTable("asternal_chats"');
    expect(schema).toContain('mysqlTable("asternal_chat_messages"');
    expect(schema).toContain('mysqlTable("asternal_chat_polls"');
    expect(chatService).toContain("findMemberChat");
    expect(chatService).toContain("assertMutualFollow");
    expect(chatClient).toContain('"/api/manus/chats/community"');
    expect(chatClient).not.toMatch(/SUPABASE|supabase/i);
    expect(server).toContain('app.post("/api/manus/chats/:chatId/messages"');
    expect(server).toContain('app.post("/api/manus/chat-polls/:pollId/vote"');
  });

  it("procesa compras y donaciones de Orbes únicamente en el servidor de Manus", () => {
    const marketplace = read("server/manus-marketplace.ts");
    const socialApi = read("src/lib/social/api.ts");
    const server = read("server/_core/index.ts");

    expect(marketplace).toContain("db.transaction");
    expect(marketplace).toContain("adjustBalance");
    expect(server).toContain('app.post("/api/manus/marketplace/purchase"');
    expect(server).toContain('app.post("/api/manus/marketplace/donations"');
    expect(server).toContain('app.post("/api/manus/marketplace/plus-claim"');
    expect(socialApi).toContain('"/api/manus/marketplace/purchase"');
    expect(socialApi).toContain('"/api/manus/marketplace/donations"');
    expect(socialApi).toContain('"/api/manus/marketplace/plus-claim"');
    expect(socialApi).not.toContain('rpc("purchase_game"');
  });

  it("expone operaciones protegidas de eventos, notificaciones, foro y reventa sin RPC heredadas", () => {
    const server = read("server/_core/index.ts");
    const socialApi = read("src/lib/social/api.ts");
    const forumClient = read("src/lib/social/forum-storage.ts");
    const forumService = read("server/manus-forum.ts");
    const communitySettings = read("src/lib/community/settings.ts");

    expect(server).toContain('app.get("/api/manus/events"');
    expect(server).toContain('app.post("/api/manus/notifications"');
    expect(server).toContain('app.post("/api/manus/forum/threads/:threadId/vote"');
    expect(server).toContain('app.post("/api/manus/marketplace/artwork-resale"');
    expect(socialApi).toContain('"/api/manus/events"');
    expect(socialApi).toContain('"/api/manus/notifications"');
    expect(socialApi).toContain('"/api/manus/marketplace/artwork-resale"');
    expect(forumClient).toContain('`/api/manus/forum/threads/${encodeURIComponent(threadId)}/vote`');
    expect(forumClient).not.toContain(".rpc(");
    expect(forumService).toContain("voteForumThreadForUser");
    expect(forumService).toContain("touchForumThreadForUser");
    expect(server).toContain('app.put("/api/manus/community/settings"');
    expect(communitySettings).toContain('"/api/manus/community/settings"');
    expect(communitySettings).not.toContain(".from(\"posts\")");
  });
});
