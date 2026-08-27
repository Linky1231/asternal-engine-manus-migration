import { supabase } from "@/integrations/supabase/client";
import type { Entity } from "./core";

export type SourceFileSummary = { path: string; category: string; editable: boolean; sha256: string; size: number };
export type SourceVersion = { id: string; projectId: string; number: number; status: "base" | "candidate"; treeHash: string; createdAt: string; manifestKey: string; files: SourceFileSummary[] };
export type SourceFile = { path: string; content: string; sha256: string; editable: boolean; category: string };
export type SourceProposal = {
  id: string;
  projectId: string;
  versionId: string;
  createdAt: string;
  summary: string;
  capability: {
    id: string;
    name: string;
    scope: "project" | "editor";
    connections: Record<"engine" | "runtime" | "editor" | "persistence" | "gameUi" | "server", boolean>;
  };
  files: Array<{ path: string; operation: "create" | "update" | "delete"; purpose: string; content: string }>;
  warnings: string[];
};

async function request<T>(pathname: string, init: RequestInit): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error("Inicia sesión para usar Scripts manuales.");
  const response = await fetch(pathname, {
    ...init,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}`, ...(init.headers ?? {}) },
  });
  const payload = await response.json().catch(() => ({})) as T | { error?: string };
  const errorMessage = (payload as { error?: unknown }).error;
  if (!response.ok) throw new Error(typeof errorMessage === "string" && errorMessage ? errorMessage : "No se pudo completar la operación de código.");
  return payload as T;
}

export function ensureSourceVersion(projectId: string) {
  return request<SourceVersion>("/api/orion/source-version", { method: "POST", body: JSON.stringify({ projectId }) });
}

export function getSourceFile(projectId: string, versionId: string, filePath: string) {
  const query = new URLSearchParams({ projectId, versionId, path: filePath });
  return request<SourceFile>(`/api/orion/source-file?${query.toString()}`, { method: "GET" });
}

export function createSourceProposal(input: { projectId: string; versionId: string; description: string; entity: Pick<Entity, "id" | "kind" | "name" | "tags" | "variables"> }) {
  return request<SourceProposal>("/api/orion/source-proposal", { method: "POST", body: JSON.stringify(input) });
}

export function applySourceProposal(input: { projectId: string; versionId: string; proposalId: string }) {
  return request<SourceVersion>("/api/orion/source-apply", { method: "POST", body: JSON.stringify(input) });
}

export function createManualSourceProposal(input: { projectId: string; versionId: string; path: string; content: string }) {
  return request<SourceProposal>("/api/orion/source-edit", { method: "POST", body: JSON.stringify(input) });
}

export function listSourceProposals(projectId: string) {
  return request<Array<Omit<SourceProposal, "files">>>(`/api/orion/source-proposals?${new URLSearchParams({ projectId }).toString()}`, { method: "GET" });
}
