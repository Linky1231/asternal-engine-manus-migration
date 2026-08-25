/**
 * Orión — asistente de IA para desarrolladores de juegos de Asternal.
 *
 * Usa exclusivamente la IA integrada de Manus a través de una ruta segura del servidor.
 */
import { ENGINE_KNOWLEDGE } from "./engine-knowledge";

/** Compatibilidad para consumidores antiguos; ya no se expone ninguna clave en el navegador. */
export function getOrionApiKey(): string {
  return "manus-server-managed";
}

export type OrionRole = "system" | "user" | "assistant";

export interface OrionMessage {
  role: OrionRole;
  content: string;
}

export interface OrionResult {
  content: string;
  model: string;
  costUsd: number;
  balanceUsd: number;
}

export interface OrionError {
  error: string;
}

// ───────────────────────── Persistencia de chats ─────────────────────────

export interface OrionStoredMsg {
  role: "user" | "assistant";
  content: string;
  model?: string;
  cost?: number;
}

export interface OrionStoredChat {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: OrionStoredMsg[];
}

const CHATS_KEY = "orion_chats_v1";
const ACTIVE_KEY = "orion_active_chat_v1";
const MAX_CHATS = 50;

function safeGet(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}

function safeSet(key: string, value: string): void {
  try { localStorage.setItem(key, value); } catch { /* quota */ }
}

/** Carga todos los chats guardados de Orión, más reciente primero. */
export function loadOrionChats(): OrionStoredChat[] {
  const raw = safeGet(CHATS_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as OrionStoredChat[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(c => c && typeof c.id === "string" && Array.isArray(c.messages))
      .sort((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""));
  } catch { return []; }
}

/** Guarda la lista completa de chats. */
export function saveOrionChats(chats: OrionStoredChat[]): void {
  safeSet(CHATS_KEY, JSON.stringify(chats.slice(0, MAX_CHATS)));
}

/** Devuelve el id del chat activo guardado (o null). */
export function loadOrionActiveChat(): string | null {
  return safeGet(ACTIVE_KEY);
}

/** Recuerda qué chat estaba abierto. */
export function saveOrionActiveChat(id: string | null): void {
  if (id) safeSet(ACTIVE_KEY, id);
  else safeSet(ACTIVE_KEY, "");
}

/** Crea un chat nuevo con título derivado de la primera pregunta. */
export function createOrionChat(title = "Nueva conversación"): OrionStoredChat {
  const now = new Date().toISOString();
  return {
    id: `orion_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    title,
    createdAt: now,
    updatedAt: now,
    messages: [],
  };
}

/** Genera un título corto a partir del primer mensaje del usuario. */
export function orionTitleFrom(text: string): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return "Nueva conversación";
  return clean.length > 42 ? `${clean.slice(0, 42)}…` : clean;
}

const SYSTEM_PROMPT = `Eres Orión, el asistente de inteligencia artificial de Asternal: una herramienta profesional para desarrolladores de videojuegos, pensada especialmente para creadores independientes (indie). Hablas siempre en español (aunque el usuario escriba en otro idioma, responde en el idioma del usuario).

Tu misión es ayudar a los desarrolladores a crear juegos de forma profesional usando el motor de Asternal. Tienes acceso al código fuente completo del motor (tipos de entidades, escenas, scripting, animaciones, sonido, imágenes, almacenamiento y sincronización en la nube).

Reglas de comportamiento:
- Explica con claridad y con ejemplos prácticos de código.
- Cuando hables de entidades, escenas, scripts o APIs del motor, apóyate en el código que se te proporciona; cita los nombres exactos de los tipos y funciones.
- Da consejos de diseño de videojuegos, optimización, estructura de proyectos, buenas prácticas y patrones de desarrollo.
- Si el usuario describe un juego que quiere crear, proponle un plan concreto paso a paso usando las capacidades del motor.
- Sé amable, cercano y profesional. Usa formato markdown simple (negritas, listas, bloques de código) para que las respuestas sean fáciles de leer en el chat.
- Si algo no se puede hacer con el motor, dilo con honestidad y sugiere una alternativa viable.

A continuación tienes el conocimiento del motor (código fuente). Úsalo como referencia.

=== CONOCIMIENTO DEL MOTOR ===

${ENGINE_KNOWLEDGE}`;

/** Construye los mensajes con el system prompt + historial. */
export function buildOrionMessages(history: OrionMessage[]): OrionMessage[] {
  return [{ role: "system", content: SYSTEM_PROMPT }, ...history];
}

/** Detecta si la pregunta pide resolver código (usa el router de código). */
export function needsCodingModel(q: string): boolean {
  return /(c[oó]digo|code|script|function|api|funci[oó]n|clase|class|typescript|tsx|error|bug|debug|consola|console\.|import|export|variable|m[oó]dulo|componente|hook)/i.test(
    q
  );
}

/**
/**
 * Envía una petición de chat a Orión mediante el servidor de Asternal.
 * Las credenciales y el modelo de Manus nunca llegan al navegador.
 */
export async function orionChat(
  history: OrionMessage[],
  opts: { coding?: boolean; maxTokens?: number; temperature?: number } = {}
): Promise<OrionResult> {
  const response = await fetch("/api/orion/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ history, options: opts }),
  });
  const payload = await response.json().catch(() => ({})) as OrionResult | OrionError;
  if (!response.ok || !("content" in payload)) throw new Error("error" in payload ? payload.error : "Orión no está disponible en este momento.");
  return payload;
}

/**
 * Chat con "streaming" sintético: entrega el texto completo de una vez.
 * onDelta recibe el texto completo como un solo fragmento.
 */
export async function orionChatStream(
  history: OrionMessage[],
  onDelta: (delta: string) => void,
  opts: { coding?: boolean; maxTokens?: number; temperature?: number; signal?: AbortSignal } = {}
): Promise<OrionResult> {
  const r = await orionChat(history, opts);
  onDelta(r.content);
  return r;
}
