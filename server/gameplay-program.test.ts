import { describe, expect, it } from "vitest";
import { newRuntimeState, newScene } from "../src/lib/engine/core";
import { stepGameplay } from "../src/lib/engine/gameplay";

describe("programas internos de gameplay", () => {
  it("ejecuta una regla de botón dentro de Play sin tocar el editor", () => {
    const scene = newScene();
    scene.ui = [{ id: "next", kind: "button", name: "Siguiente", x: 0, y: 0, w: 80, h: 40, anchor: "br", text: "SIGUIENTE", action: "event", eventName: "next", visible: true }];
    scene.gameplay = { rules: [{ id: "next-rule", name: "Avanzar", event: "ui_event", eventName: "next", once: true, commands: [{ type: "add_score", amount: 25 }, { type: "set_ui_text", targetId: "next", text: "LISTO" }] }] };
    const state = newRuntimeState(scene);
    stepGameplay(scene, state, [{ type: "ui_event", name: "next" }], { playSound: () => undefined, restart: () => undefined });
    expect(state.score).toBe(25);
    expect(scene.ui[0].text).toBe("LISTO");
    expect(state.firedRules["next-rule"]).toBe(true);
  });
});
