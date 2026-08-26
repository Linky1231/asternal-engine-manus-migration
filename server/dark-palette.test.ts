import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const projectRoot = resolve(import.meta.dirname, "..");
const styles = readFileSync(resolve(projectRoot, "src/styles.css"), "utf8");
const glass = readFileSync(resolve(projectRoot, "src/glass-intensity.css"), "utf8");
const search = readFileSync(resolve(projectRoot, "src/components/social/SearchSection.tsx"), "utf8");
const paint = readFileSync(resolve(projectRoot, "src/components/engine/PaintEditor.tsx"), "utf8");

describe("dark reference palette", () => {
  it("uses a dark navy canvas with light foreground tokens", () => {
    expect(styles).toContain("--canvas: oklch(0.155 0.025 258)");
    expect(styles).toContain("--foreground: oklch(0.94 0.018 252)");
    expect(styles).toContain("--gradient-asternal: linear-gradient(135deg");
  });

  it("does not force white glass surfaces", () => {
    expect(glass).toContain("background-color: var(--glass-fill) !important;");
    expect(glass).toContain("background: linear-gradient(135deg, oklch(0.18 0.03 258");
    expect(glass).not.toContain("background-color: oklch(1 0 0 / 0.68) !important;");
  });

  it("keeps mobile search categories visible without horizontal clipping", () => {
    expect(search).toContain('className="flex flex-wrap gap-1.5 -mx-1 px-1 pb-1"');
    expect(search).toContain("text-muted-foreground/65");
  });

  it("keeps the paint editor chrome dark while preserving the drawing canvas", () => {
    expect(paint).toContain('background: "linear-gradient(180deg, oklch(0.18 0.03 258');
    expect(paint).toContain('background: "linear-gradient(0deg, oklch(0.18 0.03 258');
    expect(paint).toContain('backgroundColor: "#f8fafc"');
  });
});
