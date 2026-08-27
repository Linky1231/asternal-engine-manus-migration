import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { newProject } from "../src/lib/engine/core";
import { normalizeProject } from "../src/lib/engine/storage";

const editorSource = readFileSync(new URL("../src/components/engine/AsternalEditor.tsx", import.meta.url), "utf8");

describe("jerarquía editable del editor", () => {
  it("normaliza escenas antiguas con una jerarquía raíz segura", () => {
    const project = newProject();
    const entity = project.scenes[0].entities[0];
    project.scenes[0] = { ...project.scenes[0], entities: [{ ...entity, parentGroupId: "missing", hierarchyOrder: undefined }] };

    const migrated = normalizeProject(project).scenes[0];
    expect(migrated.hierarchy).toEqual({ groups: [] });
    expect(migrated.entities[0]).toMatchObject({ parentGroupId: null, hierarchyOrder: 0 });
  });

  it("preserva grupos, reasignación de objetos y orden estable al recargar", () => {
    const project = newProject();
    const entity = project.scenes[0].entities[0];
    project.scenes[0] = {
      ...project.scenes[0],
      hierarchy: { groups: [{ id: "world", name: "Mundo", parentId: null, order: 2, collapsed: true }] },
      entities: [{ ...entity, parentGroupId: "world", hierarchyOrder: 4 }],
    };

    const migrated = normalizeProject(project).scenes[0];
    expect(migrated.hierarchy?.groups[0]).toMatchObject({ id: "world", name: "Mundo", parentId: null, order: 2, collapsed: true });
    expect(migrated.entities[0]).toMatchObject({ parentGroupId: "world", hierarchyOrder: 4 });
  });

  it("retira Tiles de las pestañas principales y lo incorpora como subsección de Configuraciones", () => {
    expect(editorSource).not.toContain('["tiles", "Tiles"');
    expect(editorSource).toContain('setSubsection("tiles")');
    expect(editorSource).toContain('<TilemapEditor scene={scene}');
  });

  it("expone grupos, nodos de objeto e identificadores persistentes para edición y automatización", () => {
    expect(editorSource).toContain("function SceneHierarchyPanel");
    expect(editorSource).toContain("parentGroupId");
    expect(editorSource).toContain("hierarchyOrder");
    expect(editorSource).toContain("onSelectEntity");
  });
});
