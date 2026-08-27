import { useMemo, useState } from "react";
import type { Scene } from "@/lib/engine/core";
import { applyAuthoringPlan, makeAuthoringContext, type AuthoringPlan } from "@/lib/engine/authoring";

type Message = { role: "user" | "assistant"; content: string };

export function EditorAuthoringAssistant({ scene, onChange, onClose }: { scene: Scene; onChange: (scene: Scene) => void; onClose: () => void }) {
  const [instruction, setInstruction] = useState("");
  const [messages, setMessages] = useState<Message[]>([{ role: "assistant", content: "Describe el cambio que quieres hacer. Prepararé un plan con objetos, física, colisiones, cámara y jerarquía antes de aplicarlo." }]);
  const [plan, setPlan] = useState<AuthoringPlan | null>(null);
  const [undoScene, setUndoScene] = useState<Scene | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const context = useMemo(() => makeAuthoringContext(scene), [scene]);
  const ask = async (value = instruction) => {
    const text = value.trim(); if (!text || loading) return;
    setMessages(current => [...current, { role: "user", content: text }]); setInstruction(""); setLoading(true); setError(null); setPlan(null);
    try {
      const response = await fetch("/api/editor/authoring-plan", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ instruction: text, context }) });
      const payload = await response.json() as AuthoringPlan & { error?: string };
      if (!response.ok) throw new Error(payload.error || "No se pudo preparar el plan.");
      setPlan(payload); setMessages(current => [...current, { role: "assistant", content: `${payload.summary}\n\nPreparé ${payload.operations.length} cambio(s). Revísalos y pulsa Aplicar cuando estés conforme.` }]);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudo consultar a la IA."); }
    finally { setLoading(false); }
  };
  const apply = () => {
    if (!plan) return;
    const result = applyAuthoringPlan(scene, plan);
    setUndoScene(scene); onChange(result.scene); setPlan(null);
    setMessages(current => [...current, { role: "assistant", content: `Apliqué ${result.applied} cambio(s)${result.skipped ? ` y omití ${result.skipped} que no eran válidos para esta escena` : ""}. Puedes deshacer este último paso.` }]);
  };
  const undo = () => { if (!undoScene) return; onChange(undoScene); setUndoScene(null); setMessages(current => [...current, { role: "assistant", content: "Restauré el estado anterior de la escena." }]); };
  return <div className="fixed inset-0 z-50 flex flex-col bg-background/95 backdrop-blur-sm">
    <header className="flex items-center justify-between gap-3 border-b border-border/70 bg-card px-4 py-3"><div><div className="font-display text-sm tracking-widest text-primary">IA DE AUTORÍA</div><p className="text-[10px] font-mono text-muted-foreground">Escena: {scene.name} · {scene.entities.length} objetos · cambios revisables</p></div><button type="button" onClick={onClose} className="rounded-lg border border-border bg-background/50 px-3 py-1.5 text-xs font-display text-foreground hover:border-primary/40">CERRAR</button></header>
    <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,1fr)_340px]">
      <section className="min-h-0 overflow-auto p-4 space-y-3">
        {messages.map((message, index) => <article key={index} className={`max-w-3xl rounded-xl border p-3 text-sm leading-relaxed whitespace-pre-wrap ${message.role === "user" ? "ml-auto border-primary/40 bg-primary/10" : "border-border/70 bg-card"}`}><div className="mb-1 text-[9px] font-display tracking-widest text-muted-foreground">{message.role === "user" ? "TU INSTRUCCIÓN" : "ASTERNAL AI"}</div>{message.content}</article>)}
        {loading && <div className="rounded-xl border border-primary/30 bg-primary/10 p-3 text-xs font-mono text-primary">Analizando el entorno y preparando cambios seguros…</div>}
        {error && <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">{error}</div>}
      </section>
      <aside className="min-h-0 overflow-auto border-t border-border/70 bg-card p-4 lg:border-l lg:border-t-0"><div className="font-display text-[11px] tracking-widest text-primary">PLAN DE CAMBIOS</div>{plan ? <div className="mt-3 space-y-2"><p className="text-xs text-foreground">{plan.summary}</p>{plan.assumptions.length > 0 && <div className="rounded-lg border border-border/70 bg-background/45 p-2 text-[10px] text-muted-foreground">{plan.assumptions.map((assumption, index) => <div key={index}>• {assumption}</div>)}</div>}<div className="space-y-1.5">{plan.operations.map((operation, index) => <div key={index} className="rounded-lg border border-border/65 bg-background/35 px-2 py-1.5 text-[10px] font-mono text-foreground"><span className="text-primary">{index + 1}. {operation.type.replace(/_/g, " ")}</span>{"targetId" in operation && operation.targetId ? <span className="ml-1 text-muted-foreground">· {operation.targetId}</span> : null}</div>)}</div><button type="button" onClick={apply} disabled={plan.operations.length === 0} className="w-full rounded-lg border border-primary/40 bg-primary/15 py-2.5 text-xs font-display tracking-widest text-primary disabled:opacity-40">APLICAR PLAN</button></div> : <p className="mt-3 text-xs leading-relaxed text-muted-foreground">La IA no ejecuta código arbitrario. Devuelve operaciones verificables que utilizan las propiedades reales de Asternal y se aplican solo tras tu confirmación.</p>}<button type="button" onClick={undo} disabled={!undoScene} className="mt-2 w-full rounded-lg border border-border bg-background/40 py-2 text-[10px] font-display tracking-widest text-foreground disabled:opacity-40">DESHACER ÚLTIMO CAMBIO</button></aside>
    </div>
    <form onSubmit={event => { event.preventDefault(); void ask(); }} className="flex gap-2 border-t border-border/70 bg-card p-3"><textarea value={instruction} onChange={event => setInstruction(event.target.value)} placeholder="Ej.: Crea tres plataformas en el grupo Entorno, añade monedas encima y configura una meta a la derecha." className="min-h-12 flex-1 resize-none rounded-lg border border-border bg-input/60 px-3 py-2 text-sm text-foreground focus:border-primary/50 focus:outline-none" /><button type="submit" disabled={!instruction.trim() || loading} className="rounded-lg border border-primary/40 bg-primary/15 px-4 text-xs font-display tracking-widest text-primary disabled:opacity-40">PLANEAR</button></form>
  </div>;
}
