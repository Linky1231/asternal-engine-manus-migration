import { supabase } from "@/integrations/supabase/client";
import { cloudSaveProject, cloudListProjects, type CloudProject } from "@/lib/social/api";
import {
  saveProjectById,
  setProjectCloudId,
  getProjectCloudId,
  getProjectCloudUpdatedAt,
  createProject,
  listProjects,
  loadProjectById,
  getCurrentProjectId,
  setCurrentProjectId,
} from "./storage";
import type { Project } from "./core";

let pushTimer: ReturnType<typeof setTimeout> | null = null;

/** Debounced push of a locally-saved project to the cloud (fire & forget). */
export function schedulePushToCloud(localId: string, project: Project) {
  if (typeof window === "undefined") return;
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const cloudId = getProjectCloudId(localId);
      const saved = await cloudSaveProject({ id: cloudId, name: project.name || "Untitled Game", data: project });
      const remoteMs = Date.parse(saved.updated_at);
      setProjectCloudId(localId, saved.id, Number.isFinite(remoteMs) ? remoteMs : Date.now());
    } catch { /* silent */ }
  }, 1500);
}

/** Import all cloud projects that are not present locally. Returns newly created local ids. */
export async function importCloudMissing(): Promise<{ imported: number; total: number }> {
  const list = await cloudListProjects();
  let imported = 0;
  for (const c of list) {
    const already = existsLocalWithCloud(c.id);
    if (already) continue;
    const localId = createProject(c.name);
    saveProjectById(localId, c.data as Project);
    setProjectCloudId(localId, c.id, toMillis(c.updated_at));
    imported++;
  }
  return { imported, total: list.length };
}

function toMillis(value: string | number | null | undefined): number {
  const ms = typeof value === "number" ? value : Date.parse(String(value ?? ""));
  return Number.isFinite(ms) ? ms : 0;
}

function existsLocalWithCloud(cloudId: string): boolean {
  return listProjects().some(project => project.cloudId === cloudId);
}

/**
 * ¿Es el proyecto por defecto que storage crea automáticamente en un
 * dispositivo nuevo ("Untitled Game" sin escenas tocadas ni sprites)?
 * Estos no deben subirse a la nube (crearían duplicados vacíos) y, cuando la
 * cuenta tiene proyectos, conviene cambiarse al proyecto real de la nube.
 */
function isPristineDefault(p: Project | null): boolean {
  if (!p) return true;
  if (p.name !== "Untitled Game") return false;
  const hasEntities = (p.scenes ?? []).some(s => (s.entities ?? []).length > 0);
  if (hasEntities) return false;
  if ((p.assets?.sprites?.length ?? 0) > 0) return false;
  return true;
}

/**
 * Si el proyecto actual es el "Untitled Game" vacío recién creado (dispositivo
 * nuevo / sesión nueva), cambia al proyecto de la nube más reciente de la
 * cuenta — importándolo localmente si aún no existe — para que el editor abra
 * el juego real (con sus imágenes) en lugar de uno vacío. Devuelve el id local
 * activado o null.
 */
export async function activateCloudProjectIfBlank(): Promise<string | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const curId = getCurrentProjectId();
    const cur = loadProjectById(curId);
    if (!cur || !isPristineDefault(cur)) return null;
    // cloudListProjects ya viene ordenado por updated_at desc.
    const list = await cloudListProjects();
    if (!list.length) return null;
    const best = list[0];
    let localId = listProjects().find(m => m.cloudId === best.id)?.id;
    if (!localId) {
      localId = createProject(best.name);
      saveProjectById(localId, best.data as Project);
      setProjectCloudId(localId, best.id);
    }
    setCurrentProjectId(localId);
    return localId;
  } catch { return null; }
}

export async function fetchCloudProjects(): Promise<CloudProject[]> {
  return cloudListProjects();
}

// ───── Biblioteca de assets (imágenes/prefabs del editor) ─────
// Se guarda en una fila RESERVADA de user_projects (data.__kind =
// "asset-library") para sincronizarla entre dispositivos sin necesitar tablas
// nuevas: cloudListProjects la filtra y nunca la muestra como proyecto.
export const ASSET_LIBRARY_KIND = "asset-library";
export type AssetLibraryItem = { id: string; name: string; preset: unknown };

export function isAssetLibraryRow(data: unknown): boolean {
  return !!data && typeof data === "object" && (data as { __kind?: string }).__kind === ASSET_LIBRARY_KIND;
}

let libraryPushTimer: ReturnType<typeof setTimeout> | null = null;

/** Push diferido de la biblioteca de assets (mismo patrón que los proyectos). */
export function scheduleAssetLibraryPush(items: AssetLibraryItem[]) {
  if (typeof window === "undefined") return;
  if (libraryPushTimer) clearTimeout(libraryPushTimer);
  libraryPushTimer = setTimeout(() => { void pushAssetLibraryToCloud(items); }, 1500);
}

/** Sube la biblioteca completa como una única fila por cuenta (upsert). */
export async function pushAssetLibraryToCloud(items: AssetLibraryItem[]): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase.from("user_projects").select("id,data").eq("user_id", user.id);
    const rows = (data ?? []) as Array<{ id: string; data?: unknown }>;
    const row = rows.find(r => isAssetLibraryRow(r.data));
    const payload = { name: "__asternal_assets__", data: { __kind: ASSET_LIBRARY_KIND, items } as never };
    if (row) {
      await supabase.from("user_projects")
        .update({ name: payload.name, data: payload.data })
        .eq("id", (row as { id: string }).id).eq("user_id", user.id);
    } else {
      await supabase.from("user_projects").insert({ user_id: user.id, ...payload } as never);
    }
  } catch { /* sin sesión, esquema sin crear o red caída: silencioso */ }
}

/** Descarga la biblioteca de la nube (null si no existe, sin sesión o error). */
export async function pullAssetLibraryFromCloud(): Promise<AssetLibraryItem[] | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const { data } = await supabase.from("user_projects").select("data").eq("user_id", user.id);
    const rows = (data ?? []) as Array<{ data?: unknown }>;
    const row = rows.find(r => isAssetLibraryRow(r.data));
    if (!row) return null;
    const items = (row.data as { items?: AssetLibraryItem[] } | undefined)?.items;
    return Array.isArray(items) ? items : null;
  } catch { return null; }
}

/**
 * Sincronización completa en ambos sentidos:
 *  1. Sube a la nube los proyectos locales que aún no tienen cloudId (backup).
 *  2. Descarga e importa los proyectos de la nube que no existen en este
 *     dispositivo (para que aparezcan al entrar con la misma cuenta en otro
 *     dispositivo).
 * Devuelve cuántos se subieron y cuántos se importaron.
 */
export async function syncAllProjects(): Promise<{ pushed: number; imported: number }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { pushed: 0, imported: 0 };

  // 1) Leer primero la nube para comparar las copias ya vinculadas.
  // Se mantiene last-write-wins por proyecto, sin sobrescribir silenciosamente
  // una edición local que sea más nueva que la remota.
  let pushed = 0;
  let imported = 0;
  let remoteList: CloudProject[] = [];
  try { remoteList = await cloudListProjects(); } catch { remoteList = []; }
  const remoteById = new Map(remoteList.map(c => [c.id, c]));

  for (const m of listProjects()) {
    const p = loadProjectById(m.id);
    if (!p) continue;
    const cloudId = getProjectCloudId(m.id);
    const remote = cloudId ? remoteById.get(cloudId) : undefined;
    if (!cloudId) {
      if (isPristineDefault(p)) continue;
      try {
        const saved = await cloudSaveProject({ id: undefined, name: p.name || m.name, data: p });
        setProjectCloudId(m.id, saved.id, toMillis(saved.updated_at));
        pushed++;
      } catch { /* sigue con los demás proyectos */ }
      continue;
    }
    if (!remote) continue;

    const localMs = m.updatedAt;
    const remoteMs = toMillis(remote.updated_at);
    if (remoteMs > localMs + 1000) {
      saveProjectById(m.id, remote.data as Project);
      setProjectCloudId(m.id, remote.id, remoteMs);
      continue;
    }
    if (localMs > remoteMs + 1000) {
      try {
        const saved = await cloudSaveProject({ id: cloudId, name: p.name || m.name, data: p });
        setProjectCloudId(m.id, saved.id, toMillis(saved.updated_at));
        pushed++;
      } catch { /* conserva la copia local para el siguiente intento */ }
    } else if (getProjectCloudUpdatedAt(m.id) !== remoteMs) {
      setProjectCloudId(m.id, remote.id, remoteMs);
    }
  }

  // 2) Importar proyectos remotos que no existan en este dispositivo.
  try {
    const prevCurrent = getCurrentProjectId();
    for (const c of remoteList) {
      if (existsLocalWithCloud(c.id)) continue;
      const localId = createProject(c.name);
      saveProjectById(localId, c.data as Project);
      setProjectCloudId(localId, c.id, toMillis(c.updated_at));
      imported++;
    }
    const activated = await activateCloudProjectIfBlank();
    if (prevCurrent && !activated) setCurrentProjectId(prevCurrent);
  } catch { /* esquema sin crear / red caída: no se importa nada */ }

  return { pushed, imported };
}
