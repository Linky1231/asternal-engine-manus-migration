import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { newRuntimeState, newScene, stepScene } from "../src/lib/engine/core";

const runtime = readFileSync("src/components/engine/GameRuntime.tsx", "utf8");
const core = readFileSync("src/lib/engine/core.ts", "utf8");
const pill = readFileSync("src/lib/engine/player-visual.ts", "utf8");
const entityVisual = readFileSync("src/lib/engine/entity-visual.ts", "utf8");

describe("movement stability", () => {
  it("stabilizes a default player above the floor before the first input step", () => {
    const scene = newScene();
    const state = newRuntimeState(scene);
    const player = scene.entities.find(entity => entity.controllable)!;

    stepScene(scene, { left: false, right: true, jump: false }, state, 1 / 60);

    expect(player.y).toBeCloseTo(544, 2);
    expect((player as typeof player & { _grounded?: boolean })._grounded).toBe(true);
    expect(player.vx).toBeGreaterThan(0);
  });

  it("keeps the background grid on the same quantized camera used by world rendering", () => {
    expect(runtime).toContain("camX = Math.round(camX * scale) / scale");
    expect(runtime).toContain("const off = -camX * 0.4");
    expect(core).not.toContain("// camera follow");
  });

  it("uses a joystick deadzone instead of applying an edge impulse on touch-down", () => {
    expect(runtime).toContain("const deadzone = Math.max(8, max * 0.18)");
    expect(runtime).toContain("Math.abs(nx) < deadzone ? 0");
  });

  it("removes isolated highlight strokes from the shared character and entity art", () => {
    expect(pill).not.toContain("createLinearGradient");
    expect(pill).not.toContain("rgba(255,255,255,0.42)");
    expect(entityVisual).not.toContain('rgba(255,255,255,0.3)');
  });
});
