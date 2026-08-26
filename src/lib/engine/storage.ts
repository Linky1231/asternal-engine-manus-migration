import { supabase } from "@/integrations/supabase/client";
import type { Project } from "./core";
import { DEFAULT_SETTINGS, newProject, uid } from "./core";

const LEGACY_KEY = "asternal:project";
const LEGACY_INDEX_KEY = "asternal:projects:index";
const LEGACY_CURRENT_KEY = "asternal:projects:current";
const LEGACY_ITEM_PREFIX = "asternal:projects:item:";
const LEGACY_ADOPTED_KEY = "asternal:projects:legacy-adopted:v1";
const FPS_60_MIGRATION_KEY = "asternal:fps60-migration:v2";

let storageOwner = "anonymous";
let storageInitialized = false;

export interface ProjectMeta {
  id: string;
  name: string;
  updatedAt: number;
  cloudId?: string;
  cloudUpdatedAt?: number;
}

/**
 * Identificador estable y seguro para construir claves locales por cuenta.
 * No contiene correo ni datos personales: Supabase user.id es el namespace.
 */
export function storageNamespaceFor(ownerId: string | null | undefined): string {
  const value = ownerId?.trim();
  if (!value) return "anonymous";
  return value.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 96) || "anonymous";
}

export function getStorageOwner(): string | null {
  return storageOwner === "anonymous" ? null : storageOwner;
}

export function getStorageNamespaceKey(suffix: string): string {
  const safeSuffix = suffix.replace(/[^a-zA-Z0-9:_-]/g, "_");
  if (storageOwner === "anonymous") return `asternal:${safeSuffix}`;
  return `asternal:account:${storageOwner}:${safeSuffix}`;
}

function key(suffix: string): string {
  return getStorageNamespaceKey(suffix);
}

function indexKey(): string { return key("projects:index"); }
function currentKey(): string { return key("projects:current"); }
function itemKey(id: string): string { return key(`projects:item:${id}`); }

function parseIndex(raw: string | null): ProjectMeta[] {
  try {
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.filter(x => x && typeof x.id === "string").map(x => ({
      id: x.id,
      name: typeof x.name === "string" ? x.name : "Untitled Game",
      updatedAt: Number.isFinite(Number(x.updatedAt)) ? Number(x.updatedAt) : 0,
      ...(typeof x.cloudId === "string" ? { cloudId: x.cloudId } : {}),
      ...(Number.isFinite(Number(x.cloudUpdatedAt)) ? { cloudUpdatedAt: Number(x.cloudUpdatedAt) } : {}),
    }));
  } catch { return []; }
}

function readIndex(): ProjectMeta[] {
  try { return parseIndex(localStorage.getItem(indexKey())); } catch { return []; }
}

function writeIndex(items: ProjectMeta[]) {
  localStorage.setItem(indexKey(), JSON.stringify(items));
}

function readLegacyIndex(): ProjectMeta[] {
  try { return parseIndex(localStorage.getItem(LEGACY_INDEX_KEY)); } catch { return []; }
}

function writeLegacyIndex(items: ProjectMeta[]) {
  localStorage.setItem(LEGACY_INDEX_KEY, JSON.stringify(items));
}

function normalize(p: Project): Project {
  if (!p.scenes?.length) return newProject();
  if (!p.assets) p.assets = { sprites: [] };
  if (!p.assets.sprites) p.assets.sprites = [];
  p.settings = { ...DEFAULT_SETTINGS, ...(p.settings ?? {}) };
  if (!p.settings.perfOptimized) p.settings = { ...p.settings, fpsCap: 60, perfOptimized: true };
  if (!p.settings.fpsDefault60Applied) p.settings = { ...p.settings, fpsCap: 60, fpsDefault60Applied: true };
  return p;
}

function migrateLegacyProject() {
  if (readLegacyIndex().length > 0) return;
  try {
    const raw = localStorage.getItem(LEGACY_KEY);
    if (!raw) return;
    const p = normalize(JSON.parse(raw));
    const id = uid();
    localStorage.setItem(LEGACY_ITEM_PREFIX + id, JSON.stringify(p));
    writeLegacyIndex([{ id, name: p.name || "Untitled Game", updatedAt: Date.now() }]);
    localStorage.setItem(LEGACY_CURRENT_KEY, id);
  } catch { /* ignore */ }
}

/**
 * La primera cuenta autenticada adopta una sola vez los proyectos creados antes
 * de que existiera el aislamiento por cuenta. Después se elimina el índice
 * global para que otra cuenta del mismo navegador no pueda leerlo.
 */
function adoptLegacyForOwner(owner: string) {
  if (owner === "anonymous" || localStorage.getItem(LEGACY_ADOPTED_KEY) === "1") return;
  migrateLegacyProject();
  if (readIndex().length > 0) return;
  const legacy = readLegacyIndex();
  if (!legacy.length) {
    localStorage.setItem(LEGACY_ADOPTED_KEY, "1");
    return;
  }
  try {
    for (const meta of legacy) {
      const raw = localStorage.getItem(LEGACY_ITEM_PREFIX + meta.id);
      if (raw) localStorage.setItem(itemKey(meta.id), raw);
    }
    writeIndex(legacy);
    const current = localStorage.getItem(LEGACY_CURRENT_KEY);
    if (current && legacy.some(x => x.id === current)) localStorage.setItem(currentKey(), current);
    localStorage.removeItem(LEGACY_INDEX_KEY);
    localStorage.removeItem(LEGACY_CURRENT_KEY);
    localStorage.removeItem(LEGACY_KEY);
    for (const meta of legacy) localStorage.removeItem(LEGACY_ITEM_PREFIX + meta.id);
    localStorage.setItem(LEGACY_ADOPTED_KEY, "1");
  } catch { /* conservar la copia legacy si el navegador no permite migrar */ }
}

/** Cambia el namespace local activo; se llama al iniciar o cambiar la sesión. */
export function setStorageOwner(ownerId: string | null | undefined): void {
  if (typeof window === "undefined") return;
  const next = storageNamespaceFor(ownerId);
  if (storageOwner === next && storageInitialized) return;
  storageOwner = next;
  storageInitialized = true;
  adoptLegacyForOwner(next);
}

/** Inicializa el namespace desde la sesión actual sin exponer credenciales. */
export async function initializeStorageOwner(): Promise<string | null> {
  if (typeof window === "undefined") return null;
  try {
    const { data: { user } } = await supabase.auth.getUser();
    setStorageOwner(user?.id ?? null);
    return user?.id ?? null;
  } catch {
    setStorageOwner(null);
    return null;
  }
}

export function setProjectCloudId(id: string, cloudId: string, cloudUpdatedAt?: number) {
  if (typeof window === "undefined") return;
  const idx = readIndex();
  const i = idx.findIndex(m => m.id === id);
  if (i >= 0) {
    idx[i] = { ...idx[i], cloudId, ...(cloudUpdatedAt ? { cloudUpdatedAt } : {}) };
    writeIndex(idx);
  }
}

export function getProjectCloudId(id: string): string | undefined {
  if (typeof window === "undefined") return undefined;
  return readIndex().find(m => m.id === id)?.cloudId;
}

export function getProjectCloudUpdatedAt(id: string): number | undefined {
  if (typeof window === "undefined") return undefined;
  return readIndex().find(m => m.id === id)?.cloudUpdatedAt;
}

function ensureAtLeastOne(): string {
  migrateLegacyProject();
  let idx = readIndex();
  if (idx.length === 0) {
    const id = uid();
    const p = newProject();
    localStorage.setItem(itemKey(id), JSON.stringify(p));
    idx = [{ id, name: p.name, updatedAt: Date.now() }];
    writeIndex(idx);
    localStorage.setItem(currentKey(), id);
  }
  let cur = localStorage.getItem(currentKey());
  if (!cur || !idx.some(m => m.id === cur)) {
    cur = idx[0].id;
    localStorage.setItem(currentKey(), cur);
  }
  return cur;
}

export function listProjects(): ProjectMeta[] {
  if (typeof window === "undefined") return [];
  ensureAtLeastOne();
  return readIndex().sort((a, b) => b.updatedAt - a.updatedAt);
}

export function getCurrentProjectId(): string {
  if (typeof window === "undefined") return "";
  return ensureAtLeastOne();
}

export function setCurrentProjectId(id: string) {
  if (typeof window === "undefined") return;
  if (readIndex().some(m => m.id === id)) localStorage.setItem(currentKey(), id);
}

export function loadProjectById(id: string): Project | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(itemKey(id));
    if (!raw) return null;
    const p = normalize(JSON.parse(raw));
    const migrationKey = key("fps60-migration:v2");
    if (!localStorage.getItem(migrationKey)) {
      p.settings = { ...p.settings, fpsCap: 60 };
      localStorage.setItem(migrationKey, "1");
    }
    return p;
  } catch { return null; }
}

export function loadProject(): Project {
  if (typeof window === "undefined") return newProject();
  const id = ensureAtLeastOne();
  return loadProjectById(id) ?? newProject();
}

export function saveProject(p: Project) {
  if (typeof window === "undefined") return;
  const id = ensureAtLeastOne();
  saveProjectById(id, p);
}

export function saveProjectById(id: string, p: Project) {
  if (typeof window === "undefined") return;
  try {
    const savedAt = Date.now();
    localStorage.setItem(itemKey(id), JSON.stringify(p));
    const idx = readIndex();
    const i = idx.findIndex(m => m.id === id);
    const prev = i >= 0 ? idx[i] : undefined;
    const meta: ProjectMeta = {
      id,
      name: p.name || "Untitled Game",
      updatedAt: savedAt,
      ...(prev?.cloudId ? { cloudId: prev.cloudId } : {}),
      ...(prev?.cloudUpdatedAt ? { cloudUpdatedAt: prev.cloudUpdatedAt } : {}),
    };
    if (i >= 0) idx[i] = meta; else idx.push(meta);
    writeIndex(idx);
  } catch { /* quota */ }
}

export function createProject(name?: string): string {
  const id = uid();
  const p = newProject();
  if (name && name.trim()) p.name = name.trim();
  saveProjectById(id, p);
  setCurrentProjectId(id);
  return id;
}

export function deduplicateExactLocalProjects(): number {
  if (typeof window === "undefined") return 0;
  const index = readIndex();
  const seen = new Map<string, ProjectMeta>();
  const removeIds = new Set<string>();
  for (const meta of [...index].sort((a, b) => b.updatedAt - a.updatedAt)) {
    const project = loadProjectById(meta.id);
    if (!project) continue;
    const signature = `${meta.name}\u0000${JSON.stringify(project)}`;
    if (seen.has(signature)) removeIds.add(meta.id);
    else seen.set(signature, meta);
  }
  if (!removeIds.size) return 0;
  for (const id of removeIds) localStorage.removeItem(itemKey(id));
  writeIndex(index.filter(meta => !removeIds.has(meta.id)));
  ensureAtLeastOne();
  return removeIds.size;
}

export function deleteProjectById(id: string) {
  if (typeof window === "undefined") return;
  localStorage.removeItem(itemKey(id));
  const idx = readIndex().filter(m => m.id !== id);
  writeIndex(idx);
  if (localStorage.getItem(currentKey()) === id) localStorage.removeItem(currentKey());
  ensureAtLeastOne();
}

export function renameProject(id: string, name: string) {
  const p = loadProjectById(id);
  if (!p) return;
  p.name = name.trim() || p.name;
  saveProjectById(id, p);
}

export function duplicateProject(id: string): string | null {
  const p = loadProjectById(id);
  if (!p) return null;
  const copy: Project = JSON.parse(JSON.stringify(p));
  copy.name = (p.name || "Untitled") + " copy";
  const newId = uid();
  saveProjectById(newId, copy);
  return newId;
}
