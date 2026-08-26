import { describe, expect, it } from "vitest";
import { withCloudTimeout } from "../src/lib/engine/cloud-sync";

describe("protecciones de sincronización cloud", () => {
  it("conserva el resultado de una operación que termina", async () => {
    await expect(withCloudTimeout(Promise.resolve("ok"), "timeout", 50)).resolves.toBe("ok");
  });

  it("rechaza una operación colgada en vez de mantener la UI cargando", async () => {
    const pending = new Promise<string>(() => undefined);
    await expect(withCloudTimeout(pending, "La nube no respondió", 5)).rejects.toThrow("La nube no respondió");
  });
});
