import { createHash, randomUUID } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { invokeLLM, listLLMModels } from "./_core/llm";
import { storageGetSignedUrl, storagePut } from "./storage";
import { createManusRecord, listOwnManusRecords } from "./manus-records";

const SOURCE_VERSION_KIND = "asternal-source-version";
const SOURCE_PROPOSAL_KIND = "asternal-source-proposal";
const MAX_SOURCE_FILE_BYTES = 180_000;
const MAX_PROPOSAL_FILES = 6;
const SOURCE_ROOTS = [
  { relative: "src/lib/engine", category: "motor", editable: true },
  { relative: "src/components/engine", category: "editor", editable: true },
  { relative: "src/lib/ai", category: "integración", editable: true },
  { relative: "src/lib/social", category: "persistencia", editable: true },
  { relative: "server/capabilities", category: "servicio", editable: true },
] as const;
const CREATE_PREFIXES = ["src/lib/engine/capabilities/", "src/components/engine/capabilities/", "server/capabilities/"];

export type SourceFileSummary = { path: string; category: string; editable: boolean; sha256: string; size: number };
type SourceManifestFile = SourceFileSummary & { contentKey: string };
type SourceManifest = { schemaVersion: 1; treeHash: string; files: SourceManifestFile[] };
export type SourceVersion = {
  id: string;
  projectId: string;
  number: number;
  status: "base" | "candidate";
  treeHash: string;
  createdAt: string;
  manifestKey: string;
  files: SourceFileSummary[];
};
export type SourceProposal = {
  id: string;
  projectId: string;
  versionId: string;
  createdAt: string;
  summary: string;
  capability: { id: string; name: string; scope: "project" | "editor"; connections: Record<"engine" | "runtime" | "editor" | "persistence" | "gameUi" | "server", boolean> };
  files: Array<{ path: string; operation: "create" | "update" | "delete"; purpose: string; content: string }>;
  warnings: string[];
};

type InternalSourceRecord = { id: string; data: unknown; createdAt: Date; updatedAt: Date };
type StoredVersionRecord = { __kind: typeof SOURCE_VERSION_KIND; sourceVersion: Omit<SourceVersion, "files"> };
type StoredProposalRecord = { __kind: typeof SOURCE_PROPOSAL_KIND; sourceProposal: Omit<SourceProposal, "files"> & { proposalKey: string } };

let sourceModel: Promise<string> | undefined;

function hash(value: string) { return createHash("sha256").update(value).digest("hex"); }
function cleanProjectId(value: unknown) {
  const id = typeof value === "string" ? value.trim() : "";
  if (!id || id.length > 128) throw new Error("El proyecto seleccionado no es válido.");
  return id;
}
function cleanText(value: unknown, maximum: number) {
  const text = typeof value === "string" ? value.trim().slice(0, maximum) : "";
  return text || undefined;
}
function sourceKey(ownerId: string, projectId: string) {
  return `${hash(ownerId).slice(0, 20)}/${hash(projectId).slice(0, 20)}`;
}
function isSourceFile(name: string) { return /\.(?:ts|tsx|css)$/i.test(name) && !/\.test\.[cm]?[jt]sx?$/i.test(name); }
function isSafeSourcePath(value: unknown) {
  return typeof value === "string" && value.length > 0 && value.length <= 180 && !value.includes("\\") && !value.includes("..") && /^(?:src|server)\/[A-Za-z0-9_./-]+\.(?:ts|tsx|css)$/.test(value);
}

export function isInternalSourceRecord(data: unknown): boolean {
  if (!data || typeof data !== "object") return false;
  const kind = (data as { __kind?: unknown }).__kind;
  return kind === SOURCE_VERSION_KIND || kind === SOURCE_PROPOSAL_KIND;
}

export function canWriteSourcePath(filePath: unknown, knownFiles: SourceFileSummary[]): boolean {
  if (!isSafeSourcePath(filePath)) return false;
  const existing = knownFiles.find(file => file.path === filePath);
  return Boolean(existing?.editable) || CREATE_PREFIXES.some(prefix => String(filePath).startsWith(prefix));
}

function toVersion(record: InternalSourceRecord): SourceVersion | undefined {
  const data = record.data as Partial<StoredVersionRecord> | null;
  if (data?.__kind !== SOURCE_VERSION_KIND || !data.sourceVersion) return undefined;
  return { ...data.sourceVersion, files: [] };
}

async function listInternalRecords(ownerId: string): Promise<InternalSourceRecord[]> {
  const records = await listOwnManusRecords(ownerId, "source-internal");
  return records.filter(record => isInternalSourceRecord(record.data));
}

async function insertInternalRecord(ownerId: string, name: string, data: StoredVersionRecord | StoredProposalRecord) {
  const record = await createManusRecord({
    id: randomUUID(),
    collection: "source-internal",
    ownerOpenId: ownerId,
    data: { ...data, label: name },
  });
  if (!record) throw new Error("No se pudo guardar la versión privada.");
  return record;
}

async function walkSourceDirectory(absolute: string, relative: string, category: string, editable: boolean, collected: Array<{ path: string; content: string; category: string; editable: boolean }>) {
  try {
    const entries = await readdir(absolute, { withFileTypes: true, encoding: "utf8" });
    for (const entry of entries) {
      const nextRelative = `${relative}/${entry.name}`;
      const nextAbsolute = path.join(absolute, entry.name);
      if (entry.isDirectory()) {
        await walkSourceDirectory(nextAbsolute, nextRelative, category, editable, collected);
        continue;
      }
      if (!entry.isFile() || !isSourceFile(entry.name)) continue;
      const content = await readFile(nextAbsolute, "utf8");
      if (Buffer.byteLength(content) > MAX_SOURCE_FILE_BYTES) continue;
      collected.push({ path: nextRelative, content, category, editable });
    }
  } catch { return; }
}

async function captureBaseManifest(ownerId: string, projectId: string, versionId: string): Promise<{ manifest: SourceManifest; manifestKey: string }> {
  const files: Array<{ path: string; content: string; category: string; editable: boolean }> = [];
  for (const root of SOURCE_ROOTS) {
    await walkSourceDirectory(path.join(process.cwd(), root.relative), root.relative, root.category, root.editable, files);
  }
  files.sort((a, b) => a.path.localeCompare(b.path));
  if (!files.length) throw new Error("No se pudo obtener el código fuente base del editor.");
  const prefix = `asternal-source/${sourceKey(ownerId, projectId)}/${versionId}`;
  const manifestFiles: SourceManifestFile[] = [];
  for (const file of files) {
    const stored = await storagePut(`${prefix}/files/${encodeURIComponent(file.path)}`, file.content, "text/plain; charset=utf-8");
    manifestFiles.push({ path: file.path, category: file.category, editable: file.editable, sha256: hash(file.content), size: Buffer.byteLength(file.content), contentKey: stored.key });
  }
  const manifest: SourceManifest = { schemaVersion: 1, treeHash: hash(manifestFiles.map(file => `${file.path}:${file.sha256}`).join("\n")), files: manifestFiles };
  const storedManifest = await storagePut(`${prefix}/manifest.json`, JSON.stringify(manifest), "application/json");
  return { manifest, manifestKey: storedManifest.key };
}

async function readManifest(manifestKey: string): Promise<SourceManifest> {
  const signedUrl = await storageGetSignedUrl(manifestKey);
  const response = await fetch(signedUrl);
  const manifest = await response.json().catch(() => null) as SourceManifest | null;
  if (!response.ok || !manifest || manifest.schemaVersion !== 1 || !Array.isArray(manifest.files)) throw new Error("La versión de código no se pudo leer.");
  return manifest;
}

async function findVersion(ownerId: string, projectId: string, versionId?: string): Promise<SourceVersion | undefined> {
  const records = await listInternalRecords(ownerId);
  const versions = records.map(toVersion).filter((item): item is SourceVersion => Boolean(item && item.projectId === projectId));
  const version = versionId ? versions.find(item => item.id === versionId) : versions.sort((a, b) => b.number - a.number)[0];
  if (!version) return undefined;
  const manifest = await readManifest(version.manifestKey);
  return { ...version, files: manifest.files.map(({ contentKey: _contentKey, ...file }) => file) };
}

export async function ensureSourceVersion(ownerId: string, rawProjectId: unknown): Promise<SourceVersion> {
  const projectId = cleanProjectId(rawProjectId);
  const existing = await findVersion(ownerId, projectId);
  if (existing) return existing;
  const id = randomUUID();
  const { manifest, manifestKey } = await captureBaseManifest(ownerId, projectId, id);
  const version: Omit<SourceVersion, "files"> = { id, projectId, number: 1, status: "base", treeHash: manifest.treeHash, createdAt: new Date().toISOString(), manifestKey };
  await insertInternalRecord(ownerId, `Código interno · ${projectId.slice(0, 36)}`, { __kind: SOURCE_VERSION_KIND, sourceVersion: version });
  return { ...version, files: manifest.files.map(({ contentKey: _contentKey, ...file }) => file) };
}

export async function getSourceFile(ownerId: string, rawProjectId: unknown, rawVersionId: unknown, rawPath: unknown) {
  const projectId = cleanProjectId(rawProjectId);
  const versionId = cleanText(rawVersionId, 80);
  if (!versionId || !isSafeSourcePath(rawPath)) throw new Error("El archivo solicitado no es válido.");
  const version = await findVersion(ownerId, projectId, versionId);
  if (!version) throw new Error("La versión solicitada no pertenece a este proyecto.");
  const manifest = await readManifest(version.manifestKey);
  const file = manifest.files.find(item => item.path === rawPath);
  if (!file) throw new Error("El archivo solicitado no pertenece a esta versión.");
  const signedUrl = await storageGetSignedUrl(file.contentKey);
  const response = await fetch(signedUrl);
  const content = await response.text();
  if (!response.ok || hash(content) !== file.sha256) throw new Error("No se pudo verificar el archivo solicitado.");
  return { path: file.path, content, sha256: file.sha256, editable: file.editable, category: file.category };
}

function normalizedConnections(value: unknown): SourceProposal["capability"]["connections"] {
  const raw = value && typeof value === "object" ? value as Record<string, unknown> : {};
  return { engine: Boolean(raw.engine), runtime: Boolean(raw.runtime), editor: Boolean(raw.editor), persistence: Boolean(raw.persistence), gameUi: Boolean(raw.gameUi), server: Boolean(raw.server) };
}

export function sanitizeSourceProposal(value: unknown, ownerId: string, projectId: string, versionId: string, knownFiles: SourceFileSummary[]): SourceProposal {
  if (!value || typeof value !== "object") throw new Error("La propuesta de código no tiene un formato válido.");
  const raw = value as Record<string, unknown>;
  const rawCapability = raw.capability && typeof raw.capability === "object" ? raw.capability as Record<string, unknown> : {};
  const rawFiles = Array.isArray(raw.files) ? raw.files.slice(0, MAX_PROPOSAL_FILES) : [];
  const files = rawFiles.map(item => {
    const file = item && typeof item === "object" ? item as Record<string, unknown> : {};
    const filePath = cleanText(file.path, 180);
    const operation = file.operation === "create" || file.operation === "update" || file.operation === "delete" ? file.operation : undefined;
    const purpose = cleanText(file.purpose, 320);
    const content = cleanText(file.content, 28_000);
    if (!filePath || !operation || !purpose || (operation !== "delete" && !content) || !canWriteSourcePath(filePath, knownFiles)) return undefined;
    if (operation === "create" && !CREATE_PREFIXES.some(prefix => filePath.startsWith(prefix))) return undefined;
    return { path: filePath, operation, purpose, content: content ?? "" };
  }).filter((item): item is SourceProposal["files"][number] => Boolean(item));
  if (!files.length) throw new Error("La propuesta no contiene cambios de código permitidos.");
  const capabilityId = (cleanText(rawCapability.id, 60) ?? "capacidad").toLowerCase().replace(/[^a-z0-9_-]/g, "-").replace(/^-+|-+$/g, "") || "capacidad";
  const capabilityName = cleanText(rawCapability.name, 100) ?? "Nueva capacidad";
  const scope = rawCapability.scope === "editor" ? "editor" : "project";
  const warnings = Array.isArray(raw.warnings) ? raw.warnings.map(item => cleanText(item, 240)).filter((item): item is string => Boolean(item)).slice(0, 8) : [];
  return {
    id: randomUUID(), projectId, versionId, createdAt: new Date().toISOString(),
    summary: cleanText(raw.summary, 500) ?? "Cambio interno de código preparado.",
    capability: { id: capabilityId, name: capabilityName, scope, connections: normalizedConnections(rawCapability.connections) },
    files, warnings,
  };
}

async function persistSourceProposal(ownerId: string, proposal: SourceProposal) {
  const stored = await storagePut(`asternal-source/${sourceKey(ownerId, proposal.projectId)}/${proposal.versionId}/proposals/${proposal.id}.json`, JSON.stringify(proposal), "application/json");
  const { files: _files, ...summary } = proposal;
  await insertInternalRecord(ownerId, `Cambio interno · ${proposal.capability.name.slice(0, 36)}`, { __kind: SOURCE_PROPOSAL_KIND, sourceProposal: { ...summary, proposalKey: stored.key } });
  return proposal;
}

async function getSourceModel() {
  if (!sourceModel) sourceModel = listLLMModels().then(({ data }) => {
    const ids = data.map(model => model.id);
    return ids.find(id => id === "gpt-5") ?? ids.find(id => id === "claude-sonnet-4-6") ?? ids.find(id => id === "gpt-5-mini") ?? ids[0] ?? "gpt-5-mini";
  });
  return sourceModel;
}

const proposalSchema = {
  type: "object",
  properties: {
    summary: { type: "string" },
    capability: {
      type: "object",
      properties: {
        id: { type: "string" }, name: { type: "string" }, scope: { type: "string", enum: ["project", "editor"] },
        connections: { type: "object", properties: { engine: { type: "boolean" }, runtime: { type: "boolean" }, editor: { type: "boolean" }, persistence: { type: "boolean" }, gameUi: { type: "boolean" }, server: { type: "boolean" } }, required: ["engine", "runtime", "editor", "persistence", "gameUi", "server"], additionalProperties: false },
      }, required: ["id", "name", "scope", "connections"], additionalProperties: false,
    },
    files: { type: "array", minItems: 1, maxItems: MAX_PROPOSAL_FILES, items: { type: "object", properties: { path: { type: "string" }, operation: { type: "string", enum: ["create", "update", "delete"] }, purpose: { type: "string" }, content: { type: "string" } }, required: ["path", "operation", "purpose", "content"], additionalProperties: false } },
    warnings: { type: "array", maxItems: 8, items: { type: "string" } },
  },
  required: ["summary", "capability", "files", "warnings"], additionalProperties: false,
};

export async function createSourceProposal(ownerId: string, input: { projectId?: unknown; versionId?: unknown; description?: unknown; entity?: unknown }) {
  const projectId = cleanProjectId(input.projectId);
  const description = cleanText(input.description, 1600);
  if (!description) throw new Error("Describe la capacidad que debe crear el código interno.");
  const version = await ensureSourceVersion(ownerId, projectId);
  if (input.versionId && input.versionId !== version.id) throw new Error("La versión abierta cambió. Vuelve a cargar el código antes de proponer cambios.");
  const essential = await Promise.all(version.files.filter(file => ["src/lib/engine/core.ts", "src/components/engine/GameRuntime.tsx", "src/components/engine/AsternalEditor.tsx"].includes(file.path)).map(file => getSourceFile(ownerId, projectId, version.id, file.path)));
  const model = await getSourceModel();
  const response = await invokeLLM({
    model,
    temperature: 0.1,
    messages: [
      { role: "system", content: "Genera una propuesta de CAMBIOS DE CÓDIGO FUENTE para Asternal. No crees bloques, eventos de bloques, intérpretes ni pseudo-código. Debes proponer archivos TypeScript/TSX reales. Para cada archivo de creación o actualización devuelve el CONTENIDO COMPLETO que quedará en ese archivo, no un diff ni una explicación. Para borrado usa contenido vacío. Usa solo rutas existentes editables o crea archivos en src/lib/engine/capabilities/, src/components/engine/capabilities/ o server/capabilities/. Conecta la capacidad con motor, runtime, editor, persistencia, interfaz de juego o servidor cuando sea necesario. No uses secretos, dependencias nuevas, comandos, rutas server/_core ni código de otras cuentas. Devuelve solo JSON ajustado al esquema." },
      { role: "user", content: `Solicitud: ${description}\nContexto seleccionado: ${JSON.stringify(input.entity ?? null).slice(0, 2400)}\nArchivos editables: ${version.files.filter(file => file.editable).map(file => file.path).join(", ")}\nCódigo esencial:\n${essential.map(file => `--- ${file.path} ---\n${file.content.slice(0, 12000)}`).join("\n")}` },
    ],
    response_format: { type: "json_schema", json_schema: { name: "source_change_proposal", strict: true, schema: proposalSchema } },
  });
  const content = response.choices?.[0]?.message?.content;
  if (!content) throw new Error("No se pudo preparar el cambio de código en este momento.");
  let proposal: SourceProposal;
  try { proposal = sanitizeSourceProposal(JSON.parse(content), ownerId, projectId, version.id, version.files); }
  catch (error) { throw error instanceof Error ? error : new Error("No se pudo validar la propuesta de código."); }
  return persistSourceProposal(ownerId, proposal);
}

export async function createManualSourceProposal(ownerId: string, input: { projectId?: unknown; versionId?: unknown; path?: unknown; content?: unknown }) {
  const projectId = cleanProjectId(input.projectId);
  const versionId = cleanText(input.versionId, 80);
  const filePath = cleanText(input.path, 180);
  const content = cleanText(input.content, 28_000);
  if (!versionId || !filePath || content === undefined) throw new Error("Falta el archivo o el contenido de la edición.");
  const version = await findVersion(ownerId, projectId, versionId);
  if (!version) throw new Error("La versión seleccionada no pertenece a este proyecto.");
  if (!canWriteSourcePath(filePath, version.files)) throw new Error("Este archivo no se puede editar en la versión privada.");
  const proposal: SourceProposal = {
    id: randomUUID(), projectId, versionId: version.id, createdAt: new Date().toISOString(),
    summary: `Edición manual preparada para ${filePath}.`,
    capability: { id: "edicion-manual", name: "Edición manual", scope: "project", connections: { engine: filePath.includes("engine/"), runtime: filePath.includes("GameRuntime"), editor: filePath.includes("components/engine"), persistence: filePath.includes("storage") || filePath.includes("social"), gameUi: filePath.includes("Runtime") || filePath.includes("UIEditor"), server: filePath.startsWith("server/") } },
    files: [{ path: filePath, operation: "update", purpose: "Aplica la edición manual del creador.", content }], warnings: [],
  };
  return persistSourceProposal(ownerId, proposal);
}

async function findProposal(ownerId: string, projectId: string, proposalId: string): Promise<{ proposal: SourceProposal; proposalKey: string }> {
  const records = await listInternalRecords(ownerId);
  const matching = records.map(record => record.data as Partial<StoredProposalRecord> | null).find(data =>
    data?.__kind === SOURCE_PROPOSAL_KIND && data.sourceProposal?.projectId === projectId && data.sourceProposal.id === proposalId,
  );
  const proposalKey = matching?.sourceProposal?.proposalKey;
  if (!proposalKey) throw new Error("El cambio solicitado no pertenece a este proyecto.");
  const signedUrl = await storageGetSignedUrl(proposalKey);
  const response = await fetch(signedUrl);
  const proposal = await response.json().catch(() => null) as SourceProposal | null;
  if (!response.ok || !proposal || proposal.id !== proposalId || proposal.projectId !== projectId) throw new Error("No se pudo verificar el cambio de código.");
  return { proposal, proposalKey };
}

export async function applySourceProposal(ownerId: string, input: { projectId?: unknown; versionId?: unknown; proposalId?: unknown }): Promise<SourceVersion> {
  const projectId = cleanProjectId(input.projectId);
  const versionId = cleanText(input.versionId, 80);
  const proposalId = cleanText(input.proposalId, 80);
  if (!versionId || !proposalId) throw new Error("Falta la versión o el cambio que se debe aplicar.");
  const baseVersion = await findVersion(ownerId, projectId, versionId);
  if (!baseVersion) throw new Error("La versión base no pertenece a este proyecto.");
  const { proposal } = await findProposal(ownerId, projectId, proposalId);
  if (proposal.versionId !== baseVersion.id) throw new Error("El cambio fue creado para otra versión del código.");
  const baseManifest = await readManifest(baseVersion.manifestKey);
  const baseFiles = new Map(baseManifest.files.map(file => [file.path, file]));
  const nextId = randomUUID();
  const prefix = `asternal-source/${sourceKey(ownerId, projectId)}/${nextId}`;
  for (const change of proposal.files) {
    if (!canWriteSourcePath(change.path, baseVersion.files)) throw new Error(`La ruta ${change.path} no está autorizada.`);
    if (change.operation === "update" && !baseFiles.has(change.path)) throw new Error(`El archivo ${change.path} no existe en la versión base.`);
    if (change.operation === "create" && baseFiles.has(change.path)) throw new Error(`El archivo ${change.path} ya existe en la versión base.`);
    if (change.operation === "delete") baseFiles.delete(change.path);
    else {
      const previous = baseFiles.get(change.path);
      const stored = await storagePut(`${prefix}/files/${encodeURIComponent(change.path)}`, change.content, "text/plain; charset=utf-8");
      baseFiles.set(change.path, {
        path: change.path,
        category: previous?.category ?? (change.path.includes("components") ? "editor" : change.path.includes("server") ? "servicio" : "motor"),
        editable: true,
        sha256: hash(change.content),
        size: Buffer.byteLength(change.content),
        contentKey: stored.key,
      });
    }
  }
  const files = [...baseFiles.values()].sort((a, b) => a.path.localeCompare(b.path));
  const manifest: SourceManifest = { schemaVersion: 1, treeHash: hash(files.map(file => `${file.path}:${file.sha256}`).join("\n")), files };
  const storedManifest = await storagePut(`${prefix}/manifest.json`, JSON.stringify(manifest), "application/json");
  const records = await listInternalRecords(ownerId);
  const number = records.map(toVersion).filter((item): item is SourceVersion => Boolean(item && item.projectId === projectId)).reduce((maximum, item) => Math.max(maximum, item.number), 0) + 1;
  const candidate: Omit<SourceVersion, "files"> = { id: nextId, projectId, number, status: "candidate", treeHash: manifest.treeHash, createdAt: new Date().toISOString(), manifestKey: storedManifest.key };
  await insertInternalRecord(ownerId, `Versión candidata · ${proposal.capability.name.slice(0, 32)}`, { __kind: SOURCE_VERSION_KIND, sourceVersion: candidate });
  return { ...candidate, files: files.map(({ contentKey: _contentKey, ...file }) => file) };
}

export async function listSourceProposals(ownerId: string, rawProjectId: unknown): Promise<Array<Omit<SourceProposal, "files">>> {
  const projectId = cleanProjectId(rawProjectId);
  const records = await listInternalRecords(ownerId);
  return records.flatMap(record => {
    const data = record.data as Partial<StoredProposalRecord> | null;
    if (data?.__kind !== SOURCE_PROPOSAL_KIND || !data.sourceProposal || data.sourceProposal.projectId !== projectId) return [];
    const { proposalKey: _proposalKey, ...proposal } = data.sourceProposal;
    return [proposal];
  }).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
