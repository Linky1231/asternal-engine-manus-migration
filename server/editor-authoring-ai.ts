import { invokeLLM, listLLMModels } from "./_core/llm";

type AuthoringOperation = Record<string, unknown> & { type: string };
type AuthoringPlan = { summary: string; assumptions: string[]; operations: AuthoringOperation[]; model?: string };
type AuthoringContext = { scene: Record<string, unknown>; groups: Array<Record<string, unknown>>; entities: Array<Record<string, unknown>> };

const kinds = ["player", "platform", "enemy", "coin", "goal", "decor"] as const;
const operationTypes = ["create_entity", "update_entity", "configure_behavior", "delete_entity", "move_entity", "create_group", "update_group", "delete_group", "update_scene"] as const;

const planSchema = {
  type: "object",
  properties: {
    summary: { type: "string" },
    assumptions: { type: "array", items: { type: "string" } },
    operations: {
      type: "array",
      items: {
        type: "object",
        properties: {
          type: { type: "string", enum: [...operationTypes] },
          targetId: { type: ["string", "null"] },
          entity: {
            type: ["object", "null"],
            properties: {
              kind: { type: ["string", "null"], enum: [...kinds, null] }, name: { type: ["string", "null"] }, x: { type: ["number", "null"] }, y: { type: ["number", "null"] }, w: { type: ["number", "null"] }, h: { type: ["number", "null"] }, color: { type: ["string", "null"] }, tags: { type: ["array", "null"], items: { type: "string" } }, groupId: { type: ["string", "null"] },
            }, required: ["kind", "name", "x", "y", "w", "h", "color", "tags", "groupId"], additionalProperties: false,
          },
          patch: {
            type: ["object", "null"],
            properties: {
              name: { type: ["string", "null"] }, tags: { type: ["array", "null"], items: { type: "string" } }, x: { type: ["number", "null"] }, y: { type: ["number", "null"] }, w: { type: ["number", "null"] }, h: { type: ["number", "null"] }, color: { type: ["string", "null"] }, solid: { type: ["boolean", "null"] }, gravity: { type: ["boolean", "null"] }, controllable: { type: ["boolean", "null"] }, collectible: { type: ["boolean", "null"] }, hazard: { type: ["boolean", "null"] }, goal: { type: ["boolean", "null"] }, visible: { type: ["boolean", "null"] }, opacity: { type: ["number", "null"] }, value: { type: ["number", "null"] }, z: { type: ["number", "null"] }, rotation: { type: ["number", "null"] }, scaleX: { type: ["number", "null"] }, scaleY: { type: ["number", "null"] }, bodyType: { type: ["string", "null"], enum: ["static", "dynamic", "kinematic", null] }, mass: { type: ["number", "null"] }, friction: { type: ["number", "null"] }, restitution: { type: ["number", "null"] }, collisionShape: { type: ["string", "null"], enum: ["rectangle", "circle", null] }, collisionLayer: { type: ["number", "null"] }, collisionMask: { type: ["number", "null"] }, isTrigger: { type: ["boolean", "null"] }, nameScene: { type: ["string", "null"] }, bg: { type: ["string", "null"] }, cameraMode: { type: ["string", "null"], enum: ["follow-player", "fixed", null] }, cameraX: { type: ["number", "null"] }, cameraY: { type: ["number", "null"] }, cameraDeadZone: { type: ["number", "null"] }, parentId: { type: ["string", "null"] },
            }, required: ["name", "tags", "x", "y", "w", "h", "color", "solid", "gravity", "controllable", "collectible", "hazard", "goal", "visible", "opacity", "value", "z", "rotation", "scaleX", "scaleY", "bodyType", "mass", "friction", "restitution", "collisionShape", "collisionLayer", "collisionMask", "isTrigger", "nameScene", "bg", "cameraMode", "cameraX", "cameraY", "cameraDeadZone", "parentId"], additionalProperties: false,
          },
          behavior: { type: ["string", "null"], enum: ["moving", "crumble", "spring", "patrol", "powerup", "switch", "door", null] },
          enabled: { type: ["boolean", "null"] },
          config: { type: ["object", "null"], properties: { axis: { type: ["string", "null"], enum: ["x", "y", null] }, range: { type: ["number", "null"] }, speed: { type: ["number", "null"] }, delay: { type: ["number", "null"] }, respawn: { type: ["number", "null"] }, force: { type: ["number", "null"] }, ledgeSafe: { type: ["boolean", "null"] }, powerup: { type: ["string", "null"], enum: ["speed", "djump", "invuln", null] }, switchId: { type: ["string", "null"] }, doorId: { type: ["string", "null"] } }, required: ["axis", "range", "speed", "delay", "respawn", "force", "ledgeSafe", "powerup", "switchId", "doorId"], additionalProperties: false },
        }, required: ["type", "targetId", "entity", "patch", "behavior", "enabled", "config"], additionalProperties: false,
      },
    },
  }, required: ["summary", "assumptions", "operations"], additionalProperties: false,
} as const;

function pick<T>(source: Record<string, unknown>, key: string): T | undefined { return source[key] === null || source[key] === undefined ? undefined : source[key] as T; }
function text(value: unknown, fallback = ""): string { return typeof value === "string" ? value.slice(0, 160) : fallback; }
function id(value: unknown): string | null { return typeof value === "string" && value.length <= 120 ? value : null; }

function normalizeOperation(input: unknown): AuthoringOperation | null {
  if (!input || typeof input !== "object") return null;
  const raw = input as Record<string, unknown>; const type = text(raw.type);
  const patchSource = (raw.patch && typeof raw.patch === "object" ? raw.patch : {}) as Record<string, unknown>;
  const patch = Object.fromEntries(Object.entries(patchSource).filter(([, value]) => value !== null)) as Record<string, unknown>;
  if (type === "create_entity") {
    const entity = raw.entity as Record<string, unknown> | null;
    if (!entity || !kinds.includes(entity.kind as typeof kinds[number])) return null;
    return { type, entity: { kind: entity.kind as typeof kinds[number], name: text(entity.name, entity.kind as string), x: Number(entity.x) || 0, y: Number(entity.y) || 0, w: Number(entity.w) || 32, h: Number(entity.h) || 32, color: text(entity.color, "#1e3a8a"), tags: Array.isArray(entity.tags) ? entity.tags.filter((tag): tag is string => typeof tag === "string").slice(0, 12) : [], groupId: id(entity.groupId) }, patch };
  }
  if (type === "update_entity" && id(raw.targetId)) return { type, targetId: id(raw.targetId)!, patch };
  if (type === "configure_behavior" && id(raw.targetId) && ["moving", "crumble", "spring", "patrol", "powerup", "switch", "door"].includes(text(raw.behavior))) {
    const config = (raw.config && typeof raw.config === "object" ? raw.config : {}) as Record<string, unknown>;
    return { type, targetId: id(raw.targetId)!, behavior: text(raw.behavior), enabled: raw.enabled === true, config: { axis: pick<"x" | "y">(config, "axis"), range: pick<number>(config, "range"), speed: pick<number>(config, "speed"), delay: pick<number>(config, "delay"), respawn: pick<number>(config, "respawn"), force: pick<number>(config, "force"), ledgeSafe: pick<boolean>(config, "ledgeSafe"), powerup: pick<"speed" | "djump" | "invuln">(config, "powerup"), switchId: pick<string>(config, "switchId"), doorId: pick<string>(config, "doorId") } };
  }
  if (type === "delete_entity" && id(raw.targetId)) return { type, targetId: id(raw.targetId)! };
  if (type === "move_entity" && id(raw.targetId)) return { type, targetId: id(raw.targetId)!, groupId: id(patch.parentId) };
  if (type === "create_group") return { type, name: text(patch.name, "Grupo"), parentId: id(patch.parentId) };
  if (type === "update_group" && id(raw.targetId)) return { type, targetId: id(raw.targetId)!, name: text(patch.name, "Grupo"), parentId: id(patch.parentId) };
  if (type === "delete_group" && id(raw.targetId)) return { type, targetId: id(raw.targetId)! };
  if (type === "update_scene") return { type, patch: { name: pick<string>(patch, "nameScene"), bg: pick<string>(patch, "bg"), gravity: pick<number>(patch, "value"), width: pick<number>(patch, "w"), height: pick<number>(patch, "h"), cameraMode: pick<"follow-player" | "fixed">(patch, "cameraMode"), cameraX: pick<number>(patch, "cameraX"), cameraY: pick<number>(patch, "cameraY"), cameraDeadZone: pick<number>(patch, "cameraDeadZone") } };
  return null;
}

export async function createAuthoringPlan(instruction: unknown, context: unknown): Promise<AuthoringPlan> {
  const request = text(instruction).trim();
  if (!request || request.length > 1600) throw new Error("Escribe una instrucción de entre 1 y 1600 caracteres.");
  if (!context || typeof context !== "object") throw new Error("Falta el contexto de la escena abierta.");
  const safeContext = context as AuthoringContext;
  const catalog = await listLLMModels();
  const model = catalog.data.some(item => item.id === "gpt-5") ? "gpt-5" : catalog.data.some(item => item.id === "gpt-5-mini") ? "gpt-5-mini" : catalog.data[0]?.id;
  if (!model) throw new Error("No hay un modelo de IA disponible para el editor.");
  const response = await invokeLLM({ model, temperature: 0.2, response_format: { type: "json_schema", json_schema: { name: "asternal_authoring_plan", strict: true, schema: planSchema as unknown as Record<string, unknown> } }, messages: [
    { role: "system", content: "Eres Asternal Authoring AI. Convierte la intención de un creador en operaciones seguras para una escena Canvas 2D. No escribes JavaScript, HTML, bloques ni scripts; el motor aplica solo operaciones JSON validadas. Usa exclusivamente IDs que existan en el contexto. Para crear objetos usa create_entity; para modificar usa update_entity. Para lógica de juego usa configure_behavior: moving, crumble, spring, patrol, powerup, switch o door. Conserva dimensiones y objetos salvo petición clara. Nunca elimines objetos si la instrucción no dice eliminar. Devuelve un plan breve y práctico." },
    { role: "user", content: JSON.stringify({ instruction: request, context: safeContext }) },
  ] });
  const content = response.choices?.[0]?.message?.content;
  if (!content) throw new Error("La IA no devolvió un plan para la escena.");
  let parsed: { summary?: unknown; assumptions?: unknown; operations?: unknown };
  try { parsed = JSON.parse(content); } catch { throw new Error("La IA devolvió una respuesta que no se pudo validar."); }
  const operations = Array.isArray(parsed.operations) ? parsed.operations.map(normalizeOperation).filter((operation): operation is AuthoringOperation => Boolean(operation)).slice(0, 40) : [];
  return { summary: text(parsed.summary, "Plan de cambios preparado."), assumptions: Array.isArray(parsed.assumptions) ? parsed.assumptions.filter((item): item is string => typeof item === "string").slice(0, 6) : [], operations, model };
}
