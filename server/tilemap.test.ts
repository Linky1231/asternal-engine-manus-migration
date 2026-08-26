import { describe, expect, it } from "vitest";
import { newScene } from "../src/lib/engine/core";
import { createTilemap, normalizedTilemap, resizeTilemap } from "../src/lib/engine/tilemap";

describe("tilemaps de escenas", () => {
  it("crea una cuadrícula proporcional a la escena", () => {
    const scene = newScene();
    const tilemap = createTilemap(scene, 32);
    expect(tilemap.cols).toBe(Math.floor(scene.width / 32));
    expect(tilemap.rows).toBe(Math.floor(scene.height / 32));
    expect(tilemap.cells).toHaveLength(tilemap.cols * tilemap.rows);
  });

  it("normaliza celdas ausentes sin romper escenas legacy", () => {
    const scene = { ...newScene(), tilemap: { tileSize: 16, cols: 2, rows: 2, cells: ["tile-a"] } };
    const tilemap = normalizedTilemap(scene);
    expect(tilemap.cells).toEqual(["tile-a", null, null, null]);
  });

  it("preserva la zona común al redimensionar", () => {
    const scene = newScene();
    const original = { tileSize: 32, cols: 2, rows: 2, cells: ["a", "b", "c", "d"] };
    const resized = resizeTilemap(original, scene, 16);
    expect(resized.cells[0]).toBe("a");
    expect(resized.cells[1]).toBe("b");
    expect(resized.cells[resized.cols]).toBe("c");
    expect(resized.cells[resized.cols + 1]).toBe("d");
  });
});
