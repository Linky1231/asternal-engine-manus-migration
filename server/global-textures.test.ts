import { afterEach, describe, expect, it, vi } from "vitest";
import { CODE_TEXTURE_URL, applyGlobalTexture } from "../src/lib/global-textures";
import { DEFAULT_GLOBAL_TEXTURE, EMPTY_TEXTURE_MANIFEST } from "./global-textures";

describe("texturas globales", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("conserva una textura Manus como fallback codificado", () => {
    expect(CODE_TEXTURE_URL).toContain("/manus-storage/");
    expect(CODE_TEXTURE_URL).not.toContain("supabase");
    expect(EMPTY_TEXTURE_MANIFEST.active).toEqual(DEFAULT_GLOBAL_TEXTURE);
  });

  it("puede sustituir la textura activa sin cambiar el resto del estilo", () => {
    const setProperty = vi.fn();
    vi.stubGlobal("document", { documentElement: { style: { setProperty } } });
    applyGlobalTexture("/manus-storage/global-textures/next.png");
    expect(setProperty).toHaveBeenCalledWith("--global-button-texture", 'url("/manus-storage/global-textures/next.png")');
  });

  it("vuelve al fallback cuando no existe una textura publicada", () => {
    const setProperty = vi.fn();
    vi.stubGlobal("document", { documentElement: { style: { setProperty } } });
    applyGlobalTexture(null);
    expect(setProperty).toHaveBeenCalledWith("--global-button-texture", `url("${CODE_TEXTURE_URL}")`);
  });
});
