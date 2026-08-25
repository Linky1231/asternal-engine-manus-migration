import { buildOrionMessages, type OrionMessage, type OrionResult } from "../src/lib/ai/orion";
import { invokeLLM, listLLMModels } from "./_core/llm";

let selectedModel: Promise<string> | undefined;

export async function getOrionModel() {
  if (!selectedModel) {
    selectedModel = listLLMModels().then(({ data }) => {
      const ids = data.map(({ id }) => id);
      return ids.find(id => id === "gpt-5-mini")
        ?? ids.find(id => id.startsWith("claude-haiku"))
        ?? ids.find(id => id.startsWith("gpt-5"))
        ?? ids[0]
        ?? "gpt-5-mini";
    });
  }
  return selectedModel;
}

export function sanitizeHistory(history: unknown): OrionMessage[] {
  if (!Array.isArray(history)) return [];
  return history.slice(-24).flatMap((item): OrionMessage[] => {
    if (!item || typeof item !== "object") return [];
    const message = item as { role?: unknown; content?: unknown };
    if ((message.role !== "user" && message.role !== "assistant") || typeof message.content !== "string") return [];
    const content = message.content.trim().slice(0, 6000);
    return content ? [{ role: message.role, content }] : [];
  });
}

/** Ejecuta una consulta a Orión en el servidor mediante el proveedor configurado. */
export async function completeOrionChat(history: unknown, options?: { temperature?: unknown }): Promise<OrionResult> {
  const cleanHistory = sanitizeHistory(history);
  if (!cleanHistory.some(message => message.role === "user")) throw new Error("Escribe un mensaje para Orión.");
  const model = await getOrionModel();
  const temperature = typeof options?.temperature === "number" ? Math.max(0, Math.min(1, options.temperature)) : 0.35;
  const response = await invokeLLM({ model, messages: buildOrionMessages(cleanHistory), temperature });
  const content = response.choices?.[0]?.message?.content?.trim();
  if (!content) throw new Error("El proveedor de IA configurado no devolvió una respuesta para Orión.");
  return { content, model: response.model ?? model, costUsd: 0, balanceUsd: 0 };
}
