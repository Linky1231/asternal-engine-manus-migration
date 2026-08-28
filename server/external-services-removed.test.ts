import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("servicios externos retirados", () => {
  it("no conserva un cliente administrativo ni un helper de servidor externo", () => {
    expect(existsSync(resolve(process.cwd(), "src/integrations/supabase/client.server.ts"))).toBe(false);
    expect(existsSync(resolve(process.cwd(), "server/_core/supabase-admin-fetch.ts"))).toBe(false);
  });

  it("no declara la dependencia de cliente externo ni el árbol de integración retirado", () => {
    const manifest = readFileSync(resolve(process.cwd(), "package.json"), "utf8");
    expect(existsSync(resolve(process.cwd(), "src/integrations/supabase"))).toBe(false);
    expect(manifest).not.toContain("@supabase/supabase-js");
  });
});
