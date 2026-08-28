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

export type CloudProject = { id: string; name: string; data: unknown; updated_at: string | number | null };

// Cloud sync is disabled — projects are stored locally only.
export async function cloudListProjects(): Promise<CloudProject[]> {
  return [];
}

export async function cloudSaveProject(input: { id?: string | null; name: string; data: unknown }): Promise<CloudProject> {
  return { id: input.id ?? crypto.randomUUID(), name: input.name, data: input.data, updated_at: Date.now() };
}

export async function cloudDeleteProject(_id: string): Promise<void> {
  // No-op: local-only storage.
}

const pushTimers = new Map<string, ReturnType<typeof setTimeout>>();
const pendingPushes = new Map<string, Project>();
const activePushes = new Map<string, Promise<void>>();
const PROJECT_ID_FIELD = "__asternalProjectId";

export const CLOUD_SYNC_TIMEOUT_MS = 12_000;

function cloudProjectData(localId: string, project: Project): Project & { __asternalProjectId: string } {
  return { ...project, [PROJECT_ID_FIELD]: localId };
}

function cloudProjectLocalId(project: CloudProject): string | null {
  const value = (project.data as { __asternalProjectId?: unknown } | null)?.[PROJECT_ID_FIELD];
  return typeof value === "string" && value ? value : null;
}

/** Convierte cualquier operación de nube en una operación acotada y recuperable. */
export function withCloudTimeout<T>(promise: Promise<T>, label = "La sincronización tardó demasiado", timeoutMs = CLOUD_SYNC_TIMEOUT_MS): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(label)), timeoutMs);
    promise.then(value => { clearTimeout(timer); resolve(value); }, error => { clearTimeout(timer); reject(error); });
  });
}


/** Debounce por proyecto: cada autosave reemplaza el payload pendiente y nunca abre un insert paralelo. */
export function schedulePushToCloud(localId: string, project: Project) {
  if (typeof window === "undefined" || !localId) return;
  pendingPushes.set(localId, project);
  const previousTimer = pushTimers.get(localId);
  if (previousTimer) clearTimeout(previousTimer);
  pushTimers.set(localId, setTimeout(() => {
    pushTimers.delete(localId);
    void flushProjectPush(localId);
  }, 1500));
}

async function flushProjectPush(localId: string): Promise<void> {
  if (activePushes.has(localId)) return activePushes.get(localId);
  const run = (async () => {
    while (pendingPushes.has(localId)) {
      const project = pendingPushes.get(localId);
      pendingPushes.delete(localId);
      if (!project) continue;
      try {
        const cloudId = getProjectCloudId(localId);
        const saved = await cloudSaveProject({ id: cloudId, name: project.name || "Untitled Game", data: cloudProjectData(localId, project) });
        const remoteMs = toMillis(saved.updated_at);
        setProjectCloudId(localId, saved.id, remoteMs || Date.now());
      } catch { /* el siguiente cambio reintentará sin duplicar filas */ }
    }
  })().finally(() => {
    activePushes.delete(localId);
    if (pendingPushes.has(localId)) void flushProjectPush(localId);
  });
  activePushes.set(localId, run);
  return run;
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

/**
 * Elimina únicamente duplicados remotos exactos. No agrupa por nombre solo:
 * compara también el JSON del proyecto y conserva la fila más reciente.
 */
export async function deduplicateExactCloudProjects(): Promise<number> {
  const projects = await cloudListProjects();
  const seen = new Set<string>();
  const remove: CloudProject[] = [];
  for (const project of projects) {
    const signature = `${project.name}\u0000${JSON.stringify(project.data)}`;
    if (seen.has(signature)) remove.push(project);
    else seen.add(signature);
  }
  for (const project of remove) await cloudDeleteProject(project.id);
  return remove.length;
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
    const rows = await cloudListProjects() as Array<{ id: string; data?: unknown }>;
    const row = rows.find(r => isAssetLibraryRow(r.data));
    const payload = { name: "__asternal_assets__", data: { __kind: ASSET_LIBRARY_KIND, items } as never };
    if (row) {
      await cloudSaveProject({ id: row.id, ...payload });
    } else {
      await cloudSaveProject(payload);
    }
  } catch { /* sin sesión, esquema sin crear o red caída: silencioso */ }
}

/** Descarga la biblioteca de la nube (null si no existe, sin sesión o error). */
export async function pullAssetLibraryFromCloud(): Promise<AssetLibraryItem[] | null> {
  try {
    const rows = await cloudListProjects() as Array<{ data?: unknown }>;
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
  // 1) Leer primero la nube para comparar las copias ya vinculadas.
  // Se mantiene last-write-wins por proyecto, sin sobrescribir silenciosamente
  // una edición local que sea más nueva que la remota.
  let pushed = 0;
  let imported = 0;
  let remoteList: CloudProject[] = [];
  try { remoteList = await withCloudTimeout(cloudListProjects(), "La nube no respondió a tiempo"); } catch { remoteList = []; }
  const remoteById = new Map(remoteList.map(c => [c.id, c]));
  const remoteByLocalId = new Map(remoteList.map(c => [cloudProjectLocalId(c), c]).filter(([id]) => Boolean(id)) as Array<[string, CloudProject]>);

  for (const m of listProjects()) {
    const p = loadProjectById(m.id);
    if (!p) continue;
    let cloudId = getProjectCloudId(m.id);
    let remote = cloudId ? remoteById.get(cloudId) : undefined;
    if (!cloudId) {
      const identifiedRemote = remoteByLocalId.get(m.id);
      if (identifiedRemote) {
        cloudId = identifiedRemote.id;
        remote = identifiedRemote;
        setProjectCloudId(m.id, cloudId, toMillis(identifiedRemote.updated_at));
      }
    }
    if (!cloudId) {
      if (isPristineDefault(p)) continue;
      try {
        const saved = await withCloudTimeout(cloudSaveProject({ id: undefined, name: p.name || m.name, data: cloudProjectData(m.id, p) }), "No se pudo guardar el proyecto a tiempo");
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
        const saved = await withCloudTimeout(cloudSaveProject({ id: cloudId, name: p.name || m.name, data: cloudProjectData(m.id, p) }), "No se pudo actualizar el proyecto a tiempo");
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
