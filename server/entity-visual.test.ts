import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const visual = readFileSync(resolve(root, "src/lib/engine/entity-visual.ts"), "utf8");
const editor = readFileSync(resolve(root, "src/components/engine/SceneEditor.tsx"), "utf8");
const runtime = readFileSync(resolve(root, "src/components/engine/GameRuntime.tsx"), "utf8");
const core = readFileSync(resolve(root, "src/lib/engine/core.ts"), "utf8");

describe("default entity visual system", () => {
  it("covers every non-player default kind with a dedicated solid-art branch", () => {
    expect(visual).toContain('kind === "coin"');
    expect(visual).toContain('kind === "goal"');
    expect(visual).toContain('kind === "enemy"');
    expect(visual).toContain('kind === "platform"');
    expect(visual).toContain('kind === "decor"');
    expect(visual).not.toMatch(/create(?:Linear|Radial|Conic)Gradient/);
  });

  it("keeps editor and Play on the same fallback renderer", () => {
    expect(editor).toContain('import { drawEntityFallback } from "@/lib/engine/entity-visual";');
    expect(editor).toContain("drawEntityFallback(ctx, { ...e, x: 0, y: 0 }");
    expect(runtime).toContain('import { drawEntityFallback } from "@/lib/engine/entity-visual";');
    expect(runtime).toContain("drawEntityFallback(ctx, e");
  });

  it("preserves the existing entity IDs and gameplay flags", () => {
    expect(core).toContain('export type EntityKind = "player" | "platform" | "enemy" | "coin" | "goal" | "decor";');
    expect(core).toContain("controllable: true");
    expect(core).toContain("collectible: true");
    expect(core).toContain("hazard: true");
    expect(core).toContain("goal: true");
  });
});
