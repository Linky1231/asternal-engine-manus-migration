import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, CheckCircle2, ImagePlus, Loader2, RefreshCw, UploadCloud } from "lucide-react";
import { toast } from "sonner";
import { applyGlobalTexture, fetchGlobalTextureManifest, type GlobalTextureManifest } from "@/lib/global-textures";

export const Route = createFileRoute("/textures")({ component: TexturesPage });

function TexturesPage() {
  const [manifest, setManifest] = useState<GlobalTextureManifest | null>(null);
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    setLoading(true);
    try { setManifest(await fetchGlobalTextureManifest()); }
    catch (error) { toast.error(error instanceof Error ? error.message : "No se pudo cargar el catálogo."); }
    finally { setLoading(false); }
  };

  useEffect(() => { void load(); }, []);

  const publish = async (file: File) => {
    if (!/^image\/(png|jpeg|webp)$/.test(file.type)) { toast.error("Usa una textura PNG, JPG o WebP."); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error("La textura no puede superar 5 MB."); return; }
    setPublishing(true);
    try {
      const response = await fetch("/api/textures/publish", { method: "POST", headers: { "Content-Type": file.type, "X-Texture-Name": file.name }, body: file });
      const body = await response.json() as GlobalTextureManifest & { error?: string };
      if (!response.ok) throw new Error(body.error || "No se pudo publicar la textura.");
      setManifest(body);
      applyGlobalTexture(body.active?.url);
      toast.success("Textura publicada para todos los usuarios.");
    } catch (error) { toast.error(error instanceof Error ? error.message : "No se pudo publicar la textura."); }
    finally { setPublishing(false); if (inputRef.current) inputRef.current.value = ""; }
  };

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-20 border-b border-border/60 bg-background/90 backdrop-blur-xl">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link to="/" className="w-9 h-9 grid place-items-center rounded-xl border border-border/70 bg-card text-ink-2 hover:text-foreground" aria-label="Volver"><ArrowLeft size={17} /></Link>
          <div className="min-w-0 flex-1"><p className="text-[10px] font-display tracking-[0.18em] text-primary uppercase">Asternal Studio</p><h1 className="text-base font-display font-semibold truncate">Texturas globales</h1></div>
          <button onClick={() => void load()} disabled={loading || publishing} className="w-9 h-9 grid place-items-center rounded-xl border border-border/70 text-muted-foreground" aria-label="Actualizar"><RefreshCw size={15} className={loading ? "animate-spin" : ""} /></button>
        </div>
      </header>
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        <section className="panel rounded-3xl border border-primary/20 bg-card p-5 sm:p-6">
          <div className="flex items-start gap-3"><div className="w-10 h-10 rounded-2xl bg-primary/10 border border-primary/20 text-primary grid place-items-center shrink-0"><ImagePlus size={18} /></div><div><h2 className="font-display font-semibold">Textura de botones e iconos</h2><p className="mt-1 text-sm text-muted-foreground leading-relaxed">La apariencia codificada permanece como fallback. Una textura publicada desde Manus se aplica globalmente a todos.</p></div></div>
          {loading ? <div className="mt-5 text-sm text-muted-foreground flex items-center gap-2"><Loader2 size={15} className="animate-spin" /> Consultando textura activa…</div> : manifest?.active ? (
            <div className="mt-5 rounded-2xl border border-emerald-400/35 bg-emerald-400/10 px-4 py-3 flex items-center gap-3"><CheckCircle2 className="text-emerald-300 shrink-0" size={19} /><div className="min-w-0"><p className="text-sm font-semibold text-emerald-200">Ya está puesta</p><p className="text-xs text-emerald-200/75 truncate">{manifest.active.name} · aplicada para todos</p></div></div>
          ) : <div className="mt-5 rounded-2xl border border-dashed border-border px-4 py-3 text-sm text-muted-foreground">No hay una textura subida; se usa la textura codificada.</div>}
        </section>
        <section className="panel rounded-3xl border border-border/70 bg-card p-5 sm:p-6">
          <div className="flex items-center gap-3"><UploadCloud size={18} className="text-primary" /><div><h2 className="font-display font-semibold">Cambiar textura</h2><p className="text-xs text-muted-foreground mt-1">Puedes reemplazarla aunque ya aparezca como aplicada.</p></div></div>
          <input ref={inputRef} className="sr-only" type="file" accept="image/png,image/jpeg,image/webp" onChange={event => { const file = event.target.files?.[0]; if (file) void publish(file); }} />
          <button onClick={() => inputRef.current?.click()} disabled={publishing} className="mt-5 w-full h-11 rounded-xl btn-grad text-xs font-display tracking-[0.12em] flex items-center justify-center gap-2 disabled:opacity-50">{publishing ? <Loader2 size={15} className="animate-spin" /> : <UploadCloud size={15} />}{publishing ? "PUBLICANDO…" : manifest?.active ? "REEMPLAZAR TEXTURA" : "SUBIR TEXTURA"}</button>
          <p className="mt-3 text-[11px] text-muted-foreground">Formatos admitidos: PNG, JPG y WebP. Máximo 5 MB. Los archivos se guardan exclusivamente en Manus.</p>
        </section>
      </div>
    </main>
  );
}
