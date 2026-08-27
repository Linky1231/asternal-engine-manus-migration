import { useEffect, useMemo, useState } from "react";
import type { Entity } from "@/lib/engine/core";
import { applySourceProposal, createManualSourceProposal, createSourceProposal, ensureSourceVersion, getSourceFile, listSourceProposals, type SourceFile, type SourceProposal, type SourceVersion } from "@/lib/engine/manual-scripts";

interface Props {
  entity: Entity;
  projectId: string;
  onClose: () => void;
}

function shortPath(filePath: string) {
  return filePath.replace(/^src\/(?:components|lib)\//, "").replace(/^server\//, "srv/");
}

function connectionList(proposal: SourceProposal) {
  const labels: Record<keyof SourceProposal["capability"]["connections"], string> = {
    engine: "motor", runtime: "Play", editor: "Inspección", persistence: "guardado", gameUi: "UI de juego", server: "servicio",
  };
  return Object.entries(proposal.capability.connections).filter(([, enabled]) => enabled).map(([key]) => labels[key as keyof typeof labels]);
}

export function ScriptEditor({ entity, projectId, onClose }: Props) {
  const [version, setVersion] = useState<SourceVersion | null>(null);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<SourceFile | null>(null);
  const [editedContent, setEditedContent] = useState("");
  const [description, setDescription] = useState("");
  const [proposal, setProposal] = useState<SourceProposal | null>(null);
  const [previous, setPrevious] = useState<Array<Omit<SourceProposal, "files">>>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [applying, setApplying] = useState(false);
  const [savingFile, setSavingFile] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const visibleFiles = useMemo(() => version?.files ?? [], [version]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([ensureSourceVersion(projectId), listSourceProposals(projectId)])
      .then(([nextVersion, proposals]) => {
        if (cancelled) return;
        setVersion(nextVersion);
        setPrevious(proposals);
        setSelectedPath(current => current && nextVersion.files.some(file => file.path === current) ? current : nextVersion.files[0]?.path ?? null);
      })
      .catch(cause => { if (!cancelled) setError(cause instanceof Error ? cause.message : "No se pudo abrir el código del proyecto."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [projectId]);

  useEffect(() => {
    if (!version || !selectedPath) { setSelectedFile(null); return; }
    let cancelled = false;
    setSelectedFile(null);
    getSourceFile(projectId, version.id, selectedPath)
      .then(file => { if (!cancelled) { setSelectedFile(file); setEditedContent(file.content); } })
      .catch(cause => { if (!cancelled) setError(cause instanceof Error ? cause.message : "No se pudo leer el archivo."); });
    return () => { cancelled = true; };
  }, [projectId, selectedPath, version]);

  const createChange = async () => {
    if (!version || !description.trim() || creating) return;
    setCreating(true);
    setError(null);
    try {
      const next = await createSourceProposal({
        projectId, versionId: version.id, description: description.trim(),
        entity: { id: entity.id, kind: entity.kind, name: entity.name, tags: entity.tags, variables: entity.variables },
      });
      setProposal(next);
      setPrevious(current => [{ ...next, files: undefined } as Omit<SourceProposal, "files">, ...current]);
      setDescription("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo preparar el cambio interno.");
    } finally { setCreating(false); }
  };

  const applyChange = async () => {
    if (!version || !proposal || applying) return;
    setApplying(true);
    setError(null);
    try {
      const candidate = await applySourceProposal({ projectId, versionId: version.id, proposalId: proposal.id });
      setVersion(candidate);
      setSelectedPath(candidate.files[0]?.path ?? null);
      setProposal(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo crear la versión candidata.");
    } finally { setApplying(false); }
  };

  const saveFileChange = async () => {
    if (!version || !selectedFile || !selectedFile.editable || savingFile || editedContent === selectedFile.content) return;
    setSavingFile(true);
    setError(null);
    try {
      const next = await createManualSourceProposal({ projectId, versionId: version.id, path: selectedFile.path, content: editedContent });
      setProposal(next);
      setPrevious(current => [{ ...next, files: undefined } as Omit<SourceProposal, "files">, ...current]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo preparar la edición manual.");
    } finally { setSavingFile(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background/97 backdrop-blur-sm">
      <header className="flex items-center justify-between gap-3 border-b panel px-4 py-3">
        <div className="min-w-0">
          <div className="font-display text-sm tracking-widest text-primary-glow glow-text">SCRIPTS MANUALES · CÓDIGO INTERNO</div>
          <div className="truncate text-[10px] font-mono text-muted-foreground">{entity.name ?? entity.kind} · versión privada del proyecto</div>
        </div>
        <button onClick={onClose} className="shrink-0 rounded-md panel px-3 py-1.5 text-xs font-display glow-border">CERRAR</button>
      </header>

      <div className="flex-1 overflow-auto p-3 sm:p-4 space-y-3">
        <section className="rounded-lg border border-primary/30 panel p-3 space-y-2.5">
          <div className="text-[10px] font-display tracking-widest text-primary-glow">DESCRIBE LO QUE NECESITAS</div>
          <p className="text-[11px] leading-relaxed text-muted-foreground">Crea una capacidad nueva o cambia el editor de este proyecto. El resultado será una propuesta de archivos y conexiones de código, no un bloque.</p>
          <textarea value={description} onChange={event => setDescription(event.target.value.slice(0, 1600))} rows={3} disabled={creating || loading}
            placeholder="Ejemplo: crea un ranking persistente que aparezca al terminar la partida y permita configurarlo desde Inspección…"
            className="w-full resize-y rounded-md border border-border bg-input/60 px-2.5 py-2 text-xs font-mono text-foreground outline-none transition focus:border-primary/60 focus:ring-2 focus:ring-primary/15 disabled:opacity-60" />
          {error && <p role="alert" className="text-[11px] text-destructive">{error}</p>}
          <button type="button" onClick={() => void createChange()} disabled={!version || !description.trim() || creating || loading}
            className="w-full rounded-md bg-primary px-3 py-2.5 text-xs font-display tracking-widest text-primary-foreground shadow-sm transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-55">
            {creating ? "PREPARANDO CAMBIO…" : "CREAR CAMBIO DE CÓDIGO"}
          </button>
        </section>

        {loading ? <div className="py-10 text-center text-xs text-muted-foreground">Cargando la versión privada del código…</div> : (
          <div className="grid min-h-[360px] gap-3 lg:grid-cols-[250px_minmax(0,1fr)]">
            <aside className="overflow-hidden rounded-lg border border-border/60 panel">
              <div className="border-b border-border/50 px-3 py-2 text-[10px] font-display tracking-widest text-muted-foreground">ARCHIVOS · {visibleFiles.length}</div>
              <div className="max-h-[330px] overflow-auto p-1.5">
                {visibleFiles.map(file => <button key={file.path} type="button" onClick={() => setSelectedPath(file.path)}
                  className={`mb-1 flex w-full items-center gap-2 rounded px-2 py-2 text-left font-mono text-[10px] transition ${selectedPath === file.path ? "bg-primary/15 text-primary-glow" : "text-muted-foreground hover:bg-accent/10 hover:text-foreground"}`}>
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary/70" />
                  <span className="min-w-0 truncate">{shortPath(file.path)}</span>
                </button>)}
              </div>
            </aside>
            <section className="min-w-0 overflow-hidden rounded-lg border border-border/60 panel">
              <div className="flex items-center justify-between gap-2 border-b border-border/50 px-3 py-2">
                <span className="truncate font-mono text-[10px] text-primary-glow">{selectedFile?.path ?? selectedPath ?? "Selecciona un archivo"}</span>
                <span className="shrink-0 text-[9px] font-display tracking-widest text-muted-foreground">{selectedFile?.editable ? "EDITABLE EN LA VERSIÓN" : "LECTURA"}</span>
              </div>
              {selectedFile?.editable ? (
                <div className="space-y-2 p-2.5"><textarea value={editedContent} onChange={event => setEditedContent(event.target.value)} className="h-[285px] w-full resize-y rounded border border-border bg-background/50 p-2.5 text-[11px] leading-relaxed text-foreground outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/15" spellCheck={false} /><button type="button" onClick={() => void saveFileChange()} disabled={savingFile || editedContent === selectedFile.content} className="w-full rounded border border-primary/45 bg-primary/10 px-3 py-2 text-[10px] font-display tracking-widest text-primary-glow transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50">{savingFile ? "GUARDANDO PROPUESTA…" : "GUARDAR COMO CAMBIO PRIVADO"}</button></div>
              ) : <pre className="max-h-[330px] overflow-auto p-3 text-[11px] leading-relaxed text-foreground/90"><code>{selectedFile?.content ?? (selectedPath ? "Cargando archivo…" : "No hay archivos disponibles.")}</code></pre>}
            </section>
          </div>
        )}

        {proposal && <section className="rounded-lg border border-primary/35 panel p-3 space-y-3">
          <div className="flex flex-wrap items-center gap-2"><span className="font-display text-xs tracking-widest text-primary-glow">CAMBIO PREPARADO · {proposal.capability.name.toUpperCase()}</span><span className="rounded border border-primary/30 px-1.5 py-0.5 text-[9px] font-mono text-muted-foreground">{proposal.capability.scope === "editor" ? "EDITOR" : "PROYECTO"}</span></div>
          <p className="text-xs text-foreground">{proposal.summary}</p>
          <p className="text-[10px] font-mono text-muted-foreground">Conecta: {connectionList(proposal).join(" · ") || "código interno"}</p>
          <div className="space-y-2">{proposal.files.map(file => <details key={`${file.path}-${file.operation}`} className="rounded border border-border/60 bg-background/30"><summary className="cursor-pointer px-2.5 py-2 text-[10px] font-mono text-primary-glow">{file.operation.toUpperCase()} · {file.path}</summary><p className="border-t border-border/40 px-2.5 py-2 text-[10px] text-muted-foreground">{file.purpose}</p><pre className="max-h-56 overflow-auto border-t border-border/40 p-2.5 text-[10px] leading-relaxed text-foreground/90"><code>{file.content || "Archivo programado para eliminar."}</code></pre></details>)}</div>
          {proposal.warnings.length > 0 && <div className="rounded border border-amber-500/35 bg-amber-500/10 p-2 text-[10px] text-amber-200">{proposal.warnings.join(" ")}</div>}
          <button type="button" onClick={() => void applyChange()} disabled={applying} className="w-full rounded-md border border-primary/45 bg-primary/10 px-3 py-2.5 text-xs font-display tracking-widest text-primary-glow transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-55">{applying ? "CREANDO VERSIÓN…" : "CREAR VERSIÓN PRIVADA"}</button>
          <p className="text-[10px] text-muted-foreground">La versión candidata conserva sus archivos aislados. Su activación queda pendiente de la compilación interna del proyecto.</p>
        </section>}

        {previous.length > 0 && <section className="rounded-lg border border-border/60 panel p-3"><div className="mb-2 text-[10px] font-display tracking-widest text-muted-foreground">CAMBIOS GUARDADOS · {previous.length}</div><div className="space-y-1.5">{previous.slice(0, 5).map(item => <div key={item.id} className="flex items-center justify-between gap-2 rounded border border-border/40 px-2.5 py-2"><span className="truncate text-[11px] text-foreground">{item.capability.name}</span><span className="shrink-0 text-[9px] font-mono text-muted-foreground">{new Date(item.createdAt).toLocaleDateString()}</span></div>)}</div></section>}
      </div>
    </div>
  );
}
