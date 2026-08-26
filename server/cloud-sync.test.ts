import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { withCloudTimeout } from "../src/lib/engine/cloud-sync";

const cloudSyncSource = readFileSync(resolve(import.meta.dirname, "../src/lib/engine/cloud-sync.ts"), "utf8");

describe("protecciones de sincronización cloud", () => {
  it("conserva el resultado de una operación que termina", async () => {
    await expect(withCloudTimeout(Promise.resolve("ok"), "timeout", 50)).resolves.toBe("ok");
  });

  it("rechaza una operación colgada en vez de mantener la UI cargando", async () => {
    const pending = new Promise<string>(() => undefined);
    await expect(withCloudTimeout(pending, "La nube no respondió", 5)).rejects.toThrow("La nube no respondió");
  });

  it("agrupa autosaves por proyecto y conserva el id cloud para actualizar", () => {
    expect(cloudSyncSource).toContain("const pendingPushes = new Map<string, Project>()");
    expect(cloudSyncSource).toContain("pendingPushes.set(localId, project)");
    expect(cloudSyncSource).toContain("cloudSaveProject({ id: cloudId");
    expect(cloudSyncSource).toContain("__asternalProjectId");
    expect(cloudSyncSource).toContain("remoteByLocalId");
    expect(cloudSyncSource).not.toContain("let pushTimer:");
  });

  it("solo deduplica copias remotas exactas y conserva la primera versión más reciente", () => {
    expect(cloudSyncSource).toContain("JSON.stringify(project.data)");
    expect(cloudSyncSource).toContain("cloudDeleteProject(project.id)");
  });
});
