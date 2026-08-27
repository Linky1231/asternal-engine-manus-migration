import { describe, expect, it } from "vitest";
import { getStorageNamespaceKey, normalizeProject, storageNamespaceFor } from "../src/lib/engine/storage";
import { newProject } from "../src/lib/engine/core";

describe("editor storage namespaces", () => {
  it("uses anonymous namespace only without an authenticated owner", () => {
    expect(storageNamespaceFor(null)).toBe("anonymous");
    expect(storageNamespaceFor(undefined)).toBe("anonymous");
  });

  it("normalizes a Supabase user id into a stable account namespace", () => {
    expect(storageNamespaceFor(" user/abc.def ")).toBe("user_abc_def");
    expect(getStorageNamespaceKey("projects:index")).toContain("asternal:");
  });

  it("does not expose the raw email as a storage identity", () => {
    const namespace = storageNamespaceFor("user-id-123");
    expect(namespace).not.toContain("@");
    expect(namespace).not.toContain("example.com");
  });

  it("removes legacy block scripts while preserving the rest of each entity", () => {
    const project = newProject();
    const entity = project.scenes[0]?.entities[0];
    if (!entity) throw new Error("El proyecto inicial debe incluir un jugador");
    const legacyProject = {
      ...project,
      scenes: [{ ...project.scenes[0]!, entities: [{ ...entity, scripts: [{ id: "legacy", event: "onStart", blocks: [] }] }] }],
    };
    const normalized = normalizeProject(legacyProject as typeof project);
    const migrated = normalized.scenes[0]?.entities[0] as (typeof entity & { scripts?: unknown }) | undefined;
    expect(migrated?.id).toBe(entity.id);
    expect(migrated?.kind).toBe(entity.kind);
    expect(migrated).not.toHaveProperty("scripts");
  });
});
