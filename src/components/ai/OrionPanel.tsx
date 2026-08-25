import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, Send, Sparkles, Loader2, Trash2, Bot, Rocket, HelpCircle, Plus, MessageSquare, ChevronDown, Check, Zap,
} from "lucide-react";
import { orionChatStream, needsCodingModel, type OrionMessage } from "@/lib/ai/orion";
import {
  loadOrionChats,
  saveOrionChats,
  loadOrionActiveChat,
  saveOrionActiveChat,
  createOrionChat,
  orionTitleFrom,
  type OrionStoredChat,
  type OrionStoredMsg,
} from "@/lib/ai/orion";

/** Renders texto con bloques de código y markdown básico sin dependencias. */
function RichText({ text }: { text: string }) {
  const blocks = text.split(/(```[\s\S]*?```)/g);
  return (
    <div className="space-y-1.5 text-[13px] leading-relaxed whitespace-pre-wrap break-words">
      {blocks.map((b, i) => {
        if (b.startsWith("```")) {
          const code = b.replace(/^```\w*\n?/, "").replace(/\n?```$/, "");
          return (
            <pre
              key={i}
              className="bg-muted/70 border border-border rounded-lg p-2.5 text-[11px] leading-relaxed overflow-x-auto font-mono"
            >
              {code}
            </pre>
          );
        }
        return <p key={i}>{b}</p>;
      })}
    </div>
  );
}

const QUICK_PROMPTS = [
  "¿Cómo funciona el motor de Asternal? Explícamelo",
  "Quiero crear un juego de plataformas: ¿por dónde empiezo?",
  "¿Qué puedo hacer con los scripts del motor?",
  "¿Cómo se crean escenas y personajes?",
];

const WELCOME = `¡Hola! 👋 Soy **Orión**, tu asistente de desarrollo de juegos.\n\nConozco a fondo el **motor de Asternal** (entidades, escenas, scripting, animaciones, sonido y nube). Estoy aquí para ayudarte a crear tu juego de forma profesional, paso a paso.\n\nPregúntame lo que quieras: cómo funciona el motor, ideas para tu juego, o cómo resolver algo concreto. 🚀`;

export default function OrionPanel({ onClose }: { onClose: () => void }) {
  const [chats, setChats] = useState<OrionStoredChat[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [balance, setBalance] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const busyRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const messagesRef = useRef<OrionStoredMsg[]>([]);

  const activeChat = useMemo(
    () => chats.find(c => c.id === activeId) ?? null,
    [chats, activeId]
  );
  const messages = activeChat?.messages ?? [];

  // Sincroniza el ref con los mensajes del chat activo para el envío.
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // Restaura chats guardados al abrir el panel.
  useEffect(() => {
    const saved = loadOrionChats();
    if (saved.length) {
      setChats(saved);
      const last = loadOrionActiveChat();
      const target = saved.find(c => c.id === last) ?? saved[0];
      setActiveId(target.id);
    } else {
      const fresh = createOrionChat();
      setChats([fresh]);
      setActiveId(fresh.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persiste los chats en cada cambio.
  useEffect(() => {
    if (!chats.length) return;
    saveOrionChats(chats);
  }, [chats]);

  useEffect(() => {
    if (activeId) saveOrionActiveChat(activeId);
  }, [activeId]);

  // Cancela la petición en curso si se cierra el panel.
  useEffect(() => {
    return () => { abortRef.current?.abort(); };
  }, []);

  const scrollBottom = useCallback(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, []);

  useEffect(() => {
    scrollBottom();
  }, [messages, busy, scrollBottom]);

  useEffect(() => {
    taRef.current?.focus();
  }, [activeId]);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    busyRef.current = false;
    setBusy(false);
  }, []);

  const patchActiveMessages = useCallback((fn: (prev: OrionStoredMsg[]) => OrionStoredMsg[]) => {
    setChats(prev => prev.map(c => (c.id === activeId ? { ...c, messages: fn(c.messages), updatedAt: new Date().toISOString() } : c)));
  }, [activeId]);

  const send = useCallback(
    async (text: string) => {
      const q = text.trim();
      if (!q || busyRef.current || !activeId) return;
      busyRef.current = true;
      setBusy(true);
      setErr(null);
      patchActiveMessages(prev => [...prev, { role: "user", content: q }]);
      // Burbuja de respuesta vacía: se va rellenando en vivo con el streaming.
      patchActiveMessages(prev => [...prev, { role: "assistant", content: "" }]);
      setInput("");
      // Título del chat con la primera pregunta (solo si aún no tiene título propio).
      setChats(prev => prev.map(c => {
        if (c.id !== activeId) return c;
        const userCount = c.messages.filter(m => m.role === "user").length;
        if (userCount <= 1 && (c.title === "Nueva conversación" || c.title === "Conversación")) {
          return { ...c, title: orionTitleFrom(q) };
        }
        return c;
      }));
      const controller = new AbortController();
      abortRef.current = controller;
      try {
        const history: OrionMessage[] = messagesRef.current
          .filter((m) => m.role !== "assistant" || m.content !== WELCOME)
          .concat({ role: "user", content: q })
          .map((m) => ({ role: m.role, content: m.content }));
        const res = await orionChatStream(
          history,
          (delta) => {
            patchActiveMessages(prev => {
              const next = [...prev];
              const last = next[next.length - 1];
              if (last && last.role === "assistant") {
                next[next.length - 1] = { ...last, content: last.content + delta };
              }
              return next;
            });
          },
          {
            coding: needsCodingModel(q),
            signal: controller.signal,
          }
        );
        patchActiveMessages(prev => {
          const next = [...prev];
          const last = next[next.length - 1];
          if (last && last.role === "assistant") {
            next[next.length - 1] = {
              ...last,
              content: res.content || last.content,
              model: res.model,
              cost: res.costUsd,
            };
          }
          return next;
        });
        if (res.balanceUsd > 0) setBalance(res.balanceUsd);
      } catch (e) {
        // Si el usuario detuvo el stream, no mostrar error.
        if ((e as Error).name === "AbortError") return;
        patchActiveMessages(prev => {
          const next = [...prev];
          const last = next[next.length - 1];
          if (last && last.role === "assistant" && !last.content) {
            next.pop();
          }
          return next;
        });
        setErr(e instanceof Error ? e.message : "Ocurrió un error inesperado.");
      } finally {
        abortRef.current = null;
        busyRef.current = false;
        setBusy(false);
        taRef.current?.focus();
      }
    },
    [activeId, patchActiveMessages]
  );

  const newChat = useCallback(() => {
    stop();
    const fresh = createOrionChat();
    setChats(prev => [fresh, ...prev]);
    setActiveId(fresh.id);
    setErr(null);
    setPickerOpen(false);
    setInput("");
    setTimeout(() => taRef.current?.focus(), 50);
  }, [stop]);

  const deleteChat = useCallback((id: string) => {
    if (busyRef.current) stop();
    const next = chats.filter(c => c.id !== id);
    if (id === activeId) {
      const fallback = next[0] ?? createOrionChat();
      setChats(next.length ? next : [fallback]);
      setActiveId(fallback.id);
    } else {
      setChats(next);
    }
    setErr(null);
  }, [chats, activeId, stop]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className="fixed inset-0 z-[90] bg-background flex flex-col"
      style={{ height: "100dvh" }}
    >
      {/* Cabecera */}
      <header className="shrink-0 border-b border-border/60 bg-background">
        <div className="max-w-2xl md:max-w-3xl mx-auto flex items-center gap-2.5 px-4 py-3">
          <div
            className="relative shrink-0 rounded-full grid place-items-center text-primary-foreground"
            style={{
              width: 42,
              height: 42,
              padding: 2,
              background: "var(--color-primary)",
              boxShadow: "0 4px 16px -6px oklch(0.55 0.15 262/0.5)",
            }}
          >
            <div
              className="w-full h-full rounded-full grid place-items-center"
              style={{ background: "var(--gradient-asternal)" }}
            >
              <Bot size={19} strokeWidth={2.2} className="drop-shadow-[0_1px_2px_rgba(0,0,0,0.25)]" />
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[15px] leading-tight font-semibold flex items-center gap-1.5">
              Orión
              <span className="shrink-0 text-[8px] font-display tracking-widest px-1.5 py-0.5 rounded-md bg-primary/10 text-primary border border-primary/20">
                ASISTENTE IA
              </span>
            </div>
            <div className="text-[10px] text-muted-foreground truncate flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
              Ayuda profesional para crear juegos · motor de Asternal
              {balance !== null && (
                <span className="ml-1 text-[9px] font-mono text-muted-foreground/70">
                  · saldo ${balance.toFixed(2)}
                </span>
              )}
            </div>
          </div>

          {/* Selector de chats */}
          <div className="relative shrink-0">
            <button
              onClick={() => setPickerOpen(o => !o)}
              className="flex items-center gap-1.5 max-w-[140px] sm:max-w-[200px] rounded-xl border border-border/70 bg-card px-2.5 py-1.5 active:scale-95 transition text-left"
              title="Cambiar de conversación"
            >
              <MessageSquare size={13} className="text-primary shrink-0" />
              <span className="text-[11px] font-medium truncate flex-1">
                {activeChat?.title ?? "Conversación"}
              </span>
              <ChevronDown size={12} className="text-muted-foreground shrink-0" />
            </button>
            <AnimatePresence>
              {pickerOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -6, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -6, scale: 0.97 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 top-full mt-1.5 w-64 rounded-2xl border border-border bg-card shadow-xl overflow-hidden z-30"
                >
                  <div className="flex items-center justify-between px-3 py-2 border-b border-border/50">
                    <span className="text-[9px] font-display tracking-widest text-muted-foreground">
                      CONVERSACIONES
                    </span>
                    <span className="text-[9px] font-mono text-muted-foreground/60">{chats.length}</span>
                  </div>
                  <div className="max-h-56 overflow-y-auto no-scrollbar py-1">
                    {chats.map(c => (
                      <button
                        key={c.id}
                        onClick={() => {
                          setActiveId(c.id);
                          setPickerOpen(false);
                          setErr(null);
                          stop();
                        }}
                        className={`w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-muted/40 transition ${
                          c.id === activeId ? "bg-primary/[0.06]" : ""
                        }`}
                      >
                        <MessageSquare size={12} className={`shrink-0 ${c.id === activeId ? "text-primary" : "text-muted-foreground/60"}`} />
                        <span className="flex-1 min-w-0">
                          <span className="block text-[11px] font-medium truncate">{c.title}</span>
                          <span className="block text-[9px] font-mono text-muted-foreground/50 truncate">
                            {c.messages.length} mensaje{c.messages.length !== 1 ? "s" : ""} ·{" "}
                            {new Date(c.updatedAt).toLocaleDateString("es", { day: "numeric", month: "short" })}
                          </span>
                        </span>
                        {c.id === activeId && <Check size={12} className="text-primary shrink-0" />}
                        <button
                          onClick={(e) => { e.stopPropagation(); deleteChat(c.id); }}
                          className="p-1 rounded-md text-muted-foreground/50 hover:text-rose-500 hover:bg-rose-500/10 transition shrink-0"
                          title="Eliminar conversación"
                        >
                          <Trash2 size={11} />
                        </button>
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <button
            onClick={newChat}
            title="Nueva conversación"
            className="w-9 h-9 rounded-xl border border-border/70 bg-card grid place-items-center active:scale-95 transition shrink-0 text-primary hover:border-primary/40"
          >
            <Plus size={15} />
          </button>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl border border-border/70 bg-background grid place-items-center active:scale-95 transition shrink-0"
          >
            <X size={16} />
          </button>
        </div>
      </header>

      {/* Mensajes */}
      <div className="flex-1 overflow-y-auto no-scrollbar">
        <div className="max-w-2xl md:max-w-3xl mx-auto px-4 py-4 space-y-4">
          {messages.length === 0 && !busy && (
            <div className="flex flex-col items-center justify-center pt-10 pb-4 text-center">
              <div
                className="w-16 h-16 rounded-full grid place-items-center text-primary-foreground mb-3"
                style={{ background: "var(--gradient-asternal)", boxShadow: "0 8px 30px -8px oklch(0.55 0.15 262/0.5)" }}
              >
                <Bot size={28} />
              </div>
              <div className="font-display text-sm font-semibold">Nueva conversación</div>
              <div className="text-[11px] text-muted-foreground max-w-[240px] mt-1">
                Pregúntale a Orión sobre el motor, tu juego o cómo resolver algo concreto.
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-md mt-5">
                {QUICK_PROMPTS.map((p) => (
                  <button
                    key={p}
                    onClick={() => void send(p)}
                    className="text-left px-3 py-2.5 rounded-xl border border-border bg-card hover:border-primary/40 hover:bg-primary/[0.04] active:scale-[0.98] transition text-[11px] text-muted-foreground hover:text-foreground flex items-start gap-2"
                  >
                    <Sparkles size={12} className="text-primary shrink-0 mt-0.5" />
                    <span>{p}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m, i) => {
            // La burbuja vacía es solo el marcador del streaming (se rellena en
            // vivo con los deltas). No se pinta: evita duplicar el indicador
            // «Orión está escribiendo…» mientras responde.
            if (m.role === "assistant" && !m.content) return null;
            return (
              <div key={i} className={`flex gap-2 ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                {m.role === "assistant" && (
                  <div
                    className="shrink-0 rounded-full grid place-items-center text-primary-foreground"
                    style={{ width: 28, height: 28, background: "var(--gradient-asternal)" }}
                  >
                    <Bot size={14} />
                  </div>
                )}
                <div
                  className={`max-w-[82%] rounded-2xl px-3.5 py-2.5 shadow-sm ${
                    m.role === "user"
                      ? "bg-primary text-primary-foreground rounded-br-md shadow-sm shadow-primary/25"
                      : "bg-card border border-border rounded-bl-md"
                  }`}
                >
                  <RichText text={m.content} />
                  {m.model && (
                    <div className="mt-1.5 flex items-center gap-1 text-[8px] font-mono text-muted-foreground/60">
                      <Zap size={8} /> {m.model}
                      {typeof m.cost === "number" && m.cost > 0 && ` · $${m.cost.toFixed(5)}`}
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {busy && (
            <div className="flex gap-2 justify-start">
              <div
                className="shrink-0 rounded-full grid place-items-center text-primary-foreground"
                style={{ width: 28, height: 28, background: "var(--gradient-asternal)" }}
              >
                <Bot size={14} />
              </div>
              <div className="bg-card border border-border rounded-2xl rounded-bl-md px-3.5 py-3 shadow-sm flex items-center gap-2">
                <Loader2 size={13} className="animate-spin text-primary" />
                <span className="text-[11px] text-muted-foreground">Orión está escribiendo…</span>
                <button
                  onClick={stop}
                  className="ml-1 px-2 py-1 rounded-lg border border-border/70 text-[9px] font-medium text-muted-foreground hover:text-destructive hover:border-destructive/40 active:scale-95 transition"
                >
                  DETENER
                </button>
              </div>
            </div>
          )}

          {err && (
            <div className="flex justify-center">
              <div className="max-w-[85%] rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[11px] text-rose-600 dark:text-rose-300">
                {err}
              </div>
            </div>
          )}

          <div ref={endRef} />
        </div>
      </div>

      {/* Barra de escritura */}
      <div className="shrink-0 border-t border-border/60 bg-background">
        <div className="max-w-2xl md:max-w-3xl mx-auto px-4 py-3">
          <div className="flex items-end gap-2 rounded-2xl border border-border bg-card p-1.5 shadow-sm">
            <textarea
              ref={taRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send(input);
                }
              }}
              rows={1}
              placeholder="Pregúntale a Orión sobre tu juego…"
              className="flex-1 bg-transparent outline-none resize-none px-2.5 py-2 text-[13px] placeholder:text-muted-foreground/50 max-h-28"
              style={{ fieldSizing: "content" as never }}
            />
            <button
              onClick={() => void send(input)}
              disabled={busy || !input.trim()}
              className="w-9 h-9 rounded-lg bg-primary text-white grid place-items-center active:scale-95 transition shrink-0 disabled:opacity-40 disabled:active:scale-100"
            >
              <Send size={15} />
            </button>
          </div>
          <div className="flex items-center justify-center gap-1 pt-2 text-[9px] text-muted-foreground/50">
            <Rocket size={9} /> Orión conoce el motor de Asternal · recuerda tus conversaciones
            <HelpCircle size={9} className="ml-1" />
          </div>
        </div>
      </div>
    </motion.div>
  );
}
