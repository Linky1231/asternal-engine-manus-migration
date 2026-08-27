import { describe, expect, it } from "vitest";
import { canWriteSourcePath, isInternalSourceRecord, sanitizeSourceProposal, type SourceFileSummary } from "./source-versions";

const knownFiles: SourceFileSummary[] = [{ path: "src/lib/engine/core.ts", category: "motor", editable: true, sha256: "abc", size: 10 }];

describe("versiones internas de código", () => {
  it("distingue las filas internas de fuente de los proyectos visibles", () => {
    expect(isInternalSourceRecord({ __kind: "asternal-source-version" })).toBe(true);
    expect(isInternalSourceRecord({ __kind: "asternal-source-proposal" })).toBe(true);
    expect(isInternalSourceRecord({ __kind: "asset-library" })).toBe(false);
    expect(isInternalSourceRecord({ name: "Juego" })).toBe(false);
  });

  it("solo acepta rutas fuente permitidas para propuestas privadas", () => {
    expect(canWriteSourcePath("src/lib/engine/core.ts", knownFiles)).toBe(true);
    expect(canWriteSourcePath("src/lib/engine/capabilities/ranking.ts", knownFiles)).toBe(true);
    expect(canWriteSourcePath("server/_core/env.ts", knownFiles)).toBe(false);
    expect(canWriteSourcePath("../../.env", knownFiles)).toBe(false);
  });

  it("rechaza una propuesta que no cree o modifique archivos permitidos", () => {
    expect(() => sanitizeSourceProposal({ files: [{ path: "server/_core/env.ts", operation: "update", purpose: "x", content: "x" }] }, "owner-a", "project-a", "version-a", knownFiles)).toThrow("no contiene cambios de código permitidos");
  });

  it("conserva una propuesta de capacidad conectada a archivos reales", () => {
    const proposal = sanitizeSourceProposal({
      summary: "Crea un ranking privado.",
      capability: { id: "ranking", name: "Ranking", scope: "project", connections: { engine: true, runtime: true, editor: false, persistence: true, gameUi: true, server: true } },
      files: [{ path: "src/lib/engine/capabilities/ranking.ts", operation: "create", purpose: "Gestiona puntuaciones", content: "export const ranking = true;" }],
      warnings: [],
    }, "owner-a", "project-a", "version-a", knownFiles);
    expect(proposal.projectId).toBe("project-a");
    expect(proposal.files[0]?.path).toContain("capabilities/ranking.ts");
    expect(proposal.capability.connections.runtime).toBe(true);
  });
});
