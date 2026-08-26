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
  it("protects the link endpoint with Manus session authentication", () => {
    expect(server).toContain('app.post("/api/supabase/link-manus"');
    expect(server).toContain('import { registerOAuthRoutes } from "./oauth";');
    expect(server).toContain("registerOAuthRoutes(app);");
    expect(server).toContain("sdk.authenticateRequest(req)");
    expect(server).toContain("listSupabaseUsers");
    expect(server).toContain("createSupabaseUser");
    expect(server).toContain("signInSupabaseUser");
    expect(server).toContain("verifySupabaseProfile");
    expect(server).toContain('crypto.randomBytes(32)');
    expect(server).not.toContain("manusUser.password");
  });

  it("returns to profile only for the one-time multimodal intent", () => {
    expect(oauth).toContain("MULTIMODAL_LINK_COOKIE");
    expect(oauth).toContain('/?multimodal=1');
    expect(helper).toContain("OAUTH_STATE_COOKIE");
    expect(helper).toContain("crypto.randomUUID()");
    expect(helper).toContain("window.location.origin");
    expect(helper).not.toContain("asternaleng-ceskknda.manus.space");
    expect(helper).not.toContain("isAsternalRuntime");
    expect(readFileSync(resolve(root, "src/routes/index.tsx"), "utf8")).toContain("multimodalReturn");
  });

  it("materializes a visible profile when the compatibility client receives the returned session", () => {
    expect(supabaseClient).toContain("ensureProfileExists(user.id, user.email");
    expect(supabaseClient).toContain("user.user_metadata?.manus_username");
  });

  it("exposes the action inside Log in and establishes the returned Supabase session", () => {
    expect(auth).toContain("Continuar con Google");
    expect(auth).toContain("startMultimodalLogin");
    expect(auth).toContain("supabase.auth.setSession");
    expect(auth).toContain('aria-label="Continuar con Google"');
    expect(profile).not.toContain("Login multimodal");
  });
});
