import { useEffect, useState, useMemo } from "react";
import { Avatar } from "./Avatar";
import { motion, AnimatePresence } from "framer-motion";
import {
  Palette, Sparkles, X, Loader2, ImagePlus, CheckCircle2,
  Heart, MessageCircle, AlertTriangle, Search, Clock, TrendingUp,
  DollarSign, Gift, Eye, ExternalLink, Package,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import {
  type PostWithMeta, type Profile,
  fetchArtworks, fetchMyArtworks, purchaseArtwork, publishArtwork, resellArtwork,
  getMyProfile, getMyOrbes, toggleReaction,
} from "@/lib/social/api";
import { CommentSection } from "@/components/social/CommentSection";
import type { SpriteAsset } from "@/lib/engine/core";
import { GalleryCanvasPanel } from "@/components/social/GalleryCanvasPanel";
import { makeOrionImagePreview, reviewArtworkWithOrion } from "@/lib/ai/community-orion";

const TABS: { id: string; label: string; icon: typeof Clock }[] = [
  { id: "recent", label: "Recientes", icon: Clock },
  { id: "popular", label: "Populares", icon: TrendingUp },
  { id: "free", label: "Gratis", icon: Gift },
  { id: "paid", label: "De pago", icon: DollarSign },
];

export function GallerySection({ myId, isMod: _isMod, onRefresh }: {
  myId: string | null; isMod: boolean; onRefresh?: () => void;
}) {
  const [artworks, setArtworks] = useState<PostWithMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [tab, setTab] = useState("recent");
  const [searchQ, setSearchQ] = useState("");

  // Tabs estáticas reconstruidas desde cero: botones fijos con estado activo
  // por clases condicionales. SIN píldora, sin refs, sin medición de layout,
  // sin listeners de scroll y sin framer-motion: nada que pueda desalinearse,
  // saltar o dar lag.
  const [canvasOpen, setCanvasOpen] = useState(false);

  // Detail modal
  const [detailPost, setDetailPost] = useState<PostWithMeta | null>(null);

  // Publish dialog
  const [savedSprite, setSavedSprite] = useState<SpriteAsset | null>(null);
  const [pubTitle, setPubTitle] = useState("");
  const [pubPrice, setPubPrice] = useState(0);
  const [publishing, setPublishing] = useState(false);
  const [reviewingArtwork, setReviewingArtwork] = useState(false);
  const [pubErr, setPubErr] = useState<string | null>(null);
  const [pubDone, setPubDone] = useState(false);

  // Like state
  const [likingId, setLikingId] = useState<string | null>(null);

  // Buy modal
  const [buyPostId, setBuyPostId] = useState<string | null>(null);
  const [buyState, setBuyState] = useState<"idle" | "loading" | "success" | "error" | "insufficient">("idle");
  const [balance, setBalance] = useState<number | null>(null);
  const [buyMsg, setBuyMsg] = useState("");

  // Resell dialog
  const [resellPost, setResellPost] = useState<PostWithMeta | null>(null);
  const [resellPrice, setResellPrice] = useState(0);
  const [reselling, setReselling] = useState(false);
  const [resellErr, setResellErr] = useState<string | null>(null);

  const load = async (forTab?: string) => {
    const t = forTab ?? tab;
    setLoading(true);
    try {
      const [arts, p] = await Promise.all([
        t === "misobras" ? fetchMyArtworks() : fetchArtworks(),
        getMyProfile(),
      ]);
      setArtworks(arts);
      setProfile(p);
    } finally { setLoading(false); }
  };
  useEffect(() => { load(tab); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [tab]);

  // --- Canvas save ---
  const handleCanvasSave = (sprite: SpriteAsset) => {
    setCanvasOpen(false);
    setSavedSprite(sprite);
    setPubTitle(sprite.name || "Mi obra");
    setPubPrice(0);
    setPubDone(false);
    setPubErr(null);
  };

  // --- Publish ---
  const doPublish = async () => {
    if (!savedSprite) return;
    if (!pubTitle.trim()) { setPubErr("Escribe un título"); return; }
    setPublishing(true); setPubErr(null);
    try {
      const composite = savedSprite.frames?.[0]?.composite;
      if (!composite) throw new Error("No hay imagen en el dibujo");
      setReviewingArtwork(true);
      const review = await reviewArtworkWithOrion({
        kind: "artwork",
        title: pubTitle.trim(),
        priceOrbes: pubPrice,
        artwork: { width: savedSprite.width, height: savedSprite.height, frameCount: savedSprite.frames.length },
        previewImage: await makeOrionImagePreview(composite),
      });
      setReviewingArtwork(false);
      if (!review.allowed) throw new Error(review.reason || "Orión no aprobó esta obra para publicarla.");
      await publishArtwork({ title: pubTitle.trim(), imageDataUrl: composite, priceOrbes: pubPrice });
      setPubDone(true);
      setTimeout(() => { setSavedSprite(null); setPubDone(false); setPublishing(false); load(); }, 1200);
    } catch (e) { setPubErr((e as Error).message); setPublishing(false); }
    finally { setReviewingArtwork(false); }
  };

  // --- Like ---
  const likeArt = async (postId: string) => {
    if (!myId) return;
    setLikingId(postId);
    try {
      await toggleReaction({ postId, type: "like" });
      await load();
    } finally { setLikingId(null); }
  };

  // --- Buy ---
  const openBuy = async (postId: string) => {
    setBuyPostId(postId); setBuyState("idle");
    try { setBalance(await getMyOrbes()); } catch { setBalance(0); }
  };
  const confirmBuy = async () => {
    if (!buyPostId) return;
    setBuyState("loading");
    try {
      const res = await purchaseArtwork(buyPostId);
      if (res.already_owned) { setBuyState("success"); setBuyMsg("Ya tienes esta obra."); }
      else if (res.free || (res.ok && (res.paid ?? 0) >= 0)) { setBuyState("success"); setBuyMsg(res.free ? "¡Obra gratuita!" : `Comprada por ${res.paid} orbes.`); load(); }
      else { setBuyState("insufficient"); setBuyMsg(`Te faltan ${(res.balance ?? 0) < 0 ? Math.abs(res.balance ?? 0) : "algunos"} orbes.`); }
    } catch (e) { setBuyState("error"); setBuyMsg((e as Error).message); }
  };

  // --- Resell ---
  const openResell = (art: PostWithMeta) => {
    setResellPost(art);
    setResellPrice(art.resale_price_orbes ?? 0);
    setResellErr(null);
  };
  const doResell = async () => {
    if (!resellPost) return;
    setReselling(true); setResellErr(null);
    try {
      const r = await resellArtwork(resellPost.id, resellPrice);
      if (!r.ok) {
        setResellErr(
          r.error === "not_owner"
            ? "Solo el dueño actual puede revender esta obra."
            : r.error === "not_found"
              ? "La obra ya no existe."
              : "No se pudo actualizar la obra.",
        );
        return;
      }
      setResellPost(null);
      await load();
    } catch (e) { setResellErr((e as Error).message); }
    finally { setReselling(false); }
  };

  // Filter & sort
  const q = searchQ.toLowerCase().trim();
  const filtered = useMemo(() => {
    let list = [...artworks];

    // Search filter
    if (q) {
      list = list.filter(a => {
        const title = a.content.replace(/^🎨\s*/, "").toLowerCase();
        const author = a.author?.username?.toLowerCase() ?? "";
        const seller = a.seller?.username?.toLowerCase() ?? "";
        return title.includes(q) || author.includes(q) || seller.includes(q);
      });
    }

    // Tab filter & sort
    switch (tab) {
      case "recent":
        list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        break;
      case "popular":
        list.sort((a, b) => (b.likes ?? 0) - (a.likes ?? 0));
        break;
      case "free":
        list = list.filter(a => (a.seller_id ? (a.resale_price_orbes ?? 0) : (a.price_orbes ?? 0)) === 0);
        list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        break;
      case "paid":
        list = list.filter(a => (a.seller_id ? (a.resale_price_orbes ?? 0) : (a.price_orbes ?? 0)) > 0);
        list.sort((a, b) => (b.likes ?? 0) - (a.likes ?? 0));
        break;
    }

    return list;
  }, [artworks, q, tab]);

  const mineCount = artworks.filter(a => a.author_id === myId).length;
  // Precio efectivo: si está en reventa, manda el precio del vendedor actual
  const effPrice = (art: PostWithMeta) => art.seller_id ? (art.resale_price_orbes ?? 0) : (art.price_orbes ?? 0);

  return (
    <div className="space-y-5">
      {/* ====== HEADER ====== */}
      <div className="rounded-lg border border-border/70 bg-surface overflow-hidden">
        {/* Hairline degradado superior */}
        <div className="h-[3px] w-full grad-brand-fade opacity-80" />
        <div className="flex items-center justify-between gap-3 p-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 text-primary grid place-items-center shrink-0">
              <Palette size={22} />
            </div>
            <div className="min-w-0">
              <div className="font-display text-base font-semibold truncate tracking-tight flex items-center gap-2">
                Galería
                <span className="text-[9px] font-mono text-muted-foreground/60 bg-muted/50 px-2 py-0.5 rounded-full border border-border/30">
                  Comunidad
                </span>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap text-[10px] font-mono text-muted-foreground/70 mt-1">
                {tab === "misobras" ? (
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted/60 border border-border/30">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                    {artworks.length} obra{artworks.length !== 1 ? "s" : ""} en tu colección
                  </span>
                ) : (
                  <>
                    <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted/60 border border-border/30">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                      {artworks.length} obra{artworks.length !== 1 ? "s" : ""}
                    </span>
                    <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted/60 border border-border/30">
                      <span className="w-1.5 h-1.5 rounded-full bg-accent" />
                      {mineCount} tuya{mineCount !== 1 ? "s" : ""}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
          <button
            onClick={() => setCanvasOpen(true)}
            className="h-10 pl-4 pr-5 rounded-lg grad-brand text-white text-xs font-semibold flex items-center gap-1.5 active:scale-95 transition shrink-0"
          >
            <ImagePlus size={16} /> NUEVA OBRA
          </button>
        </div>
      </div>

      {/* ====== SEARCH BAR ====== */}
      <div className="flex items-center gap-2 bg-surface border border-border/70 rounded-lg px-3.5 py-2.5 focus-within:ring-2 focus-within:ring-primary/25 focus-within:border-primary/40 transition-all duration-300">
        <Search size={15} className="text-muted-foreground shrink-0" />
        <input
          value={searchQ}
          onChange={e => setSearchQ(e.target.value)}
          placeholder="Buscar obras o artistas…"
          className="flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground/50"
        />
        {searchQ && (
          <button onClick={() => setSearchQ("")} className="w-6 h-6 grid place-items-center rounded-lg hover:bg-muted/50 text-muted-foreground transition">
            <X size={13} />
          </button>
        )}
      </div>

      {/* ====== NAVIGATION TABS (estáticas, sin píldora ni medición) ====== */}
      <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
        {TABS.map((t) => {
          const Icon = t.icon;
          const isActive = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[11px] font-display font-semibold transition-colors duration-200 active:scale-95 whitespace-nowrap border ${
                isActive
                  ? "border-transparent bg-primary text-white"
                  : "text-muted-foreground hover:text-foreground bg-muted/30 hover:bg-muted/60 border-border/40"
              }`}
            >
              <Icon size={13} />
              {t.label}
            </button>
          );
        })}
        <button
          onClick={() => setTab("all")}
          className={`shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[11px] font-display font-semibold transition-colors duration-200 active:scale-95 whitespace-nowrap border ${
            tab === "all"
              ? "border-transparent bg-primary text-white"
              : "text-muted-foreground hover:text-foreground bg-muted/30 hover:bg-muted/60 border-border/40"
          }`}
        >
          <Eye size={13} />
          TODO
        </button>
        <button
          onClick={() => setTab("misobras")}
          className={`shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[11px] font-display font-semibold transition-colors duration-200 active:scale-95 whitespace-nowrap border ${
            tab === "misobras"
              ? "border-transparent bg-primary text-white"
              : "text-muted-foreground hover:text-foreground bg-muted/30 hover:bg-muted/60 border-border/40"
          }`}
        >
          <Package size={13} />
          MIS OBRAS
        </button>
      </div>

      {/* ====== ARTWORKS GRID ====== */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <div className="aspect-square rounded-2xl bg-muted/30 animate-pulse" />
              <div className="h-3 w-3/4 rounded-lg bg-muted/20 animate-pulse" />
              <div className="h-2.5 w-1/2 rounded-lg bg-muted/15 animate-pulse" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center py-16 rounded-lg border border-dashed border-border bg-surface"
        >
          <div className="w-16 h-16 rounded-xl bg-primary/10 grid place-items-center mx-auto mb-4">
            <Palette size={32} className="text-muted-foreground/40" />
          </div>
          <div className="text-base font-display text-muted-foreground">
            {q ? `Sin resultados para "${q}"` : tab === "misobras" ? "Tu colección está vacía" : "Aún no hay obras aquí"}
          </div>
          <div className="text-xs text-muted-foreground/60 mt-1.5 max-w-xs mx-auto leading-relaxed">
            {q
              ? "Prueba con otro término de búsqueda"
              : tab === "free"
                ? "No hay obras gratuitas todavía"
                : tab === "paid"
                  ? "No hay obras de pago todavía"
                  : tab === "misobras"
                    ? !myId
                      ? "Inicia sesión para ver tus obras."
                      : "Aún no tienes obras en tu colección. Compra o crea una."
                    : "¡Sé el primero en compartir tu arte con la comunidad!"}
          </div>
          <button
            onClick={() => setCanvasOpen(true)}
            className="mt-5 h-10 px-5 rounded-lg bg-primary text-white text-xs font-semibold active:scale-95 transition"
          >
            <ImagePlus size={14} className="inline mr-1.5" />CREAR OBRA
          </button>
        </motion.div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {filtered.map((art, i) => {
            const imgUrl = art.signed_media?.[0] ?? art.signed_cover;
            const price = effPrice(art);
            const mine = art.author_id === myId;
            const owned = art.owned ?? false;
            const forSale = !!art.seller_id;
            const sellingMe = forSale && art.seller_id === myId;
            const title = art.content.replace(/^🎨\s*/, "");
            return (
              <motion.button
                key={art.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                onClick={() => setDetailPost(art)}
                className="group text-left w-full"
              >
                <div className="relative rounded-lg overflow-hidden border border-border/70 bg-surface hover:border-border-strong transition-colors duration-200 active:scale-[0.97]">
                  {/* Hairline degradado superior */}
                  <div className="h-[2px] w-full grad-brand-fade opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  {/* Image area with decorative gradient border */}
                  <div className="aspect-square bg-muted/20 relative overflow-hidden">
                    {imgUrl ? (
                      <>
                        <div className="absolute inset-0 bg-gradient-to-t from-black/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                        <img
                          src={imgUrl}
                          alt={title}
                          className="w-full h-full object-contain p-3 group-hover:scale-105 transition-transform duration-500 ease-out"
                        />
                      </>
                    ) : (
                      <div className="w-full h-full grid place-items-center">
                        <Palette size={44} className="text-muted-foreground/12" />
                      </div>
                    )}

                    {/* Premium hover overlay with glass effect */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/0 via-black/0 to-black/0 group-hover:from-black/30 group-hover:via-black/10 group-hover:to-transparent transition-all duration-300 flex items-center justify-center">
                      <div className="opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-center gap-1.5 px-4 py-2 rounded-xl bg-black/50 backdrop-blur-sm text-white text-[10px] font-semibold translate-y-3 group-hover:translate-y-0">
                        <Eye size={12} /> VER DETALLE
                      </div>
                    </div>

                    {/* Badge row */}
                    <div className="absolute top-2.5 right-2.5 flex gap-1.5">
                      {forSale ? (
                        <span className="px-2.5 py-0.5 rounded-full text-[9px] font-semibold bg-amber-500/15 text-amber-600 border border-amber-500/30">
                          {sellingMe ? "EN VENTA" : "REVENTA"}
                        </span>
                      ) : mine ? (
                        <span className="px-2.5 py-0.5 rounded-full text-[9px] font-semibold bg-primary text-white">
                          TUYA
                        </span>
                      ) : owned ? (
                        <span className="px-2.5 py-0.5 rounded-full text-[9px] font-semibold bg-emerald-500/15 text-emerald-600 border border-emerald-500/30">
                          COLECTADA
                        </span>
                      ) : price > 0 ? null : (
                        <span className="px-2.5 py-0.5 rounded-full text-[9px] font-semibold bg-emerald-500/15 text-emerald-600 border border-emerald-500/30">
                          GRATIS
                        </span>
                      )}
                    </div>

                    {/* Price pill - floating at bottom */}
                    {price > 0 && !mine && !owned && (
                      <div className="absolute bottom-2.5 left-2.5">
                        <span className="px-3 py-1 rounded-full text-[10px] font-semibold bg-primary text-white flex items-center gap-1.5 shadow-sm">
                          <Sparkles size={10} /> {price}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Info area */}
                  <div className="p-3.5 space-y-2">
                    <div className="text-sm font-display truncate font-semibold tracking-tight">{title}</div>

                    {/* Author + actions in a row */}
                    <div className="flex items-center justify-between gap-2">
                      <Link
                        to="/profile/$userId" params={{ userId: art.author_id }}
                        onClick={e => e.stopPropagation()}
                        className="flex items-center gap-1.5 group/author min-w-0 flex-1"
                      >
                        <Avatar p={art.author} size={20} className="ring-2 ring-border/40 group-hover/author:ring-primary/40 transition-all" />
                        <span className="text-[10px] font-mono text-muted-foreground truncate group-hover/author:text-foreground transition">
                          @{art.author?.username ?? "jugador"}
                        </span>
                      </Link>

                      <div className="flex items-center gap-2 text-[10px] text-muted-foreground/60 shrink-0">
                        <button
                          onClick={e => { e.stopPropagation(); likeArt(art.id); }}
                          disabled={likingId === art.id || !myId}
                          title={myId ? (art.my_like ? "Quitar like" : "Me gusta") : "Inicia sesión para dar like"}
                          className={`flex items-center gap-0.5 rounded-md px-1 py-0.5 transition active:scale-90 disabled:opacity-50 ${
                            art.my_like ? "text-rose-400 fill-rose-400/30" : "hover:text-rose-400"
                          }`}
                        >
                          {likingId === art.id
                            ? <Loader2 size={10} className="animate-spin" />
                            : <Heart size={10} className={art.my_like ? "fill-rose-400 text-rose-400" : ""} />}
                          {art.likes}
                        </button>
                        <button
                          onClick={e => { e.stopPropagation(); setDetailPost(art); }}
                          className="flex items-center gap-0.5 rounded-md px-1 py-0.5 transition hover:text-primary active:scale-90"
                          title="Comentarios"
                        >
                          <MessageCircle size={10} />
                          {art.comments_count}
                        </button>
                      </div>
                    </div>

                    {/* Vendedor actual (reventa) */}
                    {forSale && art.seller && art.seller_id !== art.author_id && (
                      <div className="flex items-center gap-1 text-[9px] text-muted-foreground/60 mt-0.5">
                        <span className="shrink-0">Vendido por</span>
                        <Link
                          to="/profile/$userId" params={{ userId: art.seller_id }}
                          onClick={e => e.stopPropagation()}
                          className="truncate font-mono hover:text-amber-400 hover:underline transition-colors"
                        >
                          @{art.seller.username ?? "usuario"}
                        </Link>
                        <span className="shrink-0 flex items-center gap-0.5 text-amber-400/90 font-mono">
                          <Sparkles size={8} /> {art.resale_price_orbes}
                        </span>
                      </div>
                    )}

                    {/* Buy / Get / Resell buttons */}
                    {!mine && !forSale && (
                      <div className="flex gap-1.5 pt-0.5">
                        {!owned && price > 0 && (
                          <span
                            onClick={e => { e.stopPropagation(); openBuy(art.id); }}
                            className="flex-1 py-1.5 rounded-md bg-primary text-white text-[10px] font-semibold active:scale-95 transition text-center cursor-pointer"
                          >
                            COMPRAR CON <Sparkles size={8} className="inline" /> {price}
                          </span>
                        )}
                        {!owned && price === 0 && (
                          <span
                            onClick={e => { e.stopPropagation(); openBuy(art.id); }}
                            className="flex-1 py-1.5 rounded-md bg-emerald-500/15 text-emerald-600 text-[10px] font-semibold border border-emerald-500/30 active:scale-95 transition text-center cursor-pointer"
                          >
                            OBTENER GRATIS
                          </span>
                        )}
                        {owned && (
                          <>
                            <span className="flex-1 py-1.5 rounded-md bg-muted/40 text-muted-foreground text-[10px] font-medium text-center border border-border/30 cursor-default">
                              ✔ COLECTADA
                            </span>
                            {myId && (
                              <button
                                onClick={e => { e.stopPropagation(); openResell(art); }}
                                className="px-3 py-1.5 rounded-md border border-primary/30 text-primary text-[10px] font-semibold hover:bg-primary/10 active:scale-95 transition"
                              >
                                <DollarSign size={9} className="inline mr-0.5" /> REVENDER
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    )}
                    {forSale && (
                      <div className="flex gap-1.5 pt-0.5">
                        {sellingMe ? (
                          <button
                            onClick={e => { e.stopPropagation(); setResellPost(art); setResellPrice(0); setResellErr(null); }}
                            className="flex-1 py-1.5 rounded-md border border-amber-500/40 text-amber-600 text-[10px] font-semibold hover:bg-amber-500/10 active:scale-95 transition"
                          >
                            EN VENTA · {art.resale_price_orbes} · RETIRAR
                          </button>
                        ) : owned ? (
                          <span className="flex-1 py-1.5 rounded-md bg-muted/40 text-muted-foreground text-[10px] font-medium text-center border border-border/30 cursor-default">
                            ✔ COLECTADA
                          </span>
                        ) : (
                          <span
                            onClick={e => { e.stopPropagation(); openBuy(art.id); }}
                            className="flex-1 py-1.5 rounded-md bg-primary text-white text-[10px] font-semibold active:scale-95 transition text-center cursor-pointer"
                          >
                            COMPRAR CON <Sparkles size={8} className="inline" /> {price}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </motion.button>
            );
          })}
        </div>
      )}

      {/* ====== DETAIL MODAL ====== */}
      <AnimatePresence>
        {detailPost && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[130] bg-black/70 backdrop-blur-md grid place-items-center p-4"
            onClick={() => setDetailPost(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 20 }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-lg border border-border bg-surface shadow-md"
              onClick={e => e.stopPropagation()}
            >
              {/* Image */}
              <div className="relative bg-muted/20 rounded-2xl overflow-hidden mx-3 mt-3">
                {(detailPost.signed_media?.[0] ?? detailPost.signed_cover) ? (
                  <img
                    src={detailPost.signed_media?.[0] ?? detailPost.signed_cover}
                    alt={detailPost.content.replace(/^🎨\s*/, "")}
                    className="w-full object-contain max-h-[50vh]"
                  />
                ) : (
                  <div className="aspect-square grid place-items-center">
                    <Palette size={48} className="text-muted-foreground/20" />
                  </div>
                )}
                <button
                  onClick={() => setDetailPost(null)}
                  className="absolute top-3 right-3 w-8 h-8 grid place-items-center rounded-lg bg-black/40 text-white hover:bg-black/60 transition backdrop-blur-sm"
                >
                  <X size={14} />
                </button>
              </div>

              {/* Info */}
              <div className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-display text-base font-semibold tracking-tight">
                      {detailPost.content.replace(/^🎨\s*/, "")}
                    </div>
                    <Link
                      to="/profile/$userId" params={{ userId: detailPost.author_id }}
                      onClick={e => e.stopPropagation()}
                      className="flex items-center gap-1.5 mt-1 group/author"
                    >
                      <Avatar p={detailPost.author} size={20} className="ring-1 ring-border/50" />
                      <span className="text-xs font-mono text-muted-foreground group-hover/author:text-foreground transition">
                        @{detailPost.author?.username ?? "anon"}
                      </span>
                      <ExternalLink size={10} className="text-muted-foreground/40" />
                    </Link>

                    {/* Vendedor actual (reventa) */}
                    {detailPost.seller_id && detailPost.seller && detailPost.seller_id !== detailPost.author_id && (
                      <div className="flex items-center gap-1 mt-1 text-[10px] text-muted-foreground/70">
                        <span>Vendido por</span>
                        <Link
                          to="/profile/$userId" params={{ userId: detailPost.seller_id }}
                          onClick={e => e.stopPropagation()}
                          className="font-mono hover:text-amber-400 hover:underline transition-colors"
                        >
                          @{detailPost.seller.username ?? "usuario"}
                        </Link>
                        <span className="flex items-center gap-0.5 text-amber-400/90 font-mono">
                          <Sparkles size={9} /> {detailPost.resale_price_orbes}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Price / Buy */}
                  {detailPost.author_id !== myId && (
                    <button
                      onClick={e => { e.stopPropagation(); setDetailPost(null); openBuy(detailPost.id); }}
                      disabled={detailPost.owned}
                      className={`shrink-0 px-4 py-2 rounded-lg text-[11px] font-semibold transition active:scale-95 ${
                        detailPost.owned
                          ? "bg-emerald-500/15 text-emerald-600 border border-emerald-500/30"
                          : effPrice(detailPost) > 0
                            ? "grad-brand text-white"
                            : "bg-emerald-500/15 text-emerald-600 border border-emerald-500/30 hover:bg-emerald-500/25"
                      }`}
                    >
                      {detailPost.owned
                        ? "✔ COLECTADA"
                        : effPrice(detailPost) > 0
                          ? <span className="flex items-center gap-1"><Sparkles size={11} /> {effPrice(detailPost)}</span>
                          : "OBTENER GRATIS"}
                    </button>
                  )}
                </div>

                {/* Acciones de reventa del dueño */}
                {(detailPost.owned && detailPost.author_id !== myId && !detailPost.seller_id) && (
                  <button
                    onClick={e => { e.stopPropagation(); openResell(detailPost); }}
                    className="w-full h-10 rounded-lg border border-primary/30 text-primary text-[10px] font-semibold hover:bg-primary/10 active:scale-[0.98] transition flex items-center justify-center gap-1.5"
                  >
                    <DollarSign size={12} /> REVENDER ESTA OBRA
                  </button>
                )}
                {detailPost.seller_id === myId && (
                  <button
                    onClick={e => { e.stopPropagation(); setResellPost(detailPost); setResellPrice(0); setResellErr(null); }}
                    className="w-full h-10 rounded-lg border border-amber-500/40 text-amber-600 text-[10px] font-semibold hover:bg-amber-500/10 active:scale-[0.98] transition flex items-center justify-center gap-1.5"
                  >
                    <DollarSign size={12} /> RETIRAR DE LA VENTA
                  </button>
                )}

                {/* Stats */}
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <button
                    onClick={e => { e.stopPropagation(); likeArt(detailPost.id); }}
                    disabled={likingId === detailPost.id || !myId}
                    title={myId ? (detailPost.my_like ? "Quitar like" : "Me gusta") : "Inicia sesión para dar like"}
                    className={`flex items-center gap-1 rounded-lg px-2 py-1.5 border transition active:scale-95 disabled:opacity-50 ${
                      detailPost.my_like
                        ? "border-rose-500/40 bg-rose-500/10 text-rose-600"
                        : "border-border hover:border-rose-500/40 hover:text-rose-600"
                    }`}
                  >
                    {likingId === detailPost.id
                      ? <Loader2 size={13} className="animate-spin" />
                      : <Heart size={13} className={detailPost.my_like ? "fill-rose-400 text-rose-400" : ""} />}
                    <span className="font-semibold tabular-nums">{detailPost.likes}</span>
                  </button>
                  <span className="flex items-center gap-1 text-muted-foreground/80">
                    <MessageCircle size={13} />
                    {detailPost.comments_count} comentario{detailPost.comments_count !== 1 ? "s" : ""}
                  </span>
                  <span className="text-[10px] font-mono text-muted-foreground/50">
                    {new Date(detailPost.created_at).toLocaleDateString("es", { month: "short", day: "numeric" })}
                  </span>
                </div>

                {/* Comments */}
                <div className="border-t border-border/40 pt-1">
                  <CommentSection
                    postId={detailPost.id}
                    myId={myId}
                    isMod={false}
                    onChange={load}
                  />
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ====== DRAWING OVERLAY (full-screen) ====== */}
      <AnimatePresence>
        {canvasOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[150] bg-black/80 backdrop-blur-md flex items-center justify-center p-0"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}            className="w-full h-full overflow-hidden"
          >
              <GalleryCanvasPanel
                onSave={handleCanvasSave}
                onClose={() => setCanvasOpen(false)}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ====== PUBLISH DIALOG ====== */}
      <AnimatePresence>
        {savedSprite && !pubDone && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[160] bg-black/70 backdrop-blur-md grid place-items-center p-4"
            onClick={() => { if (!publishing) setSavedSprite(null); }}
          >
            <div
              className="w-full max-w-sm rounded-lg border border-border bg-surface p-5 space-y-4 shadow-md"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-primary text-white grid place-items-center">
                  <ImagePlus size={14} />
                </div>
                <div className="font-display text-sm">Publicar obra</div>
                <button onClick={() => setSavedSprite(null)} className="ml-auto w-8 h-8 grid place-items-center rounded-xl border border-border hover:bg-muted/40 transition">
                  <X size={14} />
                </button>
              </div>

              <div className="aspect-square max-h-36 rounded-xl bg-muted/20 overflow-hidden border border-border/50">
                {savedSprite.frames?.[0]?.composite && (
                  <img src={savedSprite.frames[0].composite} alt="preview" className="w-full h-full object-contain" />
                )}
              </div>

              <input
                value={pubTitle}
                onChange={e => setPubTitle(e.target.value)}
                placeholder="Título de la obra"
                maxLength={60}
                className="w-full bg-input/50 border border-border/50 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30 transition"
              />

              <div>
                <div className="text-[11px] font-medium text-muted-foreground mb-1.5 flex items-center gap-1">
                  <Sparkles size={10} /> PRECIO EN ORBES
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number" min={0} max={9999}
                    value={pubPrice}
                    onChange={e => setPubPrice(Math.max(0, Number(e.target.value)))}
                    className="flex-1 bg-input/50 border border-border/50 rounded-xl px-3 py-2 text-sm font-mono outline-none focus:ring-2 focus:ring-primary/30"
                  />
                  <span className="text-xs text-muted-foreground">orbes</span>
                </div>
                <div className="text-[10px] text-muted-foreground/60 mt-1">0 = gratuita</div>
              </div>

              {pubErr && <div className="text-xs text-destructive">{pubErr}</div>}

              <div className="flex gap-2">
                <button
                  onClick={() => setSavedSprite(null)}
                  disabled={publishing}
                  className="flex-1 h-10 rounded-lg border border-border text-xs font-medium active:scale-95 disabled:opacity-50 transition"
                >CANCELAR</button>
                <button
                  onClick={doPublish}
                  disabled={publishing || !pubTitle.trim()}
                  className="flex-1 h-10 rounded-lg grad-brand text-white text-xs font-semibold active:scale-95 disabled:opacity-50 transition"
                >
                  {publishing ? <span className="inline-flex items-center gap-1.5"><Loader2 size={14} className="animate-spin" />{reviewingArtwork ? "REVISANDO…" : "PUBLICANDO…"}</span> : "PUBLICAR"}
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {pubDone && (
          <div className="fixed inset-0 z-[160] bg-black/70 backdrop-blur-md grid place-items-center p-4">
            <div className="w-full max-w-xs rounded-lg border border-border bg-surface p-6 text-center space-y-2 shadow-md">
              <div className="w-14 h-14 rounded-2xl bg-emerald-500/15 grid place-items-center mx-auto">
                <CheckCircle2 size={28} className="text-emerald-500" />
              </div>
              <div className="font-display text-base">¡Publicada!</div>
              <div className="text-xs text-muted-foreground">Tu obra ya está en la galería</div>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* ====== RESELL DIALOG ====== */}
      <AnimatePresence>
        {resellPost && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[142] bg-black/70 backdrop-blur-md grid place-items-center p-4"
            onClick={() => !reselling && setResellPost(null)}
          >
            <motion.div
              initial={{ opacity: 0, y: 30, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 30, scale: 0.96 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className="w-full max-w-sm rounded-lg border border-border bg-surface p-5 space-y-4 shadow-md"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-amber-500/15 text-amber-600 grid place-items-center">
                  <DollarSign size={14} />
                </div>
                <div className="font-display text-sm">Revender obra</div>
                <button onClick={() => setResellPost(null)} disabled={reselling} className="ml-auto w-8 h-8 grid place-items-center rounded-xl border border-border hover:bg-muted/40 transition disabled:opacity-50">
                  <X size={14} />
                </button>
              </div>

              <div className="aspect-square max-h-32 rounded-xl bg-muted/20 overflow-hidden border border-border/50">
                {(resellPost.signed_media?.[0] ?? resellPost.signed_cover) && (
                  <img
                    src={resellPost.signed_media?.[0] ?? resellPost.signed_cover}
                    alt={resellPost.content.replace(/^🎨\s*/, "")}
                    className="w-full h-full object-contain"
                  />
                )}
              </div>

              <div className="text-xs text-muted-foreground leading-relaxed">
                Ponle precio a tu obra para que otros jugadores puedan comprártela. El creador original
                (<span className="font-mono text-foreground">@{resellPost.author?.username ?? "usuario"}</span>) siempre aparecerá como autor.
              </div>

              <div>
                <div className="text-[11px] font-medium text-muted-foreground mb-1.5 flex items-center gap-1">
                  <Sparkles size={10} /> PRECIO EN ORBES
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number" min={0} max={99999}
                    value={resellPrice}
                    onChange={e => setResellPrice(Math.max(0, Number(e.target.value)))}
                    className="flex-1 bg-input/50 border border-border/50 rounded-xl px-3 py-2 text-sm font-mono outline-none focus:ring-2 focus:ring-primary/30 transition"
                  />
                  <span className="text-xs text-muted-foreground">orbes</span>
                </div>
                <div className="text-[10px] text-muted-foreground/60 mt-1">Pon 0 para retirarla de la venta.</div>
              </div>

              {resellErr && <div className="text-xs text-destructive">{resellErr}</div>}

              <div className="flex gap-2">
                <button
                  onClick={() => setResellPost(null)}
                  disabled={reselling}
                  className="flex-1 h-10 rounded-lg border border-border text-xs font-medium active:scale-95 disabled:opacity-50 transition"
                >CANCELAR</button>
                <button
                  onClick={doResell}
                  disabled={reselling}
                  className="flex-1 h-10 rounded-lg bg-amber-500 text-white text-xs font-semibold active:scale-95 disabled:opacity-50 transition"
                >
                  {reselling ? <Loader2 size={14} className="animate-spin mx-auto" /> : resellPrice > 0 ? "PONER EN VENTA" : "RETIRAR DE VENTA"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ====== BUY MODAL ====== */}
      <AnimatePresence>
        {buyPostId && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[140] bg-black/70 backdrop-blur-md grid place-items-center p-4"
            onClick={() => buyState !== "loading" && setBuyPostId(null)}
          >
            <motion.div
              initial={{ opacity: 0, y: 30, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 30, scale: 0.96 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className="w-full max-w-sm rounded-lg border border-border bg-surface p-5 space-y-3 shadow-md"
              onClick={e => e.stopPropagation()}
            >
              {(buyState === "idle" || buyState === "loading") && (
                <>
                  <div className="w-12 h-12 rounded-xl bg-primary/10 grid place-items-center mx-auto">
                    {buyState === "loading"
                      ? <Loader2 size={22} className="animate-spin text-primary" />
                      : <Sparkles size={22} className="text-primary" />}
                  </div>
                  <h3 className="font-display text-center text-sm">
                    {buyState === "loading" ? "Procesando…" : "¿Adquirir esta obra?"}
                  </h3>
                  {balance !== null && (() => {
                    const art = artworks.find(a => a.id === buyPostId);
                    const price = art ? effPrice(art) : 0;
                    const after = balance - price;
                    return (
                      <div className="rounded-xl bg-muted/30 border border-border/60 p-3 space-y-2 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Tu saldo</span>
                          <span className="font-mono tabular-nums flex items-center gap-1">
                            <Sparkles size={10} className="text-primary" /> {balance}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Precio</span>
                          <span className="font-mono tabular-nums flex items-center gap-1">
                            <Sparkles size={10} className="text-primary" /> {price}
                          </span>
                        </div>
                        <div className="border-t border-border/50 pt-2 flex items-center justify-between font-semibold">
                          <span className="text-foreground">Después</span>
                          <span className={`font-mono tabular-nums ${after < 0 ? "text-destructive" : "text-emerald-500"}`}>
                            {after < 0 ? "—" : <span className="flex items-center gap-1"><Sparkles size={10} /> {after}</span>}
                          </span>
                        </div>
                      </div>
                    );
                  })()}
                  <button
                    onClick={confirmBuy}
                    disabled={buyState === "loading" || (balance !== null && (balance - (artworks.find(a => a.id === buyPostId) ? effPrice(artworks.find(a => a.id === buyPostId)!) : 0) < 0))}
                    className="w-full h-10 rounded-lg grad-brand text-white text-xs font-semibold disabled:opacity-50 active:scale-[0.98] transition"
                  >
                    {buyState === "loading" ? <Loader2 size={14} className="animate-spin mx-auto" /> : "CONFIRMAR"}
                  </button>
                </>
              )}
              {buyState === "success" && (
                <div className="text-center py-2">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 grid place-items-center mx-auto mb-2">
                    <CheckCircle2 size={24} className="text-emerald-500" />
                  </div>
                  <h3 className="font-display text-sm">¡Adquirida!</h3>
                  <p className="text-xs text-muted-foreground mt-1">{buyMsg}</p>
                </div>
              )}        {(buyState === "insufficient" || buyState === "error") && (
                <div className="text-center py-2">
                  <div className="w-12 h-12 rounded-2xl bg-destructive/15 grid place-items-center mx-auto mb-2">
                    <AlertTriangle size={22} className="text-destructive" />
                  </div>
                  <h3 className="font-display text-sm">{buyState === "insufficient" ? "Orbes insuficientes" : "Error"}</h3>
                  <p className="text-xs text-muted-foreground mt-1">{buyMsg}</p>
                </div>
              )}
              {buyState !== "loading" && (
                <button
                  onClick={() => setBuyPostId(null)}
                  className="w-full h-9 rounded-lg border border-border text-[11px] font-medium active:scale-95 transition"
                >{buyState === "success" ? "ENTENDIDO" : "CANCELAR"}</button>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
