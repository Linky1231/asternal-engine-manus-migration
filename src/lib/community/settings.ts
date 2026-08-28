import {
  DEFAULT_COMMUNITY_SETTINGS,
  normalizeCommunitySettings,
  parseCommunitySettings,
  serializeCommunitySettings,
  type CommunitySettings,
  type StoredCommunitySettings,
} from "./about";

const SETTINGS_CATEGORY = "system";
const SETTINGS_TYPE = "about_settings";

type SettingsRow = { id: string; content: string | null; updated_at?: string | null };

async function settingsRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, { credentials: "include", ...init });
  const payload = await response.json().catch(() => ({})) as T & { error?: unknown };
  if (!response.ok) throw new Error(typeof payload.error === "string" ? payload.error : "No se pudieron sincronizar los ajustes comunitarios.");
  return payload;
}

/** Lee el único documento comunitario sin crear tablas ni mezclarlo con el feed público. */
export async function fetchCommunitySettings(): Promise<StoredCommunitySettings> {
  const row = await settingsRequest<SettingsRow | null>("/api/manus/community/settings").catch(() => null);
  if (!row) return { ...DEFAULT_COMMUNITY_SETTINGS };
  return { ...parseCommunitySettings(row.content), id: row.id, updatedAt: row.updated_at ?? null };
}

/** Solo una cuenta con rol de administración puede actualizar las reglas globales. */
export async function saveCommunitySettings(input: CommunitySettings): Promise<StoredCommunitySettings> {
  const settings = normalizeCommunitySettings(input);
  const content = serializeCommunitySettings(settings);
  const row = await settingsRequest<SettingsRow>("/api/manus/community/settings", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  });
  return { ...settings, id: row.id, updatedAt: row.updated_at ?? new Date().toISOString() };
}
