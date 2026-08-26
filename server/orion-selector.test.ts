import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("../src/components/ai/OrionPanel.tsx", import.meta.url), "utf8");

describe("selector de conversaciones de Orión", () => {
  it("mantiene la acción de selección y la eliminación como botones hermanos", () => {
    const rows = source.slice(source.indexOf("{chats.map(c => ("), source.indexOf("{chats.map(c => (") + 3200);

    expect(rows).toContain('<div\n                        key={c.id}');
    expect(rows).toContain('className="flex min-w-0 flex-1 items-center gap-2');
    expect(rows).toContain('aria-label={`Eliminar ${c.title}`}');
    const firstButtonStart = rows.indexOf("<button");
    const firstButtonEnd = rows.indexOf("</button>", firstButtonStart);
    const secondButtonStart = rows.indexOf("<button", firstButtonEnd + 1);

    expect(firstButtonStart).toBeGreaterThanOrEqual(0);
    expect(firstButtonEnd).toBeGreaterThan(firstButtonStart);
    expect(secondButtonStart).toBeGreaterThan(firstButtonEnd);
  });
});

export {};
