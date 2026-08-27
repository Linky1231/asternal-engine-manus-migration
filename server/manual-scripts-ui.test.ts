import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const projectRoot = resolve(import.meta.dirname, "..");
const editorSource = readFileSync(resolve(projectRoot, "src/components/engine/AsternalEditor.tsx"), "utf8");
const scriptEditorSource = readFileSync(resolve(projectRoot, "src/components/engine/ScriptEditor.tsx"), "utf8");

describe("presentación de Scripts manuales", () => {
  it("los muestra desde Inspección y no como una sección de navegación independiente", () => {
    const inspectorStart = editorSource.indexOf("function InspectorPanel");
    const inspectorEnd = editorSource.indexOf("function ScenesPanel");
    const buttonIndex = editorSource.indexOf("<ScriptsButton");
    expect(inspectorStart).toBeGreaterThan(-1);
    expect(buttonIndex).toBeGreaterThan(inspectorStart);
    expect(buttonIndex).toBeLessThan(inspectorEnd);
    expect(editorSource).toContain("SCRIPTS MANUALES");
  });

  it("orienta a describir un cambio de código sin presentar el compositor como inteligencia artificial", () => {
    expect(scriptEditorSource).toContain("DESCRIBE LO QUE NECESITAS");
    expect(scriptEditorSource).toContain("CREAR CAMBIO DE CÓDIGO");
    expect(scriptEditorSource).toContain("ARCHIVOS");
    expect(scriptEditorSource).not.toContain("+ NUEVO SCRIPT VACÍO");
    expect(scriptEditorSource).not.toContain("+ AGREGAR BLOQUE");
    expect(scriptEditorSource).not.toMatch(/Scripting AI|IA de autoría/i);
  });
});
