export const CODE_TEXTURE_URL = "/manus-storage/asternal-button-texture_049e0e5b.png";

export type GlobalTextureManifest = {
  active: { key: string; url: string; name: string; mimeType: string; updatedAt: string } | null;
};

export async function fetchGlobalTextureManifest(): Promise<GlobalTextureManifest> {
  const response = await fetch("/api/textures/catalog", { cache: "no-store" });
  if (!response.ok) throw new Error("No se pudo cargar el catálogo de texturas.");
  return response.json() as Promise<GlobalTextureManifest>;
}

export function applyGlobalTexture(url: string | null | undefined) {
  const chosen = url || CODE_TEXTURE_URL;
  document.documentElement.style.setProperty("--global-button-texture", `url("${chosen.replace(/"/g, "")}")`);
}

export async function hydrateGlobalTexture(): Promise<GlobalTextureManifest> {
  try {
    const manifest = await fetchGlobalTextureManifest();
    applyGlobalTexture(manifest.active?.url);
    return manifest;
  } catch {
    applyGlobalTexture(null);
    return { active: null };
  }
}
