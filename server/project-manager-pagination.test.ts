import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(resolve(import.meta.dirname, "../src/components/engine/ProjectManager.tsx"), "utf8");

describe("carga progresiva del gestor de proyectos", () => {
  it("empieza con lotes limitados y renderiza solo los elementos visibles", () => {
    expect(source).toContain("const PROJECT_PAGE_SIZE = 24");
    expect(source).toContain("items.slice(0, localVisibleCount)");
    expect(source).toContain("cloudList.slice(0, cloudVisibleCount)");
  });

  it("usa un sentinel de IntersectionObserver para cargar más al desplazarse", () => {
    expect(source).toContain("IntersectionObserver");
    expect(source).toContain("loadMoreRef");
    expect(source).toContain("Cargando más proyectos");
  });

  it("conserva las acciones de sincronización y limpieza", () => {
    expect(source).toContain("handleCleanupDuplicates");
    expect(source).toContain("syncAllProjects");
    expect(source).toContain("cloudListProjects");
  });
});
