import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { applyAuthoringPlan } from "../src/lib/engine/authoring";
import { newProject, newScene } from "../src/lib/engine/core";
import { normalizeProject } from "../src/lib/engine/storage";

describe("autoría asistida del editor", () => {
  it("aplica un plan estructurado con grupos y entidades sin evaluar código", () => {
    const scene = newScene("Prueba");
    const result = applyAuthoringPlan(scene, {
      summary: "Crear una moneda de prueba", assumptions: [], operations: [
        { type: "create_group", name: "Coleccionables", parentId: null },
        { type: "create_entity", entity: { kind: "coin", name: "Moneda de prueba", x: 120, y: 80, w: 24, h: 24, color: "#facc15", tags: ["premio"], groupId: null } },
      ],
    });
    expect(result).toMatchObject({ applied: 2, skipped: 0 });
    expect(result.scene.hierarchy?.groups[0]).toMatchObject({ name: "Coleccionables" });
    expect(result.scene.entities.at(-1)).toMatchObject({ kind: "coin", name: "Moneda de prueba", x: 120, y: 80, tags: ["premio"] });
  });

  it("limita valores peligrosos y omite objetivos inexistentes", () => {
    const scene = newScene("Prueba");
    const entity = scene.entities[0];
    const result = applyAuthoringPlan(scene, { summary: "Ajustar", assumptions: [], operations: [
      { type: "update_entity", targetId: entity.id, patch: { w: 999999, scaleX: -4, collisionLayer: 99 } },
      { type: "delete_entity", targetId: "no-existe" },
    ] });
    expect(result).toMatchObject({ applied: 1, skipped: 1 });
    expect(result.scene.entities[0]).toMatchObject({ w: scene.width * 2, scaleX: 0.05, collisionLayer: 15 });
  });

  it("configura lógica declarativa del juego sin evaluar bloques ni código", () => {
    const scene = newScene("Prueba");
    const entity = scene.entities[0];
    const result = applyAuthoringPlan(scene, { summary: "Mover plataforma", assumptions: [], operations: [{ type: "configure_behavior", targetId: entity.id, behavior: "moving", enabled: true, config: { axis: "x", range: 240, speed: 90 } }] });
    expect(result).toMatchObject({ applied: 1, skipped: 0 });
    expect(result.scene.entities[0].moving).toMatchObject({ axis: "x", range: 240, speed: 90 });
  });

  it("borra scripts legados al normalizar un proyecto existente", () => {
    const project = newProject() as typeof newProject extends () => infer P ? P : never;
    const legacy = project.scenes[0].entities[0] as typeof project.scenes[0].entities[number] & { scripts?: unknown[] };
    legacy.scripts = [{ id: "old", event: "onStart", blocks: [] }];
    const migrated = normalizeProject(project);
    expect(migrated.scenes[0].entities[0]).not.toHaveProperty("scripts");
  });

  it("el editor y el runtime no importan ni ejecutan el intérprete de bloques", () => {
    const editor = readFileSync(new URL("../src/components/engine/AsternalEditor.tsx", import.meta.url), "utf8");
    const runtime = readFileSync(new URL("../src/components/engine/GameRuntime.tsx", import.meta.url), "utf8");
    const assistant = readFileSync(new URL("../src/components/engine/EditorAuthoringAssistant.tsx", import.meta.url), "utf8");
    expect(editor).toContain("EditorAuthoringAssistant");
    expect(editor).toContain("SCRIPTING AI");
    expect(editor).not.toContain("ScriptEditor");
    expect(runtime).not.toContain("createScriptRunner");
    expect(runtime).not.toContain("scripts.step");
    expect(assistant).toContain("createPortal");
    expect(assistant).toContain("z-[1000]");
    expect(assistant).toContain("flex-col lg:grid");
  });
});
