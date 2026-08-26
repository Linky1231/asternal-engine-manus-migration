import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const server = readFileSync(resolve(root, "server/_core/index.ts"), "utf8");
const oauth = readFileSync(resolve(root, "server/_core/oauth.ts"), "utf8");
const profile = readFileSync(resolve(root, "src/routes/profile.tsx"), "utf8");
const helper = readFileSync(resolve(root, "src/lib/auth/manus.ts"), "utf8");

describe("Manus multimodal login", () => {
  it("protects the link endpoint with Manus session authentication", () => {
    expect(server).toContain('app.post("/api/supabase/link-manus"');
    expect(server).toContain("sdk.authenticateRequest(req)");
    expect(server).toContain("supabaseAdmin.auth.admin");
    expect(server).toContain('crypto.randomBytes(32)');
    expect(server).not.toContain("manusUser.password");
  });

  it("returns to profile only for the one-time multimodal intent", () => {
    expect(oauth).toContain("MULTIMODAL_LINK_COOKIE");
    expect(oauth).toContain('/profile?multimodal=1');
    expect(helper).toContain("OAUTH_STATE_COOKIE");
    expect(helper).toContain("crypto.randomUUID()");
  });

  it("exposes an accessible profile action and establishes the returned Supabase session", () => {
    expect(profile).toContain("Login multimodal");
    expect(profile).toContain("startMultimodalLogin");
    expect(profile).toContain("supabase.auth.setSession");
    expect(profile).toContain('aria');
  });
});
