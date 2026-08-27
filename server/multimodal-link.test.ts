import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const server = readFileSync(resolve(root, "server/_core/index.ts"), "utf8");
const oauth = readFileSync(resolve(root, "server/_core/oauth.ts"), "utf8");
const profile = readFileSync(resolve(root, "src/routes/profile.tsx"), "utf8");
const auth = readFileSync(resolve(root, "src/routes/auth.tsx"), "utf8");
const helper = readFileSync(resolve(root, "src/lib/auth/manus.ts"), "utf8");
const supabaseClient = readFileSync(resolve(root, "src/integrations/supabase/client.ts"), "utf8");

describe("Manus multimodal login", () => {
  it("expone la sesión y el cierre de sesión oficiales de Manus sin un puente externo", () => {
    expect(server).toContain('app.get("/api/manus/session"');
    expect(server).toContain('app.post("/api/manus/logout"');
    expect(server).toContain('import { registerOAuthRoutes } from "./oauth";');
    expect(server).toContain("registerOAuthRoutes(app);");
    expect(server).toContain("sdk.authenticateRequest(req)");
    expect(server).not.toContain('/api/supabase/link-manus');
    expect(server).not.toContain("signInSupabaseUser");
  });

  it("returns to profile only for the one-time multimodal intent", () => {
    expect(oauth).toContain("MULTIMODAL_LINK_COOKIE");
    expect(oauth).toContain('/?multimodal=1');
    expect(helper).toContain("OAUTH_STATE_COOKIE");
    expect(helper).toContain("crypto.randomUUID()");
    expect(helper).toContain("window.location.origin");
    expect(helper).not.toContain("asternaleng-ceskknda.manus.space");
    expect(helper).not.toContain("isAsternalRuntime");
    expect(readFileSync(resolve(root, "src/routes/index.tsx"), "utf8")).toContain('"/api/manus/session"');
  });

  it("desconecta el cliente de Supabase y no conserva credenciales incrustadas", () => {
    expect(supabaseClient).not.toContain("createClient<Database>");
    expect(supabaseClient).not.toContain("supabase.co");
    expect(supabaseClient).toContain("servicios de Manus");
  });

  it("expone el acceso dentro de Log in sin crear una segunda sesión", () => {
    expect(auth).toContain("Continuar con Google");
    expect(auth).toContain("startMultimodalLogin");
    expect(auth).toContain('"/api/manus/session"');
    expect(auth).not.toContain("supabase.auth.setSession");
    expect(auth).toContain('aria-label="Continuar con Google"');
    expect(profile).not.toContain("Login multimodal");
  });
});
