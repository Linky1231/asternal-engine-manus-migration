import { describe, expect, it } from "vitest";
import { sanitizeManualScriptDraft } from "./manual-scripts";

describe("Scripts manuales", () => {
  it("acepta una propuesta compatible y elimina campos no permitidos", () => {
    const result = sanitizeManualScriptDraft({
      summary: "Suma puntos al recoger la moneda.",
      script: {
        event: "onCollide",
        withKind: "player",
        key: null,
        threshold: null,
        interval: null,
        message: null,
        blocks: [{ kind: "addScore", value: 10, x: null, y: null, w: null, h: null, text: null, sound: null, color: null, bool: null, cond: null, target: null, scope: null, property: null, operator: null, repeat: null, injected: "ignored" }],
      },
    });
    expect(result).toEqual({
      summary: "Suma puntos al recoger la moneda.",
      script: { event: "onCollide", withKind: "player", blocks: [{ kind: "addScore", value: 10 }] },
    });
  });

  it("rechaza propuestas sin acciones ejecutables", () => {
    expect(() => sanitizeManualScriptDraft({ summary: "Vacío", script: { event: "onStart", blocks: [] } })).toThrow("no contiene acciones");
  });
});
