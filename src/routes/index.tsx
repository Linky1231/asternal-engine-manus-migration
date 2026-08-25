import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { Avatar } from "@/components/social/Avatar";
import { Component, useEffect, useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Gamepad2, Newspaper, Search, LogOut, Wrench, Plus, ShieldCheck, User, Sparkles, Star, Menu, MessageCircle, Bell, X, Home, Users, Flame, MessageSquare, Compass, Palette, Trophy, BarChart3, ChevronRight, Megaphone, Bot, FileText, TrendingUp, Info } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { fetchFeed, fetchGames, fetchFollowing, getMyProfile, isMod, isAdmin, type PostWithMeta, type Profile } from "@/lib/social/api";
import { rankFeedWithOrion } from "@/lib/ai/community-orion";
import { syncAllProjects } from "@/lib/engine/cloud-sync";
import { PostComposer } from "@/components/social/PostComposer";
import { PostCard } from "@/components/social/PostCard";
import { GamesHome } from "@/components/social/GamesHome";
import { NotificationBell } from "@/components/social/NotificationBell";
import { ProfilePanel } from "@/components/social/ProfilePanel";
import { NotificationsPanel } from "@/components/social/NotificationsPanel";
import ChatSection from "@/components/social/ChatSection";
import OrionPanel from "@/components/ai/OrionPanel";
import { ForumSection } from "@/components/social/ForumSection";
import { StoreSection } from "@/components/social/StoreSection";
import { EventsSection } from "@/components/social/EventsSection";
import { GamePageSection } from "@/components/social/GamePageSection";
import { isTabLoading, shouldFetchPrimaryTab } from "@/lib/social/tab-switch";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Asternal — Juegos y Comunidad" },
      { name: "description", content: "Descubre y juega creaciones hechas con Asternal. Crea las tuyas y publícalas al instante." },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" },
    ],
  }),
  component: HomePage,
});

type Tab = "games" | "feed" | "gallery" | "profile";
type FeedSub = "forYou" | "following" | "explore";

/**
 * Aisla el chat: si algo falla dentro de él (error inesperado de render o
 * efecto), solo se cierra el chat con un aviso en vez de tumbar toda la app
 * con la página de error de la ruta.
 */
class ChatBoundary extends Component<
  { onClose: () => void; onRetry: () => void; children: React.ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (this.state.failed) {
      return (
        <div className="fixed inset-0 z-[90] bg-background/97 backdrop-blur-xl grid place-items-center p-6">
          <div className="text-center max-w-xs">
            <div className="w-12 h-12 mx-auto mb-3 rounded-2xl bg-destructive/10 grid place-items-center">
              <MessageCircle size={20} className="text-destructive" />
            </div>
            <p className="text-sm font-semibold mb-1">El chat tuvo un problema</p>
            <p className="text-xs text-muted-foreground mb-4 leading-relaxed">
              Cierra y vuelve a abrirlo. Si persiste, revisa la conexión de Supabase.
            </p>
            <div className="flex items-center justify-center gap-2">
              <button
                onClick={this.props.onRetry}
                className="px-4 py-2 rounded-xl btn-grad text-xs font-display tracking-widest"
              >
                REINTENTAR
              </button>
              <button
                onClick={this.props.onClose}
                className="px-4 py-2 rounded-xl border border-line-strong bg-card text-foreground text-xs font-display tracking-widest hover:bg-muted/60 transition"
              >
                VOLVER
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function HomePage() {
  const navigate = useNavigate();
  const [me, setMe] = useState<Profile | null>(null);
  const [myId, setMyId] = useState<string | null>(null);
  const [mod, setMod] = useState(false);
  const [admin, setAdmin] = useState(false);
  const [tab, setTab] = useState<Tab>("games");
  const [feedSub, setFeedSub] = useState<FeedSub>("forYou");
  const [games, setGames] = useState<PostWithMeta[]>([]);
  const [posts, setPosts] = useState<PostWithMeta[]>([]);
  const [followingIds, setFollowingIds] = useState<string[]>([]);
  const [loadingTab, setLoadingTab] = useState<Tab | null>("games");
  const loadedTabsRef = useRef<Set<Tab>>(new Set());
  const [search, setSearch] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatInitialView, setChatInitialView] = useState<"group" | "dms" | "groups" | undefined>(undefined);
  const [chatRetryNonce, setChatRetryNonce] = useState(0);
  const [orionOpen, setOrionOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [chatShareText, setChatShareText] = useState<string | null>(null);
  const [chatShareView, setChatShareView] = useState<"group" | "dms" | "groups" | undefined>(undefined);
  const [eventsOpen, setEventsOpen] = useState(false);
  const [gamePageId, setGamePageId] = useState<string | null>(null);
  const [inPreview, setInPreview] = useState(false);

  // When the app runs embedded in the Freebuff preview (inside an iframe), the
  // platform's floating button overlaps the top-right of the app. Push the
  // header row down so the menu (☰) stays visible and tappable there.
  useEffect(() => {
    try {
      setInPreview(typeof window !== "undefined" && window.self !== window.top);
    } catch { /* cross-origin access can throw; treat as standalone */ }
  }, []);

  // Abrir el chat con un mensaje compartido (botón «Compartir en el chat» del perfil).
  useEffect(() => {
    try {
      const t = sessionStorage.getItem("asternal_chat_share");
      if (t) {
        sessionStorage.removeItem("asternal_chat_share");
        setChatShareText(t);
        setChatOpen(true);
      }
    } catch { /* noop */ }
    // También escuchar CustomEvents para compartir en tiempo real (sin depender de remount)
    const handler = (e: Event) => {
      const d = (e as CustomEvent).detail;
      if (typeof d === "string") {
        setChatShareText(d);
        setChatOpen(true);
      } else if (d && typeof d === "object") {
        setChatShareText(d.text ?? null);
        setChatShareView(d.view ?? undefined);
        setChatOpen(true);
      }
    };
    window.addEventListener("asternal_share_chat", handler);
    return () => window.removeEventListener("asternal_share_chat", handler);
  }, []);

  // Al cambiar de apartado del encabezado (JUEGOS/FEED/GALERÍA/EVENTOS/PERFIL)
  // la página vuelve al inicio: si estabas scrolleado abajo, la nueva sección
  // empezaba desde esa posición y no se veían su cabecera ni su indicador de
  // carga. Al reiniciar el scroll siempre se muestra desde arriba.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [tab]);

  const reload = useCallback(async (which: Tab) => {
    if (which !== "games" && which !== "feed") return;
    setLoadingTab(which);
    try {
      if (which === "games") setGames(await fetchGames({ search: search || undefined }));
      else {
        const feed = await fetchFeed({ search: search || undefined });
        setPosts(await rankFeedWithOrion(feed, followingIds));
      }
      loadedTabsRef.current.add(which);
      getMyProfile().then(p => p && setMe(p)).catch(() => {/* ignore */});
    } finally {
      setLoadingTab(current => current === which ? null : current);
    }
  }, [search, followingIds]);

  // Callback estable para PostCard (memoizado): no cambia de identidad en cada
  // render, así abrir un menú en una tarjeta no fuerza a re-renderizar el resto.
  const onFeedChange = useCallback(() => reload("feed"), [reload]);

  useEffect(() => {
    (async () => {
      try {
        let session = null;
        try {
          const res = await supabase.auth.getSession();
          session = res.data?.session ?? null;
        } catch {
          /* Credenciales de Supabase rotas/inaccesibles → se intenta la cuenta local */
        }
        let uid: string | null = session?.user?.id ?? null;
        let localSession = false;
        if (!uid) {
          // Puente: cuenta local creada antes de conectar Supabase (o credenciales
          // inválidas). La app sigue funcionando en modo local en lugar de
          // redirigir en bucle a /auth.
          try {
            const raw = localStorage.getItem("_local_auth_session");
            if (raw) {
              const s = JSON.parse(raw) as { userId?: string; expiresAt?: string };
              if (s.userId && s.expiresAt && new Date(s.expiresAt) > new Date()) {
                uid = s.userId;
                localSession = true;
              }
            }
          } catch { /* noop */ }
        }
        if (!uid) { navigate({ to: "/auth" }); return; }
        setMyId(uid);
        void fetchFollowing(uid)
          .then(profiles => setFollowingIds(profiles.map(profile => profile.id)))
          .catch(() => setFollowingIds([]));
        // Estado de la nube: conectada (claves reales + cuenta real), cuenta
        // local con Supabase conectado, o modo local puro (todo en el navegador).
        // Sincroniza los proyectos con la nube (sube los locales sin respaldo y
        // descarga los de la cuenta) para que los juegos aparezcan en cualquier
        // dispositivo con la misma cuenta. Silencioso: no bloquea la carga.
        if (!localSession) {
          syncAllProjects().then(r => {
            if (r.pushed > 0 || r.imported > 0) {
              toast.success(
                `Nube sincronizada: ${r.pushed} subido${r.pushed === 1 ? "" : "s"} · ${r.imported} descargado${r.imported === 1 ? "" : "s"}`
              );
            }
          }).catch(() => {/* noop */});
        }
        let prof: Profile | null = null;
        try { prof = await getMyProfile(); } catch { /* noop */ }
        if (!prof && localSession) {
          // El perfil de la cuenta local vive en localStorage.
          try {
            const rows = JSON.parse(localStorage.getItem("_local_data_profiles") || "[]") as Profile[];
            prof = rows.find((p) => p.id === uid) ?? null;
          } catch { /* noop */ }
        }
        if (prof) setMe(prof);
        try { setMod(await isMod()); } catch { /* noop */ }
        try { setAdmin(await isAdmin()); } catch { /* noop */ }
        // Las listas se cargan desde el efecto dependiente de `myId`, después de
        // que React haya confirmado el identificador de sesión.
      } catch (e) {
        // No romper la preview si el esquema aún no está creado en Supabase.
        console.warn("[home] error de carga inicial (¿esquema sin crear?):", e);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (myId && shouldFetchPrimaryTab(tab, loadedTabsRef.current)) {
      void reload(tab);
    }
  }, [tab, reload, myId]);

  const logout = async () => { await supabase.auth.signOut(); navigate({ to: "/auth" }); };
  const closeMenu = () => { setMenuOpen(false); setNotifOpen(false); };

  return (
    <div className="min-h-screen w-full flex flex-col bg-background text-foreground">
      {/* Header */}
      {/* Material de vidrio contenido: blur moderado para mantener el scroll fluido. */}
      <header className="app-header glass-header sticky top-0 z-20 border-b">
        <div className={`max-w-2xl md:max-w-3xl lg:max-w-5xl xl:max-w-6xl mx-auto flex items-center gap-2 sm:gap-2.5 px-3 sm:px-4 ${inPreview ? "pt-14 pb-3" : "py-2.5"}`}>
          <button onClick={() => navigate({ to: "/profile" })} title="Mi perfil"
            className="glass-control w-9 h-9 sm:w-10 sm:h-10 rounded-xl overflow-hidden active:scale-95 shrink-0">
            <Avatar p={me} className="w-full h-full" />
          </button>
          <div className="flex-1 min-w-0 header-name">
            <div className="font-display text-[13px] sm:text-sm font-semibold text-foreground leading-none truncate">Asternal</div>
            <div className="text-[10px] sm:text-[11px] text-ink-3 truncate mt-1">@{me?.username ?? "…"}</div>
          </div>
          {typeof me?.orbes === "number" && me?.show_orbes !== false && (
            <div
              title={`${me.orbes} orbes`}
              className="flex items-center gap-1.5 h-8 sm:h-9 px-2 sm:px-2.5 rounded-lg bg-primary/10 text-primary border border-primary/15 shrink-0 select-none"
            >
              <Sparkles size={12} className="text-primary shrink-0" fill="currentColor" />
              <span className="text-[11px] sm:text-xs font-display font-semibold tabular-nums">{me.orbes}</span>
            </div>
          )}
          <button onClick={() => setMenuOpen(true)} title="Menú"
            className="glass-control w-9 h-9 rounded-lg text-ink-2 grid place-items-center hover:text-foreground active:scale-95 shrink-0">
            <Menu size={16} />
          </button>
        </div>

        {showSearch && (
          <div className="max-w-2xl md:max-w-3xl lg:max-w-5xl xl:max-w-6xl mx-auto px-3 pb-2 flex gap-2 animate-in fade-in slide-in-from-top-2">
            <input value={search} onChange={e => setSearch(e.target.value)}
              onKeyDown={e => e.key === "Enter" && reload(tab)}
              placeholder={tab === "games" ? "Buscar juegos…" : "Buscar publicaciones…"}
              className="glass-control flex-1 rounded-lg px-3 py-2 text-sm outline-none placeholder:text-muted-foreground" />
            <button onClick={() => reload(tab)}
              className="px-4 py-2 rounded-lg btn-grad text-xs font-display tracking-widest shrink-0">IR</button>
          </div>
        )}

      </header>

      {/* Content */}
      <main className="flex-1 max-w-2xl md:max-w-3xl lg:max-w-5xl xl:max-w-6xl mx-auto w-full px-3 py-3 space-y-3 pb-24">
        {/* El contenido anterior se desmonta al instante: `mode="wait"` hacía que
            varios toques consecutivos se encolaran detrás de la salida anterior. */}
        <motion.div
          key={tab}
          initial={{ opacity: 0.92 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.1, ease: "easeOut" }}
          className="space-y-3"
        >
            {tab === "games" ? (
              isTabLoading("games", loadingTab) ? <SkeletonList /> : (
                <GamesHome games={games} myId={myId} isMod={mod} onChange={() => reload("games")} onOpenGame={(id) => setGamePageId(id)} />
              )
            ) : tab === "feed" ? (
              <div className="max-w-2xl md:max-w-3xl mx-auto w-full">
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.15, ease: "easeOut" }}
                >
                  <PostComposer onCreated={() => reload("feed")} />
                </motion.div>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.15, delay: 0.05, ease: "easeOut" }}
                >
                  <FeedSubTabs value={feedSub} onChange={setFeedSub} />
                </motion.div>
                <motion.div
                  key={feedSub}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.12, ease: "easeOut" }}
                >
                  {isTabLoading("feed", loadingTab) ? <SkeletonList /> : (() => {
                    const filtered = filterFeed(posts, feedSub, myId, followingIds);
                    if (filtered.length === 0) {
                      return (
                        <div className="text-center text-xs text-muted-foreground py-10 space-y-2">
                          <div className="w-14 h-14 mx-auto rounded-xl bg-primary/10 border border-primary/20 grid place-items-center mb-2">
                            {feedSub === "forYou" ? <Compass size={24} className="text-primary" /> : feedSub === "following" ? <Users size={24} className="text-primary" /> : <Flame size={24} className="text-primary" />}
                          </div>
                          <div className="font-medium text-foreground/70">
                            {feedSub === "forYou"
                              ? "Tu feed personalizado"
                              : feedSub === "following"
                              ? "Contenido de tus seguidos"
                              : "Descubre contenido nuevo"}
                          </div>
                          <div className="text-[11px] text-muted-foreground/60 max-w-[260px] mx-auto">
                            {feedSub === "forYou"
                              ? "Publica, sigue creadores yerra para construir tu feed."
                              : feedSub === "following"
                              ? "Sigue a desarrolladores para ver sus actualizaciones aquí."
                              : "Explora proyectos, tutoriales y publicaciones destacadas de la comunidad."}
                          </div>
                        </div>
                      );
                    }

                    // Explorar también conserva el resultado completo: Orión solo
                    // decide la posición. No hay cortes por categoría ni límites
                    // que puedan hacer desaparecer publicaciones de la vista.
                    if (feedSub === "explore") {
                      return (
                        <div>
                          <h3 className="text-xs font-display font-bold tracking-wider text-primary/80 uppercase mb-1 flex items-center gap-2">
                            <TrendingUp size={13} /> Recomendado por Orión
                          </h3>
                          <p className="text-[11px] text-muted-foreground mb-3">Todas las publicaciones aparecen aquí; Orión únicamente ajusta su orden.</p>
                          <div className="space-y-3">
                            {filtered.map((p, i) => (
                              <div key={p.id} className="card-enter" style={{ animationDelay: `${Math.min(i * 25, 180)}ms` }}>
                                <PostCard post={p} myId={myId} isMod={mod} onChange={onFeedChange} onOpenGame={(id) => setGamePageId(id)} />
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    }

                    return filtered.map((p, i) => (
                      <div key={p.id} className="card-enter mb-3 last:mb-0" style={{ animationDelay: `${Math.min(i * 25, 180)}ms` }}>
                        <PostCard post={p} myId={myId} isMod={mod} onChange={onFeedChange} onOpenGame={(id) => setGamePageId(id)} />
                      </div>
                    ));
                  })()}
                </motion.div>
              </div>
            ) : tab === "gallery" ? (
              <StoreSection myId={myId} isMod={mod} />
            ) : (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.15, ease: "easeOut" }}
              >
                {myId && (
                  <div className="max-w-2xl md:max-w-3xl lg:max-w-4xl mx-auto w-full">
                    <ProfilePanel userId={myId} myId={myId} isMod={mod} viewingOwn={true} onProfileChange={setMe} />
                  </div>
                )}
              </motion.div>
            )}
        </motion.div>
      </main>



      {/* Menu drawer — dos AnimatePresence separados (el fragment <> no desmonta en exit) */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            key="menu-overlay"
            className="fixed inset-0 z-[100] bg-black/55 backdrop-blur-md"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            onClick={closeMenu}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            key="menu-drawer"
            onClick={e => e.stopPropagation()}
            className="menu-drawer fixed right-0 top-0 z-[101] h-full w-[86vw] max-w-xs bg-card border-l border-border shadow-md px-4 py-4 flex flex-col overflow-y-auto"
            initial={{ x: "100%", opacity: 0.4 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: "100%", opacity: 0 }}
            transition={{ type: "tween", duration: 0.26, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="section-label">MENÚ</div>
              <button onClick={closeMenu}
                className="w-8 h-8 rounded-lg border border-line-strong bg-card text-ink-2 grid place-items-center hover:bg-muted/60 hover:text-foreground active:scale-95 transition">
                <X size={14}/>
              </button>
            </div>
            {/* Acceso directo al perfil: al tocar la foto sales del menú y vas a tu perfil */}
            <button
              onClick={() => { closeMenu(); navigate({ to: "/profile" }); }}
              className="flex items-center gap-3 p-2.5 rounded-2xl border border-white/60 bg-white/30 hover:bg-white/55 hover:border-primary/15 active:scale-[0.98] transition mb-2 text-left group"
            >
              <Avatar p={me} size={40} className="ring-2 ring-primary/15" />
              <div className="min-w-0 flex-1">
                <div className="font-display text-sm truncate group-hover:text-primary transition-colors">{me?.display_name ?? me?.username ?? "Mi perfil"}</div>
                <div className="text-[11px] font-mono text-muted-foreground truncate">@{me?.username ?? "…"} · Ver perfil</div>
              </div>
              <ChevronRight size={16} className="text-muted-foreground/50 shrink-0 group-hover:translate-x-0.5 transition-transform" />
            </button>
            {/* Categoría: SOCIAL */}
            <CategoryHeader label="SOCIAL" />
            <div className="menu-section-list">
              <MenuItem icon={<MessageCircle size={16} className="text-primary/80"/>} label="Chats" onClick={() => { setChatOpen(true); closeMenu(); }} />
              <MenuItem icon={<Bot size={16} className="text-primary/80"/>} label="Asistencia · Orión" onClick={() => { setOrionOpen(true); closeMenu(); }} />
              <MenuLink icon={<Search size={16} className="text-primary/80"/>} label="Buscar" to="/search" onClick={closeMenu} />
              <MenuItem icon={<Bell size={16} className="text-primary/80"/>} label="Notificaciones" onClick={() => { setMenuOpen(false); setNotifOpen(true); }} />
            </div>

            {/* Categoría: COMUNIDAD */}
            <CategoryHeader label="COMUNIDAD" />
            <div className="menu-section-list">
              <MenuItem icon={<Trophy size={16} className="text-primary/80"/>} label="Eventos" onClick={() => { setEventsOpen(true); closeMenu(); }} />
              <MenuLink icon={<BarChart3 size={16} className="text-primary/80"/>} label="Historial" to="/history" onClick={closeMenu} />
              <MenuLink icon={<Megaphone size={16} className="text-primary/80"/>} label="Panel de Orbes" to="/orbes" onClick={closeMenu} />
              <MenuLink icon={<Info size={16} className="text-primary/80"/>} label="Acerca de nosotros" to="/about" onClick={closeMenu} />
              {(mod || admin) && (
                <MenuLink icon={<ShieldCheck size={16} className="text-primary/80"/>} label="Moderación" to="/admin" onClick={closeMenu} />
              )}
            </div>

            {/* Categoría: CREACIÓN */}
            <CategoryHeader label="CREACIÓN" />
            <div className="menu-section-list">
              <MenuLink icon={<Wrench size={16} className="text-primary/80"/>} label="Editor" to="/editor" onClick={closeMenu} />
              <MenuLink icon={<Star size={16} fill="currentColor" style={{ color: "var(--plus)" }}/>} label="Centro Plus" to="/plus" onClick={closeMenu} />
            </div>

            <div className="mt-3" />
            <button onClick={() => { logout(); closeMenu(); }}
              className="mt-5 flex items-center gap-3 px-3 h-11 rounded-xl border border-destructive/15 bg-destructive/5 text-destructive hover:bg-destructive/10 active:scale-[0.98] transition">
              <LogOut size={16} /> <span className="text-sm font-medium">Cerrar sesión</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Full-screen chat */}
      {chatOpen && (
        <ChatBoundary
          onClose={() => setChatOpen(false)}
          onRetry={() => setChatRetryNonce((n) => n + 1)}
        >
          <ChatSection
            key={chatRetryNonce}
            myId={myId}
            onClose={() => { setChatOpen(false); setChatShareText(null); setChatShareView(undefined); }}
            initialText={chatShareText ?? undefined}
            initialView={chatShareView}
          />
        </ChatBoundary>
      )}

      {/* Full-screen asistente Orión */}
      <AnimatePresence>
        {orionOpen && <OrionPanel onClose={() => setOrionOpen(false)} />}
      </AnimatePresence>

      {/* Full-screen panel de notificaciones */}
      {notifOpen && <NotificationsPanel onClose={() => setNotifOpen(false)} />}

      {/* Full-screen panel de Eventos */}
      <AnimatePresence>
        {eventsOpen && (
          <motion.div
            key="events-panel"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="fixed inset-0 z-[90] bg-background flex flex-col"
            style={{ height: "100dvh" }}
          >
            <header className="shrink-0 border-b border-border/60 bg-background">
              <div className="max-w-2xl md:max-w-3xl mx-auto flex items-center gap-2.5 px-4 py-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 text-primary grid place-items-center shrink-0">
                  <Trophy size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-base font-display font-semibold text-foreground">Eventos</h2>
                  <p className="text-xs text-muted-foreground">Participa en concursos y gana premios</p>
                </div>
                <button
                  onClick={() => setEventsOpen(false)}
                  className="w-9 h-9 rounded-xl border border-border/70 bg-background grid place-items-center active:scale-95 transition shrink-0"
                >
                  <X size={16} />
                </button>
              </div>
            </header>
            <div className="flex-1 overflow-y-auto no-scrollbar">
              <div className="max-w-2xl md:max-w-3xl mx-auto px-4 py-4">
                <EventsSection isAdmin={admin} showHeader={false} />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Full-screen game page */}
      {gamePageId && (
        <GamePageSection
          gameId={gamePageId}
          myId={myId}
          isMod={mod}
          onClose={() => setGamePageId(null)}
        />
      )}

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 inset-x-0 z-30 bg-background/95 backdrop-blur-md border-t border-border/70" style={{ paddingBottom: "env(safe-area-inset-bottom)" }} aria-label="Navegación principal">
        <div className="max-w-2xl md:max-w-3xl lg:max-w-5xl xl:max-w-6xl mx-auto px-3 py-2">
          {/* Tabs with gray selector — Juegos | Feed | +CREAR | Tienda | Perfil */}
          <div className="grid grid-cols-5 bg-muted/60 rounded-xl p-0.5 relative">
            {/* Single sliding pill — GPU-composited transform, no layout reflow */}
            <div
              className="absolute top-0.5 bottom-0.5 w-[calc((100%-4px)/5)] rounded-[10px] bg-white shadow-sm will-change-transform transition-[transform,width] duration-300 [transition-timing-function:cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
              style={{
                left: 0,
                transform: `translateX(${
                  tab === "games" ? 0
                  : tab === "feed" ? 100
                  : tab === "gallery" ? 300
                  : 400
                }%)`,
                pointerEvents: "none" as const,
              }}
            />

            {/* Juegos */}
            <button
              onClick={() => setTab("games")}
              className={`relative z-10 flex flex-col items-center justify-center gap-0.5 min-h-14 rounded-[10px] transition-colors duration-200 motion-reduce:transition-none ${tab === "games" ? "text-foreground" : "text-muted-foreground/80 hover:text-foreground"}`}
            >
              <Gamepad2 size={18} />
              <span className="text-[9px] font-semibold tracking-wide">Juegos</span>
            </button>
            {/* Feed */}
            <button
              onClick={() => setTab("feed")}
              className={`relative z-10 flex flex-col items-center justify-center gap-0.5 min-h-14 rounded-[10px] transition-colors duration-200 motion-reduce:transition-none ${tab === "feed" ? "text-foreground" : "text-muted-foreground/80 hover:text-foreground"}`}
            >
              <Newspaper size={18} />
              <span className="text-[9px] font-semibold tracking-wide">Feed</span>
            </button>

            {/* Center CREAR button */}
            <Link
              to="/editor"
              className="relative z-10 flex flex-col items-center justify-center gap-1 min-h-14 rounded-[10px] text-primary hover:text-primary/80 active:scale-[0.97] transition-transform motion-reduce:transition-none"
            >
              <div className="w-9 h-9 rounded-xl grad-brand shadow-[0_7px_16px_-10px_oklch(0.47_0.14_263_/_0.9)] flex items-center justify-center">
                <Plus size={19} strokeWidth={2.5} className="text-white" />
              </div>
              <span className="text-[9px] font-bold tracking-wide">Crear</span>
            </Link>

            {/* Galería de artistas */}
            <button
              onClick={() => setTab("gallery")}
              className={`relative z-10 flex flex-col items-center justify-center gap-0.5 min-h-14 rounded-[10px] transition-colors duration-200 motion-reduce:transition-none ${tab === "gallery" ? "text-foreground" : "text-muted-foreground/80 hover:text-foreground"}`}
            >
              <Palette size={18} />
              <span className="text-[9px] font-semibold tracking-wide">Galería</span>
            </button>
            {/* Perfil */}
            <button
              onClick={() => setTab("profile")}
              className={`relative z-10 flex flex-col items-center justify-center gap-0.5 min-h-14 rounded-[10px] transition-colors duration-200 motion-reduce:transition-none ${tab === "profile" ? "text-foreground" : "text-muted-foreground/80 hover:text-foreground"}`}
            >
              <User size={18} />
              <span className="text-[9px] font-semibold tracking-wide">Perfil</span>
            </button>
          </div>
        </div>
      </nav>

    </div>
  );
}

function SkeletonList() {
  return (
    <div className="space-y-3">
      {[0, 1, 2].map(i => (
        <div key={i} className="rounded-lg border border-border/70 bg-surface overflow-hidden animate-pulse">
          <div className="aspect-[16/10] bg-muted/40" />
          <div className="p-3 space-y-2">
            <div className="h-3 w-1/2 bg-muted/50 rounded" />
            <div className="h-2.5 w-1/3 bg-muted/40 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

function MenuLink({ icon, label, to, onClick }: { icon: React.ReactNode; label: string; to: string; onClick?: () => void }) {
  return (
    <Link to={to} onClick={onClick}
      className="menu-action flex items-center gap-3 px-3 h-10 rounded-xl text-ink hover:bg-muted/60 active:scale-[0.98] transition">
      {icon} <span className="text-[13px] font-medium">{label}</span>
    </Link>
  );
}

function MenuItem({ icon, label, onClick, children }: { icon: React.ReactNode; label: string; onClick?: () => void; children?: React.ReactNode }) {
  return (
    <button onClick={onClick}
      className="menu-action flex items-center gap-3 px-3 h-10 rounded-xl text-ink hover:bg-muted/60 active:scale-[0.98] transition w-full text-left">
      {icon} <span className="text-[13px] font-medium flex-1">{label}</span>
      {children}
    </button>
  );
}

function CategoryHeader({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 pt-3.5 pb-1.5">
      <div className="section-label">{label}</div>
      <div className="flex-1 h-px bg-border/60" />
    </div>
  );
}

// Barra de pestañas de publicaciones reconstruida desde cero: botones estáticos
// con estado activo por clases condicionales. SIN píldora deslizante, sin refs,
// sin medición de layout, sin listeners de scroll y sin framer-motion: nada que
// pueda desalinearse, saltar o dar lag. Los botones se reparten el ancho con
// flex-1 y nunca desbordan la fila, así el bug de "la píldora se va al otro
// extremo" es imposible por construcción.
function FeedSubTabs({ value, onChange }: { value: FeedSub; onChange: (v: FeedSub) => void }) {
  const items: { id: FeedSub; label: string; icon: React.ReactNode }[] = [
    { id: "forYou", label: "Para ti", icon: <Compass size={13} /> },
    { id: "following", label: "Seguidos", icon: <Users size={13} /> },
    { id: "explore", label: "Explorar", icon: <Flame size={13} /> },
  ];
  return (
    <div className="flex gap-1.5 pt-1 pb-2">
      {items.map((it) => {
        const active = value === it.id;
        return (
          <button
            key={it.id}
            onClick={() => onChange(it.id)}
            aria-pressed={active}
            className={`flex-1 min-w-0 flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-xl text-[10px] sm:text-[11px] font-display font-semibold tracking-wide whitespace-nowrap border transition-colors duration-200 outline-none focus:outline-none active:scale-[0.97] ${
              active
                ? "border-transparent grad-brand text-primary-foreground shadow-sm"
                : "border-line-strong bg-card text-muted-foreground hover:border-primary/25 hover:text-foreground"
            }`}
          >
            {it.icon} {it.label.toUpperCase()}
          </button>
        );
      })}
    </div>
  );
}

function filterFeed(posts: PostWithMeta[], sub: FeedSub, myId: string | null, followingIds: string[]): PostWithMeta[] {
  if (sub === "following") {
    if (!myId) return [];
    const following = new Set(followingIds);
    return posts.filter(post => following.has(post.author_id));
  }
  // «Para ti» y «Explorar» conservan el orden semántico que entregó Orión.
  // Los conteos de reacciones no participan en esta decisión.
  return posts;
}
