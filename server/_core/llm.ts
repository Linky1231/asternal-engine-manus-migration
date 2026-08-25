import { chatCompletionEndpoint, resolveAIProvider } from "../ai-provider";

export type LLMTextContent = { type: "text"; text: string };
export type LLMImageContent = { type: "image_url"; image_url: { url: string; detail?: "auto" | "low" | "high" } };

export type LLMMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: string | Array<LLMTextContent | LLMImageContent>;
};

export type LLMRequest = {
  model?: string;
  messages: LLMMessage[];
  temperature?: number;
};

/** Invoca Orión desde el servidor mediante la IA integrada de Manus. */
export async function invokeLLM(request: LLMRequest) {
  const provider = resolveAIProvider();
  const response = await fetch(`${provider.baseUrl}/v1/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${provider.apiKey}` },
    body: JSON.stringify({ ...request, model: request.model ?? provider.model }),
  });
  if (!response.ok) throw new Error(`La IA integrada de Manus no respondió (${response.status}).`);
  return response.json() as Promise<{ choices?: Array<{ message?: { content?: string } }>; model?: string }>;
}

/** Lista los modelos de Manus sin exponer credenciales al cliente. */
export async function listLLMModels() {
  const provider = resolveAIProvider();
  const response = await fetch(`${provider.baseUrl}/v1/models`, { headers: { Authorization: `Bearer ${provider.apiKey}` } });
  if (!response.ok) throw new Error("No se pudo consultar el catálogo de modelos de Manus.");
  return response.json() as Promise<{ data: Array<{ id: string }> }>;
}
