import { describe, expect, it } from "vitest";
import { applyGenericProperty, createScriptRunner, nextVariableValue } from "../src/lib/engine/scripts";
import { newRuntimeState, newScene } from "../src/lib/engine/core";

describe("base generalizable de scripts", () => {
  it("actualiza variables numéricas sin depender de una clase de objeto", () => {
    expect(nextVariableValue(undefined, 3)).toBe(3);
    expect(nextVariableValue(7, -2)).toBe(5);
  });

  it("aplica propiedades generales y conserva límites seguros", () => {
    const object = { x: 10, w: 24, opacity: 1 };
    applyGenericProperty(object, "x", 5, "change");
    applyGenericProperty(object, "w", -99);
    applyGenericProperty(object, "opacity", 35);
    expect(object).toMatchObject({ x: 15, w: 1, opacity: 0.35 });
  });

  it("ejecuta bloques anidados y delega el audio de proyecto al hook del runtime", () => {
    const scene = newScene();
    const player = scene.entities.find(entity => entity.kind === "player");
    if (!player) throw new Error("newScene debe crear un jugador");
    player.scripts = [{
      id: "startup",
      event: "onStart",
      blocks: [
        { id: "sound", kind: "playSound", audioId: "jump-file" },
        { id: "set", kind: "setVariable", text: "power", value: 2, scope: "entity" },
        { id: "repeat", kind: "repeat", repeat: 2, thenBlocks: [{ id: "inc", kind: "changeVariable", text: "power", value: 1, scope: "entity" }] },
      ],
    }];
    const state = newRuntimeState(scene);
    const played: string[] = [];
    createScriptRunner().step(scene, state, { left: false, right: false, jump: false }, {
      shake: () => {}, restart: () => {}, playProjectSound: id => played.push(id),
    }, 1 / 60);
    expect(played).toEqual(["jump-file"]);
    expect(player.variables?.power).toBe(4);
  });
});
