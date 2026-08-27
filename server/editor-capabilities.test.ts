import { describe, expect, it } from "vitest";
import { DEFAULT_INPUT_MAP, KIND_PRESETS, aabb, collidesByLayer, intersects, newProject, stepScene, newRuntimeState } from "../src/lib/engine/core";
import { normalizeProject } from "../src/lib/engine/storage";

describe("capabilities added by the editor audit", () => {
  it("migrates legacy entities, variables, audio and UI defaults without dropping existing fields", () => {
    const legacy = newProject();
    legacy.scenes[0].entities = [{ ...KIND_PRESETS.player, id: "legacy-player", x: 10, y: 20, variables: { lives: 3, title: "A", enabled: true }, name: undefined, scaleX: undefined, scaleY: undefined, bodyType: undefined, mass: undefined, friction: undefined, restitution: undefined, collisionShape: undefined, collisionLayer: undefined, collisionMask: undefined, isTrigger: undefined }];
    legacy.scenes[0].ui = [{ id: "bar", kind: "bar", name: "bar", x: 0, y: 0, w: 100, h: 10, anchor: "tl", max: 8 }];
    legacy.assets = { sprites: [], sounds: [{ id: "sound", name: "sound", mimeType: "audio/wav", dataUrl: "data:audio/wav;base64,AA==" }] };

    const migrated = normalizeProject(legacy);
    const entity = migrated.scenes[0].entities[0];
    expect(entity).toMatchObject({ name: "player", scaleX: 1, scaleY: 1, bodyType: "dynamic", mass: 1, friction: 0.8, restitution: 0, collisionShape: "rectangle", collisionLayer: 1, collisionMask: 15, isTrigger: false });
    expect(entity.variableTypes).toEqual({ lives: "number", title: "text", enabled: "boolean" });
    expect(migrated.assets?.sounds?.[0]).toMatchObject({ volume: 1, loop: false });
    expect(migrated.scenes[0].ui?.[0]).toMatchObject({ initialValue: 8 });
  });

  it("uses scale for contact bounds, honors circle contact and filters layers symmetrically", () => {
    const circle = { ...KIND_PRESETS.coin, id: "coin", x: 20, y: 20, scaleX: 2, scaleY: 2, collisionShape: "circle", collisionLayer: 2, collisionMask: 1 };
    const player = { ...KIND_PRESETS.player, id: "player", x: 10, y: 20, w: 20, h: 20, collisionLayer: 1, collisionMask: 2 };
    expect(aabb(circle)).toMatchObject({ x: 9, y: 9, w: 44, h: 44 });
    expect(intersects(circle, player)).toBe(true);
    expect(collidesByLayer(circle, player)).toBe(true);
    expect(collidesByLayer(circle, { ...player, collisionMask: 0 })).toBe(false);
  });

  it("keeps trigger solids out of physical resolution while retaining the authored interaction flag", () => {
    const scene = newProject().scenes[0];
    const player = { ...KIND_PRESETS.player, id: "player", x: 20, y: 20, gravity: false, vy: 0, vx: 100 };
    const trigger = { ...KIND_PRESETS.platform, id: "trigger", x: 40, y: 20, w: 30, h: 40, isTrigger: true, solid: true };
    scene.entities = [player, trigger];
    stepScene(scene, { left: false, right: true, jump: false }, newRuntimeState(scene), 0.25);
    expect(scene.entities[0].x).toBeGreaterThan(40);
    expect(scene.entities[1].isTrigger).toBe(true);
  });

  it("provides editable default maps for keyboard, gamepad and touch actions", () => {
    expect(DEFAULT_INPUT_MAP.left).toEqual({ keyboard: ["ArrowLeft", "a", "A"], gamepadButtons: [14], touch: true });
    expect(DEFAULT_INPUT_MAP.jump.gamepadButtons).toContain(0);
  });
});
