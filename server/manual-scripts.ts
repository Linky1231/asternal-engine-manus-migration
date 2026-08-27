import { invokeLLM, listLLMModels } from "./_core/llm";

const eventTypes = ["onStart", "onCreate", "onUpdate", "onCollide", "onKeyDown", "onScoreReach", "onDestroyed", "onDestroy", "onTimer", "onLeaveScreen", "onLand", "onWin", "onLose", "onMessage"] as const;
const entityKinds = ["player", "platform", "enemy", "coin", "goal", "decor"] as const;
const blockKinds = ["jump", "setVx", "setVy", "addScore", "destroySelf", "destroyOther", "win", "lose", "teleport", "log", "playSound", "vibrate", "shake", "setColor", "setSize", "setGravity", "setControllable", "impulse", "setVisible", "restartScene", "setBg", "setX", "setY", "moveX", "moveY", "flipVx", "flipVy", "bounceY", "stop", "setSpeed", "setOpacity", "setHazard", "setSolid", "setCollectible", "setGoalFlag", "addLives", "setLives", "setScore", "resetScore", "spawnEntity", "cloneSelf", "setSceneGravity", "playRandomSound", "wrapScreen", "faceTarget", "chase", "setHitbox", "clearHitbox", "removeAllOf", "comment", "hurtPlayer", "wait", "setFacing", "knockback", "pushAway", "setVariable", "changeVariable", "setProperty", "changeProperty", "broadcast"] as const;
const soundNames = ["blip", "coin", "jump", "hit", "win", "lose", "click"] as const;
const targets = ["self", "other", "scene"] as const;
const scopes = ["entity", "scene"] as const;
const properties = ["x", "y", "vx", "vy", "w", "h", "scaleX", "scaleY", "opacity", "rotation", "mass", "friction", "restitution", "collisionLayer", "collisionMask", "visible", "solid", "gravity", "controllable", "hazard", "collectible", "goal", "isTrigger"] as const;
const operators = ["eq", "neq", "gte", "lte"] as const;

type EventType = (typeof eventTypes)[number];
type EntityKind = (typeof entityKinds)[number];
type BlockKind = (typeof blockKinds)[number];
type ScriptTarget = (typeof targets)[number];
type VariableScope = (typeof scopes)[number];
type GenericProperty = (typeof properties)[number];
type VariableOperator = (typeof operators)[number];

export type ManualScriptBlock = {
  kind: BlockKind;
  value?: number;
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  text?: string;
  sound?: "blip" | "coin" | "jump" | "hit" | "win" | "lose" | "click";
  color?: string;
  bool?: boolean;
  cond?: "scoreGte" | "scoreLte";
  target?: ScriptTarget;
  scope?: VariableScope;
  property?: GenericProperty;
  operator?: VariableOperator;
  repeat?: number;
};

export type ManualScriptDraft = {
  summary: string;
  script: {
    event: EventType;
    withKind?: EntityKind | "any";
    key?: "left" | "right" | "jump";
    threshold?: number;
    interval?: number;
    message?: string;
    blocks: ManualScriptBlock[];
  };
};

let manualScriptModel: Promise<string> | undefined;

function includes<T extends string>(values: readonly T[], value: unknown): value is T {
  return typeof value === "string" && values.includes(value as T);
}

function optionalNumber(value: unknown, min = -100000, max = 100000): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : undefined;
}

function optionalText(value: unknown, maxLength = 500): string | undefined {
  if (typeof value !== "string") return undefined;
  const text = value.trim().slice(0, maxLength);
  return text || undefined;
}

function sanitizeBlock(value: unknown): ManualScriptBlock | undefined {
  if (!value || typeof value !== "object") return undefined;
  const raw = value as Record<string, unknown>;
  if (!includes(blockKinds, raw.kind)) return undefined;
  const block: ManualScriptBlock = { kind: raw.kind };
  const numericFields = ["value", "x", "y", "w", "h", "repeat"] as const;
  numericFields.forEach(field => {
    const number = optionalNumber(raw[field]);
    if (number !== undefined) block[field] = field === "repeat" ? Math.round(Math.max(0, Math.min(100, number))) : number;
  });
  const text = optionalText(raw.text);
  if (text) block.text = text;
  if (includes(soundNames, raw.sound)) block.sound = raw.sound;
  if (typeof raw.color === "string" && /^#[0-9a-fA-F]{6}$/.test(raw.color)) block.color = raw.color;
  if (typeof raw.bool === "boolean") block.bool = raw.bool;
  if (raw.cond === "scoreGte" || raw.cond === "scoreLte") block.cond = raw.cond;
  if (includes(targets, raw.target)) block.target = raw.target;
  if (includes(scopes, raw.scope)) block.scope = raw.scope;
  if (includes(properties, raw.property)) block.property = raw.property;
  if (includes(operators, raw.operator)) block.operator = raw.operator;
  return block;
}

/** Valida una propuesta externa antes de convertirla en un script que pueda ejecutar el runtime. */
export function sanitizeManualScriptDraft(value: unknown): ManualScriptDraft {
  if (!value || typeof value !== "object") throw new Error("La propuesta de script no tiene un formato válido.");
  const raw = value as { summary?: unknown; script?: unknown };
  if (!raw.script || typeof raw.script !== "object") throw new Error("La propuesta no contiene un script válido.");
  const script = raw.script as Record<string, unknown>;
  if (!includes(eventTypes, script.event)) throw new Error("La propuesta usa un evento no compatible.");
  const blocks = Array.isArray(script.blocks) ? script.blocks.map(sanitizeBlock).filter((block): block is ManualScriptBlock => Boolean(block)).slice(0, 24) : [];
  if (blocks.length === 0) throw new Error("La propuesta no contiene acciones que el motor pueda ejecutar.");
  const result: ManualScriptDraft = { summary: optionalText(raw.summary, 240) ?? "Script creado desde la descripción.", script: { event: script.event, blocks } };
  if (includes([...entityKinds, "any"] as const, script.withKind)) result.script.withKind = script.withKind;
  if (script.key === "left" || script.key === "right" || script.key === "jump") result.script.key = script.key;
  const threshold = optionalNumber(script.threshold, 0, 1000000);
  if (threshold !== undefined) result.script.threshold = threshold;
  const interval = optionalNumber(script.interval, 16, 600000);
  if (interval !== undefined) result.script.interval = interval;
  const message = optionalText(script.message, 120);
  if (message) result.script.message = message;
  return result;
}

async function getManualScriptModel(): Promise<string> {
  if (!manualScriptModel) {
    manualScriptModel = listLLMModels().then(({ data }) => {
      const ids = data.map(model => model.id);
      return ids.find(id => id === "gpt-5")
        ?? ids.find(id => id === "claude-sonnet-4-6")
        ?? ids.find(id => id === "gpt-5-mini")
        ?? ids[0]
        ?? "gpt-5-mini";
    });
  }
  return manualScriptModel;
}

const blockSchema = {
  type: "object",
  properties: {
    kind: { type: "string", enum: blockKinds }, value: { type: ["number", "null"] }, x: { type: ["number", "null"] }, y: { type: ["number", "null"] }, w: { type: ["number", "null"] }, h: { type: ["number", "null"] }, text: { type: ["string", "null"] }, sound: { type: ["string", "null"], enum: [...soundNames, null] }, color: { type: ["string", "null"] }, bool: { type: ["boolean", "null"] }, cond: { type: ["string", "null"], enum: ["scoreGte", "scoreLte", null] }, target: { type: ["string", "null"], enum: [...targets, null] }, scope: { type: ["string", "null"], enum: [...scopes, null] }, property: { type: ["string", "null"], enum: [...properties, null] }, operator: { type: ["string", "null"], enum: [...operators, null] }, repeat: { type: ["number", "null"] },
  },
  required: ["kind", "value", "x", "y", "w", "h", "text", "sound", "color", "bool", "cond", "target", "scope", "property", "operator", "repeat"],
  additionalProperties: false,
};

const responseSchema = {
  type: "object",
  properties: {
    summary: { type: "string" },
    script: {
      type: "object",
      properties: {
        event: { type: "string", enum: eventTypes }, withKind: { type: ["string", "null"], enum: [...entityKinds, "any", null] }, key: { type: ["string", "null"], enum: ["left", "right", "jump", null] }, threshold: { type: ["number", "null"] }, interval: { type: ["number", "null"] }, message: { type: ["string", "null"] }, blocks: { type: "array", minItems: 1, maxItems: 24, items: blockSchema },
      },
      required: ["event", "withKind", "key", "threshold", "interval", "message", "blocks"],
      additionalProperties: false,
    },
  },
  required: ["summary", "script"],
  additionalProperties: false,
};

export async function createManualScript(description: unknown, entityKind: unknown): Promise<ManualScriptDraft> {
  const request = optionalText(description, 1200);
  if (!request) throw new Error("Describe el comportamiento que debe tener el objeto.");
  if (!includes(entityKinds, entityKind)) throw new Error("El objeto seleccionado no es compatible con los scripts manuales.");
  const model = await getManualScriptModel();
  const response = await invokeLLM({
    model,
    temperature: 0.1,
    messages: [
      { role: "system", content: "Convierte una descripción de comportamiento de un objeto de Asternal en UN script compatible con su lenguaje de bloques. Devuelve exclusivamente JSON ajustado al esquema. Usa solo los eventos y bloques permitidos. No escribas TypeScript ni inventes APIs, archivos, entidades o bloques. Prioriza una secuencia breve, editable y determinista. No uses los bloques if, ifVariable o repeat porque esta primera versión de creación automática solo admite acciones planas." },
      { role: "user", content: `Objeto seleccionado: ${entityKind}.\nDescripción: ${request}` },
    ],
    response_format: { type: "json_schema", json_schema: { name: "manual_script", strict: true, schema: responseSchema } },
  });
  const content = response.choices?.[0]?.message?.content;
  if (!content) throw new Error("No se pudo crear el script en este momento.");
  try {
    return sanitizeManualScriptDraft(JSON.parse(content));
  } catch (error) {
    if (error instanceof Error && error.message !== "Unexpected end of JSON input") throw error;
    throw new Error("La propuesta de script no se pudo validar.");
  }
}
