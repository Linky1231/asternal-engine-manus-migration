import type { EntityKind } from "./core";
import type { Block, Script } from "./scripts";

export type ManualScriptBlock = Omit<Block, "id" | "thenBlocks" | "elseBlocks">;

export type ManualScriptDraft = {
  summary: string;
  script: Omit<Script, "id" | "blocks"> & { blocks: ManualScriptBlock[] };
};

export async function createManualScript(description: string, entityKind: EntityKind): Promise<ManualScriptDraft> {
  const response = await fetch("/api/orion/manual-script", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ description, entityKind }),
  });
  const payload = await response.json().catch(() => ({})) as ManualScriptDraft | { error?: string };
  if (!response.ok || !("script" in payload)) {
    throw new Error("error" in payload && payload.error ? payload.error : "No se pudo crear el script.");
  }
  return payload;
}
