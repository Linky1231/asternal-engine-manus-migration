import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import type { Scene } from "@/lib/engine/core";
import { applyAuthoringPlan, makeAuthoringContext, type AuthoringPlan } from "@/lib/engine/authoring";

type Message = { role: "user" | "assistant"; content: string };

export function EditorAuthoringAssistant({ scene, onChange, onClose }: { scene: Scene; onChange: (scene: Scene) => void; onClose: () => void }) {
  const [instruction, setInstruction] = useState("");
  const [messages, setMessages] = useState<Message[]>([{ role: "assistant", content: "Describe el cambio que quieres hacer. Prepararé un plan con objetos, física, cámara, UI del juego y reglas internas ejecutables antes de aplicarlo." }]);
  const [plan, setPlan] = useState<AuthoringPlan | null>(null);
  const [undoScene, setUndoScene] = useState<Scene | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const context = useMemo(() => makeAuthoringContext(scene), [scene]);

  const ask = async () => {
    const text = instruction.trim(); if (!text || loading) return;
    setMessages(current => [...current, { role: "user", content: text }]); setInstruction(""); setLoading(true); setError(null); setPlan(null);
    try {
      const response = await fetch("/api/editor/authoring-plan", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ instruction: text, context }) });
      const payload = await response.json() as AuthoringPlan & { error?: string };
      if (!response.ok) throw new Error(payload.error || "No se pudo preparar el plan.");
      setPlan(payload); setMessages(current => [...current, { role: "assistant", content: `${payload.summary}\n\nPreparé ${payload.operations.length} cambio(s). Revísalos y pulsa Aplicar plan cuando estés conforme.` }]);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudo consultar a Scripting AI."); }
    finally { setLoading(false); }
  };
  const apply = () => {
    if (!plan) return;
    const result = applyAuthoringPlan(scene, plan);
    setUndoScene(scene); onChange(result.scene); setPlan(null);
    setMessages(current => [...current, { role: "assistant", content: `Apliqué ${result.applied} cambio(s)${result.skipped ? ` y omití ${result.skipped} que no eran válidos para esta escena` : ""}. Puedes deshacer este último paso.` }]);
  };
  const undo = () => { if (!undoScene) return; onChange(undoScene); setUndoScene(null); setMessages(current => [...current, { role: "assistant", content: "Restauré el estado anterior de la escena." }]); };

  return createPortal(<div role="dialog" aria-modal="true" aria-label="Scripting AI" className="fixed inset-0 z-[1000] flex h-[100dvh] flex-col overflow-hidden bg-[#08111f] text-foreground">
    <header className="flex shrink-0 items-start justify-between gap-3 border-b border-border/80 bg-card px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:items-center">
      <div className="min-w-0"><div className="font-display text-sm tracking-[0.16em] text-primary">SCRIPTING AI</div><p className="mt-1 truncate text-[10px] font-mono text-muted-foreground">Escena: {scene.name} · {scene.entities.length} objetos · cambios revisables</p></div>
      <button type="button" onClick={onClose} className="shrink-0 rounded-lg border border-border bg-background px-3 py-2 text-xs font-display text-foreground hover:border-primary/40">CERRAR</button>
    </header>
    <main className="flex min-h-0 flex-1 flex-col lg:grid lg:grid-cols-[minmax(0,1fr)_340px]">
      <section aria-label="Conversación con Scripting AI" className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain p-4">
        {messages.map((message, index) => <article key={index} className={`max-w-3xl rounded-xl border p-3 text-sm leading-relaxed whitespace-pre-wrap ${message.role === "user" ? "ml-auto border-primary/45 bg-primary/10" : "border-border/80 bg-card"}`}><div className="mb-1 text-[9px] font-display tracking-widest text-muted-foreground">{message.role === "user" ? "TU INSTRUCCIÓN" : "SCRIPTING AI"}</div>{message.content}</article>)}
        {loading && <div className="rounded-xl border border-primary/35 bg-primary/10 p-3 text-xs font-mono text-primary">Analizando el entorno y preparando cambios seguros…</div>}
        {error && <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">{error}</div>}
      </section>
      <aside aria-label="Plan de cambios" className="max-h-[32dvh] shrink-0 overflow-y-auto overscroll-contain border-t border-border/80 bg-card p-4 lg:max-h-none lg:border-l lg:border-t-0"><div className="font-display text-[11px] tracking-[0.14em] text-primary">PLAN DE CAMBIOS</div>{plan ? <div className="mt-3 space-y-2"><p className="text-xs text-foreground">{plan.summary}</p>{plan.assumptions.length > 0 && <div className="rounded-lg border border-border/70 bg-background p-2 text-[10px] leading-relaxed text-muted-foreground">{plan.assumptions.map((assumption, index) => <div key={index}>• {assumption}</div>)}</div>}<div className="space-y-1.5">{plan.operations.map((operation, index) => <div key={index} className="rounded-lg border border-border/70 bg-background px-2 py-1.5 text-[10px] font-mono text-foreground"><span className="text-primary">{index + 1}. {operation.type.replace(/_/g, " ")}</span>{"targetId" in operation && operation.targetId ? <span className="ml-1 text-muted-foreground">· {operation.targetId}</span> : null}</div>)}</div><button type="button" onClick={apply} disabled={plan.operations.length === 0} className="w-full rounded-lg border border-primary/45 bg-primary/15 py-2.5 text-xs font-display tracking-widest text-primary disabled:opacity-40">APLICAR PLAN</button></div> : <p className="mt-3 text-xs leading-relaxed text-muted-foreground">Scripting AI propone operaciones verificables sobre las propiedades reales de Asternal. Ningún cambio se aplica sin tu confirmación.</p>}<button type="button" onClick={undo} disabled={!undoScene} className="mt-3 w-full rounded-lg border border-border bg-background py-2 text-[10px] font-display tracking-widest text-foreground disabled:opacity-40">DESHACER ÚLTIMO CAMBIO</button></aside>
    </main>
    <form onSubmit={event => { event.preventDefault(); void ask(); }} className="shrink-0 border-t border-border/80 bg-card p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:flex sm:items-end sm:gap-2"><textarea value={instruction} onChange={event => setInstruction(event.target.value)} placeholder="Ej.: Crea tres plataformas en el grupo Entorno, añade monedas encima y configura una meta a la derecha." className="min-h-[84px] w-full resize-none rounded-lg border border-border bg-input px-3 py-2 text-sm leading-relaxed text-foreground placeholder:text-muted-foreground focus:border-primary/60 focus:outline-none sm:min-h-12 sm:flex-1" /><button type="submit" disabled={!instruction.trim() || loading} className="mt-2 w-full rounded-lg border border-primary/45 bg-primary/15 px-4 py-3 text-xs font-display tracking-widest text-primary disabled:opacity-40 sm:mt-0 sm:w-auto">PLANEAR</button></form>
  </div>, document.body);
}
