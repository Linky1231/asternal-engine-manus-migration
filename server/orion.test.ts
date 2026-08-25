import { describe, expect, it } from "vitest";
import { sanitizeHistory } from "./orion";

describe("sanitizeHistory", () => {
  it("conserva solo mensajes de usuario y asistente con contenido útil", () => {
    expect(sanitizeHistory([
      { role: "system", content: "ignorar" },
      { role: "user", content: "  Hola Orión  " },
      { role: "assistant", content: "Listo" },
      { role: "user", content: "   " },
      { role: "user", content: 42 },
    ])).toEqual([
      { role: "user", content: "Hola Orión" },
      { role: "assistant", content: "Listo" },
    ]);
  });

  it("limita el historial y la longitud de cada mensaje", () => {
    const history = Array.from({ length: 26 }, (_, index) => ({ role: "user", content: `${index}` }));
    const sanitized = sanitizeHistory(history);
    expect(sanitized).toHaveLength(24);
    expect(sanitized[0].content).toBe("2");
    expect(sanitizeHistory([{ role: "user", content: "x".repeat(6001) }])[0].content).toHaveLength(6000);
  });
});
