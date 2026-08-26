import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { Avatar } from "@/components/social/Avatar";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  isMod, isAdmin, listManagedUsers, setUserModerator, type ManagedUser,
  listBannedEmails, banEmail, unbanEmail, type BannedEmail,
  getTrustPoints, deductTrustPoints, restoreTrustPoints, DEFAULT_TRUST_POINTS,
} from "@/lib/social/api";
import {
  getForumThreads, getForumCategories, deleteForumThread,
  createForumCategory, deleteForumCategory,
  getForumPosts, type ForumThread, type ForumCategory,
} from "@/lib/social/forum-storage";
import {
  ArrowLeft, Shield, ShieldCheck, Loader2, Search, Ban, Trash2, Plus,
  MessageSquare, Hash, Globe, Edit3, X, Check, Trophy,
} from "lucide-react";
import {
  fetchEvents, createEvent, updateEventStatus,
  type EventItem,
} from "@/lib/social/api";
import { fetchChatProfiles } from "@/lib/social/chat";
import { SegmentedControl } from "@/components/ui/segmented";
import type { Profile } from "@/lib/social/api";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Admin · Asternal" }] }),
  component: AdminPage,
});

type Tab = "mods" | "bans" | "foros" | "eventos";

function AdminPage() {
  const navigate = useNavigate();
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [admin, setAdmin] = useState(false);
  const [tab, setTab] = useState<Tab>("mods");
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [bans, setBans] = useState<BannedEmail[]>([]);
  const [threads, setThreads] = useState<ForumThread[]>([]);
  const [categories, setCategories] = useState<ForumCategory[]>([]);
  const [threadAuthors, setThreadAuthors] = useState<Map<string, Profile>>(new Map());
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [trustBusy, setTrustBusy] = useState<string | null>(null);
  const [trustDeductAmt, setTrustDeductAmt] = useState<Record<string, number>>({});
  const [trustReason, setTrustReason] = useState<Record<string, string>>({});
  const [newEmail, setNewEmail] = useState("");
  const [newReason, setNewReason] = useState("");
  const [banErr, setBanErr] = useState<string | null>(null);
  // New category form
  const [showNewCat, setShowNewCat] = useState(false);
  const [catName, setCatName] = useState("");
  const [catDesc, setCatDesc] = useState("");
  const [catIcon, setCatIcon] = useState("globe");
  // Events
  const [events, setEvents] = useState<EventItem[]>([]);
  const [showNewEvent, setShowNewEvent] = useState(false);
  const [evTitle, setEvTitle] = useState("");
  const [evDesc, setEvDesc] = useState("");
  const [evStarts, setEvStarts] = useState("");
  const [evEnds, setEvEnds] = useState("");
  const [evPrizePool, setEvPrizePool] = useState<number | "">("");
  const [evPrizeDesc, setEvPrizeDesc] = useState("");
  const [evRules, setEvRules] = useState("");
  const [evErr, setEvErr] = useState<string | null>(null);

  const load = async (search?: string) => {
    setLoading(true);
    try {
      if (tab === "mods") setUsers(await listManagedUsers(search));
      else if (tab === "bans") setBans(await listBannedEmails());
      else if (tab === "eventos") setEvents(await fetchEvents());
      else {
        const ts = await getForumThreads();
        setThreads(ts);
        setCategories(await getForumCategories());
        // Fotos de perfil de los autores de los hilos (carga en lote).
        const ids = Array.from(new Set(ts.map(t => t.authorId).filter(Boolean)));
        if (ids.length) {
          fetchChatProfiles(ids).then(setThreadAuthors).catch(() => {});
        } else {
          setThreadAuthors(new Map());
        }
      }
    } finally { setLoading(false); }
  };

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { navigate({ to: "/auth" }); return; }
      const isA = await isAdmin();
      const isM = await isMod();
      setAdmin(isA);
      setAllowed(isA || isM);
      if (isA || isM) await load();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { if (allowed) load(q); /* eslint-disable-next-line */ }, [tab]);

  const toggleMod = async (u: ManagedUser) => {
    setBusy(u.id);
    try { await setUserModerator(u.id, !u.is_mod); await load(q); }
    finally { setBusy(null); }
  };

  const addBan = async () => {
    setBanErr(null);
    try { await banEmail(newEmail, newReason || undefined); setNewEmail(""); setNewReason(""); await load(); }
    catch (e) { setBanErr((e as Error).message); }
  };

  const removeBan = async (id: string) => {
    if (!confirm("¿Quitar del baneo?")) return;
    setBusy(id);
    try { await unbanEmail(id); await load(); } finally { setBusy(null); }
  };

  const deductTrust = async (userId: string, username: string) => {
    const amt = trustDeductAmt[userId] || 1;
    const reason = trustReason[userId]?.trim() || "Sin razón especificada";
    if (!confirm(`¿Quitar ${amt} punto(s) de confianza a @${username}?
Razón: ${reason}`)) return;
    setTrustBusy(userId);
    try {
      const result = await deductTrustPoints(userId, amt, reason);
      if (result.banned) alert(`@${username} alcanzó 0 puntos y fue baneado.`);
      setTrustDeductAmt(prev => ({ ...prev, [userId]: 1 }));
      setTrustReason(prev => ({ ...prev, [userId]: "" }));
      await load(q);
    } catch (e) { alert((e as Error).message); }
    finally { setTrustBusy(null); }
  };

  const restoreTrust = async (userId: string) => {
    setTrustBusy(userId);
    try { await restoreTrustPoints(userId, 1); await load(q); }
    catch (e) { alert((e as Error).message); }
    finally { setTrustBusy(null); }
  };

  const handleDeleteThread = (threadId: string) => {
    if (!confirm("¿Borrar este hilo permanentemente? También se borrarán todas sus respuestas.")) return;
    deleteForumThread(threadId).then(() => load());
  };

  const handleDeleteCategory = (categoryId: string) => {
    const cat = categories.find(c => c.id === categoryId);
    if (!cat) return;
    if (!confirm(`¿Borrar la categoría "${cat.name}"? También se borrarán TODOS los hilos dentro de ella.`)) return;
    deleteForumCategory(categoryId).then(() => load());
  };

  const handleNewCategory = () => {
    if (!catName.trim()) return;
    createForumCategory(catName.trim(), catDesc.trim(), catIcon).then(() => {
      setCatName(""); setCatDesc(""); setCatIcon("globe"); setShowNewCat(false);
      load();
    });
  };

  if (allowed === null) return <div className="min-h-screen grid place-items-center text-sm text-muted-foreground">Cargando…</div>;
  if (!allowed) return (
    <div className="min-h-screen grid place-items-center px-6 text-center">
      <div>
        <Shield size={32} className="mx-auto text-destructive" />
        <div className="mt-3 font-display text-sm">Acceso restringido</div>
        <div className="text-xs text-muted-foreground mt-1">Solo moderadores o el administrador pueden entrar.</div>
        <Link to="/" className="inline-block mt-4 px-4 py-2 rounded-xl border border-border text-xs font-display tracking-widest">← VOLVER</Link>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-10 bg-background border-b border-border/70">
        <div className="max-w-2xl md:max-w-3xl lg:max-w-5xl xl:max-w-6xl mx-auto px-3 pt-2.5 pb-2.5">
          <div className="flex items-center gap-2.5">
            <Link to="/" aria-label="Volver al menú principal"
              className="w-9 h-9 rounded-lg border border-line-strong bg-card text-ink-2 grid place-items-center hover:bg-muted/60 hover:text-foreground active:scale-95 transition shrink-0">
              <ArrowLeft size={16} />
            </Link>
            <div className="flex-1 min-w-0">
              <div className="font-display text-sm font-semibold text-foreground leading-none flex items-center gap-2 truncate">
                <ShieldCheck size={14} className="text-primary shrink-0" /> MODERACIÓN
              </div>
              <div className="text-[10px] font-mono text-muted-foreground mt-0.5">{admin ? "Administrador" : "Moderador"}</div>
            </div>
          </div>
          <div className="mt-2.5">
            <SegmentedControl
              items={[
                { id: "mods", label: "MODS" },
                { id: "bans", label: "BANEOS" },
                { id: "foros", label: "FOROS" },
                { id: "eventos", label: "EVENTOS" },
              ]}
              value={tab}
              onChange={setTab}
            />
          </div>
          {tab === "mods" && admin && (
            <div className="flex gap-2 pt-2.5">
              <div className="flex-1 flex items-center gap-2 bg-card border border-line-strong rounded-lg px-3">
                <Search size={14} className="text-muted-foreground" />
                <input value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => e.key === "Enter" && load(q)}
                  placeholder="Buscar por usuario…" className="flex-1 bg-transparent py-2 text-sm outline-none" />
              </div>
              <button onClick={() => load(q)} className="px-4 py-2 rounded-lg btn-grad text-xs font-display tracking-widest active:scale-95 shrink-0">IR</button>
            </div>
          )}
        </div>
      </header>

      <main className="max-w-2xl md:max-w-3xl lg:max-w-5xl xl:max-w-6xl mx-auto px-3 py-3 space-y-2">
        {loading ? (
          <div className="text-center text-xs text-muted-foreground py-10"><Loader2 className="inline animate-spin mr-2" size={14}/>Cargando…</div>
        ) : tab === "mods" ? (
          !admin ? (
            <div className="text-center text-xs text-muted-foreground py-10">Solo el administrador puede asignar moderadores.</div>
          ) : users.length === 0 ? (
            <div className="text-center text-xs text-muted-foreground py-10">Sin resultados.</div>
          ) : users.map(u => (
            <div key={u.id} className="panel border border-border/50 rounded-xl px-3 py-2.5 space-y-2">
              <Link
                to="/profile/$userId" params={{ userId: u.id }}
                className="flex items-center gap-3 flex-1 min-w-0 group"
                title={`Ver perfil de ${u.display_name || u.username}`}
              >
                <Avatar p={u} size={40} className="ring-2 ring-primary/15" />
                <div className="min-w-0 flex-1">
                  <div className="font-display text-sm truncate group-hover:text-primary transition-colors">{u.display_name || u.username}</div>
                  <div className="text-[10px] font-mono text-muted-foreground truncate group-hover:text-foreground/70 transition-colors">@{u.username}</div>
                </div>
              </Link>
              {u.is_admin ? (
                <span className="text-[9px] font-display tracking-widest px-2 py-0.5 rounded-full bg-accent/20 text-primary-glow border border-accent/40 shrink-0">ADMIN</span>
              ) : (
                <button onClick={() => toggleMod(u)} disabled={busy === u.id}
                  className={`text-[10px] font-display tracking-widest px-3 py-1.5 rounded-lg border flex items-center gap-1.5 active:scale-95 transition disabled:opacity-60 shrink-0 ${u.is_mod ? "bg-primary/15 border-primary/40 text-primary-glow" : "border-border text-muted-foreground"}`}>
                  {busy === u.id ? <Loader2 size={12} className="animate-spin"/> : <Shield size={12}/>}
                  {u.is_mod ? "MOD" : "HACER MOD"}
                </button>
              )}
              {/* Trust Points */}
              <div className="flex items-center gap-2 pt-2 border-t border-border/30">
                <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-mono font-semibold ${(u.trust_points ?? 10) <= 3 ? "bg-red-50 text-red-600 border border-red-200/60" : (u.trust_points ?? 10) <= 6 ? "bg-amber-50 text-amber-600 border border-amber-200/60" : "bg-emerald-50 text-emerald-600 border border-emerald-200/60"}`}>
                  <div className={`w-1.5 h-1.5 rounded-full ${(u.trust_points ?? 10) <= 3 ? "bg-red-500" : (u.trust_points ?? 10) <= 6 ? "bg-amber-500" : "bg-emerald-500"}`} />
                  {u.trust_points ?? 10} pts
                </div>
                <input type="number" min={1} max={10} value={trustDeductAmt[u.id] || 1}
                  onChange={e => setTrustDeductAmt(prev => ({ ...prev, [u.id]: Math.max(1, Math.min(10, parseInt(e.target.value) || 1)) }))}
                  className="w-10 h-6 px-1 rounded bg-card border border-border/50 text-[10px] text-center font-mono outline-none focus:border-primary/40"
                />
                <input value={trustReason[u.id] || ""} onChange={e => setTrustReason(prev => ({ ...prev, [u.id]: e.target.value }))}
                  placeholder="Razon..."
                  className="flex-1 h-6 px-2 rounded bg-card border border-border/50 text-[10px] outline-none focus:border-primary/40 placeholder:text-muted-foreground/30"
                />
                <button onClick={() => restoreTrust(u.id)} disabled={trustBusy === u.id || (u.trust_points ?? 10) >= 10}
                  className="h-6 px-1.5 rounded bg-emerald-500 text-white text-[9px] font-semibold active:scale-95 transition disabled:opacity-40">+1</button>
                <button onClick={() => deductTrust(u.id, u.username)} disabled={trustBusy === u.id || (u.trust_points ?? 10) <= 0}
                  className="h-6 px-1.5 rounded bg-red-500 text-white text-[9px] font-semibold active:scale-95 transition disabled:opacity-40">-{trustDeductAmt[u.id] || 1}</button>
              </div>
            </div>
          ))
        ) : tab === "bans" ? (
          <>
            {admin && (
              <div className="panel border border-border/50 rounded-xl p-3 space-y-2">
                <div className="font-display text-[10px] tracking-widest text-primary-glow flex items-center gap-1"><Ban size={12}/> AÑADIR EMAIL</div>
                <input value={newEmail} onChange={e => setNewEmail(e.target.value)} type="email" placeholder="usuario@ejemplo.com"
                  className="w-full bg-input/50 rounded-lg px-3 py-2 text-sm outline-none" />
                <input value={newReason} onChange={e => setNewReason(e.target.value)} placeholder="Motivo (opcional)" maxLength={200}
                  className="w-full bg-input/50 rounded-lg px-3 py-2 text-sm outline-none" />
                {banErr && <div className="text-xs text-destructive">{banErr}</div>}
                <button onClick={addBan} disabled={!newEmail.trim()}
                  className="w-full py-2 rounded-lg bg-destructive text-destructive-foreground text-[10px] font-display tracking-widest disabled:opacity-50 flex items-center justify-center gap-1 active:scale-95">
                  <Plus size={12}/> BANEAR EMAIL
                </button>
              </div>
            )}
            {bans.length === 0 ? (
              <div className="text-center text-xs text-muted-foreground py-10">No hay emails baneados.</div>
            ) : bans.map(b => (
              <div key={b.id} className="panel border border-border/50 rounded-xl px-3 py-2.5 flex items-center gap-3">
                <Ban size={16} className="text-destructive shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-mono truncate">{b.email}</div>
                  {b.reason && <div className="text-[10px] text-muted-foreground truncate">{b.reason}</div>}
                </div>
                <button onClick={() => removeBan(b.id)} disabled={busy === b.id}
                  className="w-9 h-9 grid place-items-center rounded-lg border border-destructive/40 text-destructive active:scale-95 disabled:opacity-60">
                  {busy === b.id ? <Loader2 size={12} className="animate-spin"/> : <Trash2 size={13}/>}
                </button>
              </div>
            ))}
          </>
        ) : tab === "eventos" ? (
          <>
            <div className="panel border border-border/50 rounded-xl p-3 space-y-3">
              <div className="flex items-center justify-between">
                <div className="font-display text-[10px] tracking-widest text-primary flex items-center gap-1"><Trophy size={12}/> NUEVO EVENTO</div>
                <button onClick={() => setShowNewEvent(s => !s)}
                  className={`text-[10px] px-2.5 py-1 rounded-lg border transition ${showNewEvent ? "bg-muted/30 border-border" : "border-primary/30 bg-primary/5 text-primary"}`}>
                  {showNewEvent ? "Cancelar" : "Crear"}
                </button>
              </div>
              {showNewEvent && (
                <div className="space-y-2 border-t border-border/40 pt-3">
                  <input value={evTitle} onChange={e => setEvTitle(e.target.value)} placeholder="Titulo del evento" maxLength={60}
                    className="w-full bg-input/50 rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary/40" />
                  <textarea value={evDesc} onChange={e => setEvDesc(e.target.value)} placeholder="Descripcion del evento" maxLength={500} rows={2}
                    className="w-full bg-input/50 rounded-lg px-3 py-2 text-sm outline-none resize-none focus:ring-1 focus:ring-primary/40" />
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <div className="text-[10px] text-muted-foreground mb-0.5">Inicio</div>
                      <input type="datetime-local" value={evStarts} onChange={e => setEvStarts(e.target.value)}
                        className="w-full bg-input/50 rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary/40" />
                    </div>
                    <div>
                      <div className="text-[10px] text-muted-foreground mb-0.5">Fin</div>
                      <input type="datetime-local" value={evEnds} onChange={e => setEvEnds(e.target.value)}
                        className="w-full bg-input/50 rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary/40" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <div className="text-[10px] text-muted-foreground mb-0.5">Premio (Orbes)</div>
                      <input type="number" min={0} value={evPrizePool} onChange={e => setEvPrizePool(e.target.value ? Number(e.target.value) : "")} placeholder="0"
                        className="w-full bg-input/50 rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary/40" />
                    </div>
                  </div>
                  <textarea value={evPrizeDesc} onChange={e => setEvPrizeDesc(e.target.value)} placeholder="Descripcion del premio" maxLength={300} rows={1}
                    className="w-full bg-input/50 rounded-lg px-3 py-2 text-sm outline-none resize-none focus:ring-1 focus:ring-primary/40" />
                  <textarea value={evRules} onChange={e => setEvRules(e.target.value)} placeholder="Reglas del evento" maxLength={1000} rows={2}
                    className="w-full bg-input/50 rounded-lg px-3 py-2 text-sm outline-none resize-none focus:ring-1 focus:ring-primary/40" />
                  {evErr && <div className="text-xs text-destructive">{evErr}</div>}
                  <button onClick={async () => {
                      setEvErr(null);
                      if (!evTitle.trim() || !evDesc.trim() || !evStarts || !evEnds) { setEvErr("Completa todos los campos obligatorios"); return; }
                      if (new Date(evStarts) >= new Date(evEnds)) { setEvErr("La fecha de fin debe ser posterior al inicio"); return; }
                      try {
                        await createEvent({
                          title: evTitle.trim(), description: evDesc.trim(),
                          starts_at: new Date(evStarts).toISOString(), ends_at: new Date(evEnds).toISOString(),
                          prize_pool: typeof evPrizePool === "number" ? evPrizePool : null,
                          prize_description: evPrizeDesc.trim() || null, rules: evRules.trim() || null,
                        });
                        setEvTitle(""); setEvDesc(""); setEvStarts(""); setEvEnds("");
                        setEvPrizePool(""); setEvPrizeDesc(""); setEvRules("");
                        setShowNewEvent(false); await load();
                      } catch (e) { setEvErr((e as Error).message); }
                    }}
                    disabled={!evTitle.trim() || !evDesc.trim() || !evStarts || !evEnds}
                    className="w-full py-2.5 rounded-lg grad-brand text-primary-foreground text-[10px] font-display tracking-widest disabled:opacity-50 flex items-center justify-center gap-1 active:scale-[0.98] transition shadow-sm shadow-primary/25">
                    <Trophy size={12}/> CREAR EVENTO
                  </button>
                </div>
              )}
            </div>
            {events.length === 0 ? (
              <div className="text-center text-xs text-muted-foreground py-10">No hay eventos creados aun.</div>
            ) : events.map(ev => {
              const statusOpts = ["upcoming", "active", "completed"] as const;
              return (
                <div key={ev.id} className="panel border border-border/50 rounded-xl p-3 flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-muted/60 border border-border/40 grid place-items-center shrink-0">
                    <Trophy size={18} className="text-amber-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-display text-sm font-semibold truncate">{ev.title}</div>
                    <div className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">{ev.description}</div>
                    <div className="flex items-center gap-3 mt-1.5 text-[10px] text-muted-foreground">
                      <span>{new Date(ev.starts_at).toLocaleDateString()}</span>
                      <span>{ev.participant_count ?? 0} participantes</span>
                      <span>{ev.submission_count ?? 0} subs</span>
                    </div>
                  </div>
                  <select value={ev.status} onChange={e => {
                    const v = e.target.value as "upcoming" | "active" | "completed";
                    updateEventStatus(ev.id, v).then(() => load());
                  }} className="text-[10px] bg-input/50 rounded-lg px-2 py-1 border border-border/50 outline-none">
                    {statusOpts.map(s => <option key={s} value={s}>{s.toUpperCase()}</option>)}
                  </select>
                </div>
              );
            })}
          </>
        ) : (
          /* ── FOROS TAB ── */
          <>
            {/* ── Categories management ── */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between px-1">
                <div className="font-display text-[10px] tracking-widest text-primary/70 flex items-center gap-1">
                  <Hash size={12} /> CATEGORÍAS
                </div>
                {admin && (
                  <button onClick={() => setShowNewCat(s => !s)}
                    className="flex items-center gap-1 text-[10px] px-2.5 py-1 rounded-lg border border-border/50 hover:bg-muted/20 active:scale-95 transition">
                    <Plus size={11} /> AÑADIR
                  </button>
                )}
              </div>

              {showNewCat && (
                <div className="p-3 rounded-xl border border-primary/20 bg-primary/[0.03] space-y-2">
                  <input value={catName} onChange={e => setCatName(e.target.value)} placeholder="Nombre de la categoría"
                    maxLength={30} className="w-full bg-white/70 rounded-lg px-3 py-2 text-sm outline-none border border-border/50 focus:border-primary/40" />
                  <input value={catDesc} onChange={e => setCatDesc(e.target.value)} placeholder="Descripción"
                    maxLength={100} className="w-full bg-white/70 rounded-lg px-3 py-2 text-sm outline-none border border-border/50 focus:border-primary/40" />
                  <div className="flex items-center gap-2">
                    <select value={catIcon} onChange={e => setCatIcon(e.target.value)}
                      className="flex-1 bg-white/70 rounded-lg px-3 py-2 text-xs outline-none border border-border/50">
                      <option value="globe">🌍 General</option>
                      <option value="life-buoy">🛟 Ayuda</option>
                      <option value="trophy">🏆 Showcase</option>
                      <option value="message-circle-more">💬 Feedback</option>
                      <option value="coffee">☕ Off-Topic</option>
                    </select>
                    <button onClick={() => { setShowNewCat(false); setCatName(""); setCatDesc(""); }}
                      className="px-3 py-2 rounded-lg border border-border/50 text-[10px] hover:bg-muted/20 transition-colors">
                      <X size={13} />
                    </button>
                    <button onClick={handleNewCategory} disabled={!catName.trim()}
                      className="px-4 py-2 rounded-lg grad-brand text-primary-foreground text-[10px] font-display tracking-wider disabled:opacity-40 active:scale-95 transition shadow-sm shadow-primary/25">
                      <Check size={13} />
                    </button>
                  </div>
                </div>
              )}

              <div className="flex flex-wrap gap-1.5">
                {categories.map(cat => (
                  <div key={cat.id}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-border/30 bg-white/60 text-xs">
                    <span className="font-display font-medium">{cat.name}</span>
                    <span className="text-[10px] text-muted-foreground/50">{cat.threadCount} hilos</span>
                    {admin && (
                      <button onClick={() => handleDeleteCategory(cat.id)}
                        className="text-muted-foreground/30 hover:text-destructive transition-colors p-0.5 active:scale-90"
                        title="Eliminar categoría">
                        <X size={11} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* ── Threads list ── */}
            <div className="font-display text-[10px] tracking-widest text-primary/70 flex items-center gap-1 px-1 pt-2">
              <MessageSquare size={12} /> TODOS LOS HILOS ({threads.length})
            </div>

            {threads.length === 0 ? (
              <div className="text-center text-xs text-muted-foreground py-10">No hay hilos en el foro.</div>
            ) : threads.map(t => {
              const author = t.authorId ? threadAuthors.get(t.authorId) ?? null : null;
              return (
              <div key={t.id} className="panel border border-border/50 rounded-xl px-3 py-2.5 flex items-center gap-3">
                <Link to="/profile/$userId" params={{ userId: t.authorId }} title={`Ver perfil de ${t.authorUsername}`}
                  className="w-9 h-9 rounded-full overflow-hidden shrink-0 block">
                  <Avatar p={author} size={36} />
                </Link>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-display truncate flex items-center gap-1.5">
                    {t.pinned && <span className="text-[8px] text-primary uppercase tracking-wider font-semibold">📌</span>}
                    {t.closed && <span className="text-[8px] text-rose-500 uppercase tracking-wider font-semibold">🔒</span>}
                    {t.title}
                  </div>
                  <div className="text-[10px] text-muted-foreground/60 mt-0.5 flex items-center gap-2">
                    <Link to="/profile/$userId" params={{ userId: t.authorId }} className="hover:text-primary hover:underline transition-colors">@{t.authorUsername}</Link>
                    <span>{t.postCount} respuestas</span>
                    <span>{t.views} vistas</span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-[9px] px-2 py-0.5 rounded-full bg-muted/30 text-muted-foreground/60 border border-border/30">
                    {categories.find(c => c.id === t.categoryId)?.name ?? "?"}
                  </span>
                  {admin && (
                    <button onClick={() => handleDeleteThread(t.id)}
                      className="w-8 h-8 grid place-items-center rounded-lg border border-destructive/30 text-destructive/70 hover:bg-destructive/10 hover:border-destructive/50 active:scale-90 transition"
                      title="Eliminar hilo">
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              </div>
            );
            })}
          </>
        )}
      </main>
    </div>
  );
}
