import { describe, expect, it } from "vitest";
import { supabaseAdmin } from "../src/integrations/supabase/client.server";

describe("Supabase service-role configuration", () => {
  it("can perform a read-only admin user-list request", async () => {
    const { error } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1 });
    expect(error).toBeNull();
  }, 15_000);
});
