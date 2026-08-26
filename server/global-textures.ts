import { storageGetSignedUrl, storagePut, storagePutAtKey } from "./storage";

const MANIFEST_KEY = "global-textures/manifest.json";
const MAX_TEXTURE_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

export type GlobalTextureManifest = {
  active: { key: string; url: string; name: string; mimeType: string; updatedAt: string } | null;
};

export const DEFAULT_GLOBAL_TEXTURE = {
  key: "asternal-button-texture_049e0e5b.png",
  url: "/manus-storage/asternal-button-texture_049e0e5b.png",
  name: "asternal-button-texture.png",
  mimeType: "image/png",
  updatedAt: "",
};

export const EMPTY_TEXTURE_MANIFEST: GlobalTextureManifest = { active: DEFAULT_GLOBAL_TEXTURE };

export async function readGlobalTextureManifest(): Promise<GlobalTextureManifest> {
  try {
    const signedUrl = await storageGetSignedUrl(MANIFEST_KEY);
    const response = await fetch(signedUrl, { cache: "no-store" });
    if (!response.ok) return EMPTY_TEXTURE_MANIFEST;
    const value = (await response.json()) as Partial<GlobalTextureManifest>;
    return value.active && typeof value.active.url === "string"
      ? { active: {
          key: String(value.active.key ?? ""),
          url: value.active.url,
          name: String(value.active.name ?? "Textura global"),
          mimeType: String(value.active.mimeType ?? "image/png"),
          updatedAt: String(value.active.updatedAt ?? ""),
        } }
      : EMPTY_TEXTURE_MANIFEST;
  } catch {
    return EMPTY_TEXTURE_MANIFEST;
  }
}

export async function publishGlobalTexture(input: { bytes: Buffer; mimeType: string; name: string }) {
  if (!ALLOWED_TYPES.has(input.mimeType)) throw new Error("Formato no compatible. Usa PNG, JPG o WebP.");
  if (!input.bytes.length || input.bytes.length > MAX_TEXTURE_BYTES) throw new Error("La textura debe pesar entre 1 byte y 5 MB.");
  const safeName = input.name.replace(/[^a-z0-9._-]+/gi, "_").slice(0, 80) || "texture.png";
  const uploaded = await storagePut(`global-textures/${safeName}`, input.bytes, input.mimeType);
  const manifest: GlobalTextureManifest = {
    active: { key: uploaded.key, url: uploaded.url, name: safeName, mimeType: input.mimeType, updatedAt: new Date().toISOString() },
  };
  await storagePutAtKey(MANIFEST_KEY, JSON.stringify(manifest), "application/json");
  return manifest;
}
