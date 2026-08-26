import { useMemo, useRef, useState } from "react";
import type { Scene, SpriteAsset, Tilemap } from "@/lib/engine/core";
import { createTilemap, normalizedTilemap, resizeTilemap } from "@/lib/engine/tilemap";

type Props = {
  scene: Scene;
  sprites: SpriteAsset[];
  onChange: (scene: Scene) => void;
};

export function TilemapEditor({ scene, sprites, onChange }: Props) {
  const tilemap = useMemo(() => normalizedTilemap(scene), [scene]);
  const [selectedTile, setSelectedTile] = useState<string | null>(sprites[0]?.id ?? null);
  const [tool, setTool] = useState<"paint" | "erase">("paint");
  const painting = useRef(false);
  const hasTilemap = Boolean(scene.tilemap);
  const spriteById = useMemo(() => new Map(sprites.map(sprite => [sprite.id, sprite])), [sprites]);

  const commitTilemap = (next: Tilemap) => onChange({ ...scene, tilemap: next });
  const paintCell = (index: number) => {
    if (!hasTilemap) return;
    const next = { ...tilemap, cells: [...tilemap.cells] };
    next.cells[index] = tool === "erase" ? null : selectedTile;
    commitTilemap(next);
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-background text-foreground">
      <header className="flex flex-wrap items-center gap-3 border-b border-border/70 bg-card px-4 py-3">
        <div className="min-w-0">
          <div className="font-display text-sm tracking-[0.16em] text-primary-glow">LEVEL TILES</div>
          <div className="text-[10px] font-mono text-muted-foreground">Construye sobre cuadrícula; las entidades y el 9-slicing siguen intactos.</div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <label className="flex items-center gap-1.5 text-[10px] font-display tracking-widest text-muted-foreground">
            TAMAÑO
            <select value={tilemap.tileSize} onChange={event => commitTilemap(resizeTilemap(tilemap, scene, Number(event.target.value)))} className="rounded-md border border-border bg-input/60 px-2 py-1.5 text-xs font-mono text-foreground">
              {[8, 16, 24, 32, 48, 64].map(size => <option key={size} value={size}>{size}px</option>)}
            </select>
          </label>
          {!hasTilemap ? (
            <button type="button" onClick={() => commitTilemap(tilemap)} className="rounded-md bg-primary/15 px-3 py-1.5 text-xs font-display tracking-widest text-primary-glow border border-primary/40">ACTIVAR</button>
          ) : (
            <button type="button" onClick={() => commitTilemap({ ...tilemap, cells: tilemap.cells.map(() => null) })} className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-1.5 text-xs font-display tracking-widest text-destructive">LIMPIAR</button>
          )}
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <div className="min-h-0 flex-1 overflow-auto p-4 bg-[#081225]">
          {!hasTilemap ? (
            <div className="grid h-full min-h-[260px] place-items-center rounded-xl border border-dashed border-primary/35 bg-card/30 p-8 text-center">
              <div><div className="font-display text-sm tracking-widest text-primary-glow">CUADRÍCULA DESACTIVADA</div><p className="mt-2 max-w-sm text-xs text-muted-foreground">Activa el modo Tiles para añadir una capa de nivel independiente. El fondo de la escena, sus capas y sus entidades no se modifican.</p></div>
            </div>
          ) : (
            <div className="inline-block rounded-lg border border-primary/30 bg-[#0b1730] p-2 shadow-[0_0_30px_rgba(45,212,191,0.08)]" onPointerUp={() => { painting.current = false; }} onPointerLeave={() => { painting.current = false; }}>
              <div className="grid touch-none" style={{ gridTemplateColumns: `repeat(${tilemap.cols}, ${tilemap.tileSize}px)` }}>
                {tilemap.cells.map((tileId, index) => {
                  const sprite = tileId ? spriteById.get(tileId) : undefined;
                  return (
                    <button
                      key={index}
                      type="button"
                      aria-label={`Celda ${index + 1}`}
                      onPointerDown={event => { event.preventDefault(); painting.current = true; paintCell(index); }}
                      onPointerEnter={() => { if (painting.current) paintCell(index); }}
                      className="relative grid place-items-center border border-white/[0.07] bg-white/[0.015] hover:bg-primary/[0.12]"
                      style={{ width: tilemap.tileSize, height: tilemap.tileSize }}
                    >
                      {sprite?.frames[0]?.composite ? <img src={sprite.frames[0].composite} alt="" className="h-full w-full object-contain" draggable={false} /> : tileId ? <span className="h-2/3 w-2/3 rounded-sm bg-primary/30" /> : null}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <aside className="w-full shrink-0 overflow-auto border-t border-border/70 bg-card p-3 lg:w-[250px] lg:border-l lg:border-t-0">
          <div className="mb-2 flex items-center justify-between"><div className="font-display text-xs tracking-widest text-primary-glow">PALETA</div><div className="text-[10px] font-mono text-muted-foreground">{sprites.length} TILES</div></div>
          <div className="mb-3 grid grid-cols-2 gap-1.5">
            <button type="button" onClick={() => setTool("paint")} aria-pressed={tool === "paint"} className={`rounded-md border px-2 py-2 text-[10px] font-display tracking-widest ${tool === "paint" ? "border-primary bg-primary/15 text-primary-glow" : "border-border text-muted-foreground"}`}>PINTAR</button>
            <button type="button" onClick={() => setTool("erase")} aria-pressed={tool === "erase"} className={`rounded-md border px-2 py-2 text-[10px] font-display tracking-widest ${tool === "erase" ? "border-primary bg-primary/15 text-primary-glow" : "border-border text-muted-foreground"}`}>BORRAR</button>
          </div>
          {sprites.length === 0 ? <p className="rounded-md border border-dashed border-border p-3 text-[10px] font-mono text-muted-foreground">Importa sprites desde Assets para usarlos como tiles.</p> : (
            <div className="grid grid-cols-2 gap-2">
              {sprites.map(sprite => (
                <button type="button" key={sprite.id} onClick={() => { setSelectedTile(sprite.id); setTool("paint"); }} aria-pressed={selectedTile === sprite.id && tool === "paint"} className={`rounded-lg border p-1.5 text-left transition ${selectedTile === sprite.id && tool === "paint" ? "border-primary bg-primary/10 shadow-[0_0_14px_rgba(45,212,191,0.18)]" : "border-border/60 bg-background/30 hover:border-primary/50"}`}>
                  <div className="grid aspect-square place-items-center overflow-hidden rounded bg-[#d7dde7]"><img src={sprite.frames[0]?.composite} alt={sprite.name} className="h-full w-full object-contain" /></div>
                  <div className="mt-1 truncate text-[10px] font-mono text-foreground">{sprite.name}</div>
                </button>
              ))}
            </div>
          )}
          <div className="mt-4 rounded-lg border border-border/60 bg-background/30 p-2 text-[10px] leading-relaxed text-muted-foreground"><span className="font-display tracking-widest text-primary-glow">CAPAS INDEPENDIENTES</span><br />Tiles: suelo y decoración repetible.<br />9-slicing: paneles y fondos escalables.<br />Entidades: lógica, colisión y scripts.</div>
        </aside>
      </div>
    </div>
  );
}
