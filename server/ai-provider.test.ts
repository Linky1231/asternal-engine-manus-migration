import { describe, expect, it } from "vitest";
import { chatCompletionEndpoint, resolveAIProvider } from "./ai-provider";

describe("configuración de Orión en Manus", () => {
  it("usa la IA integrada de Manus aunque existan variables externas heredadas", () => {
    const provider = resolveAIProvider({
      ORION_AI_BASE_URL: "https://provider.example/v1/",
      ORION_AI_API_KEY: "clave-secreta",
      ORION_AI_MODEL: "modelo-portable",
      BUILT_IN_FORGE_API_URL: "https://forge.example/",
      BUILT_IN_FORGE_API_KEY: "clave-integrada",
    });

    expect(provider).toEqual({
      mode: "manus",
      baseUrl: "https://forge.example",
      apiKey: "clave-integrada",
      model: "gpt-5-mini",
    });
    expect(chatCompletionEndpoint(provider.baseUrl)).toBe("https://forge.example/chat/completions");
  });

  it("requiere la configuración integrada de Manus", () => {
    expect(() => resolveAIProvider({ ORION_AI_API_KEY: "clave-incompleta" })).toThrow("BUILT_IN_FORGE_API_URL");
  });

  it("mantiene el modelo integrado configurado", () => {
    const provider = resolveAIProvider({
      BUILT_IN_FORGE_API_URL: "https://forge.example/",
      BUILT_IN_FORGE_API_KEY: "clave-integrada",
    });

    expect(provider.mode).toBe("manus");
    expect(provider.baseUrl).toBe("https://forge.example");
    expect(provider.model).toBe("gpt-5-mini");
  });
});
