export type AIProviderMode = "external" | "manus";

export type AIProviderSettings = {
  mode: AIProviderMode;
  baseUrl: string;
  apiKey: string;
  model: string;
};

type Environment = Record<string, string | undefined>;

function value(env: Environment, key: string) {
  return env[key]?.trim() || undefined;
}

function normalizeBaseUrl(baseUrl: string) {
  return baseUrl.replace(/\/+$/, "");
}

/**
 * Resuelve Orión exclusivamente contra la IA integrada de Manus. Las variables
 * ORION_AI_* heredadas se ignoran para que la migración no desvíe los flujos
 * existentes de publicación, revisión, reordenamiento ni chat a otro proveedor.
 */
export function resolveAIProvider(env: Environment = process.env): AIProviderSettings {
  const forgeUrl = value(env, "BUILT_IN_FORGE_API_URL");
  const forgeKey = value(env, "BUILT_IN_FORGE_API_KEY");
  if (!forgeUrl || !forgeKey) {
    throw new Error("Orión no está configurado. Define BUILT_IN_FORGE_API_URL y BUILT_IN_FORGE_API_KEY en el servidor.");
  }

  return {
    mode: "manus",
    baseUrl: normalizeBaseUrl(forgeUrl),
    apiKey: forgeKey,
    model: "gpt-5-mini",
  };
}

export function chatCompletionEndpoint(baseUrl: string) {
  const normalized = normalizeBaseUrl(baseUrl);
  return normalized.endsWith("/chat/completions") ? normalized : `${normalized}/chat/completions`;
}
