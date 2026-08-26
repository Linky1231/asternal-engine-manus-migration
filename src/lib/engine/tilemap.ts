import type { Scene, Tilemap } from "./core";

export function createTilemap(scene: Scene, tileSize = 32): Tilemap {
  const cols = Math.max(1, Math.floor(scene.width / tileSize));
  const rows = Math.max(1, Math.floor(scene.height / tileSize));
  return { tileSize, cols, rows, cells: Array<string | null>(cols * rows).fill(null) };
}

export function normalizedTilemap(scene: Scene): Tilemap {
  const current = scene.tilemap;
  if (!current || current.cols < 1 || current.rows < 1 || current.tileSize < 1) return createTilemap(scene);
  const size = current.cols * current.rows;
  return { ...current, cells: Array.from({ length: size }, (_, index) => current.cells[index] ?? null) };
}

export function resizeTilemap(tilemap: Tilemap, scene: Scene, tileSize: number): Tilemap {
  const next = createTilemap(scene, tileSize);
  const cols = Math.min(tilemap.cols, next.cols);
  const rows = Math.min(tilemap.rows, next.rows);
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) next.cells[row * next.cols + col] = tilemap.cells[row * tilemap.cols + col] ?? null;
  }
  return next;
}
