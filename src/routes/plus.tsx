import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Star, Palette, Rocket, Link2, Check, Loader2,
  Youtube, Instagram, Music2, Globe, Gift,
  Wand2,
} from "lucide-react";

import { SubPageHeader } from "@/components/social/SubPageHeader";
import { supabase } from "@/integrations/supabase/client";
import {
  getMyProfile, claimPlusOrbes, updatePlusSettings,
  isPlusActive,
  type Profile, type SocialLinks,
} from "@/lib/social/api";


export const Route = createFileRoute("/plus")({
  head: () => ({
    meta: [
      { title: "Centro Plus · Asternal" },
      { name: "description", content: "Tu Centro Plus: efectos de nombre, fondos premium, tarjeta de creador y más." },
    ],
  }),
  component: PlusPage,
});

const FRAMES = [
  { id: "aurora", label: "Aurora", css: "linear-gradient(135deg, #1AA6D6, #2FD9D2, #7BE7FF)" },
  { id: "ocean",  label: "Océano", css: "linear-gradient(135deg, #0F6C9E, #1AA6D6, #2FD9D2)" },
  { id: "ice",    label: "Hielo",  css: "linear-gradient(135deg, #B8ECFF, #7BE7FF, #2FD9D2)" },
  { id: "neon",   label: "Neón",   css: "linear-gradient(135deg, #2FD9D2, #B8ECFF, #1AA6D6)" },
];

const NAME_EFFECTS: { id: string; label: string }[] = [
  { id: "glow",     label: "Brillo" },
  { id: "rainbow",  label: "Arcoíris" },
  { id: "gradient", label: "Degradado" },
  { id: "pulse",    label: "Pulso" },
  { id: "shadow",   label: "Sombra" },
  { id: "neon",     label: "Neón" },
];

// Fondos de perfil eliminados por petición del usuario.





function PlusPage() {
  const navigate = useNavigate();

  // Bug de navegación: si entras a Plus desde tu perfil (o desde cualquier
  // pantalla), el botón/gesto de «atrás» del navegador volvía a la pantalla
  // anterior (p. ej. la página aislada de tu perfil) en vez del menú principal.
  // Interceptamos el popstate: al salir de Plus, SIEMPRE se va al menú
  // principal (/) en lugar de a la ruta anterior.
  useEffect(() => {
    const onPop = () => {
      navigate({ to: "/", replace: true });
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [navigate]);
  const [me, setMe] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);
  const [claimMsg, setClaimMsg] = useState<string | null>(null);
  const [socials, setSocials] = useState<SocialLinks>({});
  const [savedSocials, setSavedSocials] = useState<null | "saving" | "saved">(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { navigate({ to: "/auth" }); return; }
      const p = await getMyProfile();
      setMe(p);
      setSocials((p?.social_links as SocialLinks) ?? {});
      setLoading(false);
    })();
  }, [navigate]);

  const isPlus = isPlusActive(me);

  const refresh = async () => setMe(await getMyProfile());

  const claim = async () => {
    setClaiming(true); setClaimMsg(null);
    try {
      const r = await claimPlusOrbes();
      if (r.ok) { setClaimMsg(`+${r.amount} orbes reclamados 🎉`); await refresh(); }
      else if (r.reason === "already_claimed") {
        const next = r.next_at ? new Date(r.next_at).toLocaleDateString() : "";
        setClaimMsg(`Ya reclamaste este mes. Próximo: ${next}`);
      }
    } catch (e) { setClaimMsg((e as Error).message); }
    finally { setClaiming(false); }
  };

  const toggleBadge = async () => {
    if (!me) return;
    const next = !(me.show_plus_badge ?? true);
    await updatePlusSettings({ show_plus_badge: next });
    setMe({ ...me, show_plus_badge: next });
  };

  const setFrame = async (id: string | null) => {
    if (!me) return;
    await updatePlusSettings({ avatar_frame: id });
    setMe({ ...me, avatar_frame: id });
  };
  const setNameFx = async (id: string | null) => {
    if (!me) return;
    await updatePlusSettings({ name_effect: id });
    setMe({ ...me, name_effect: id });
  };

  const saveSocials = async () => {
    setSavedSocials("saving");
    await updatePlusSettings({ social_links: socials });
    setSavedSocials("saved");
    setTimeout(() => setSavedSocials(null), 1500);
  };

  const canClaim = isPlus && (!me?.last_plus_claim_at || (Date.now() - new Date(me.last_plus_claim_at).getTime()) > 30 * 24 * 3600 * 1000);

  if (loading) return <div className="min-h-screen grid place-items-center"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="plus-page min-h-screen w-full flex flex-col bg-background text-foreground">
      <SubPageHeader
        title="CENTRO PLUS"
        icon={<Star size={14} fill="currentColor" style={{ color: "var(--plus)" }} />}
        subtitle={me ? `@${me.username ?? "…"} · Beneficios de Asternal Plus` : undefined}
        right={
          isPlus ? (
            <span className="text-[10px] font-display tracking-widest px-2.5 py-1 rounded-full text-white shadow-sm btn-grad">ACTIVO</span>
          ) : undefined
        }
      />

      <main className="flex-1 max-w-2xl md:max-w-3xl lg:max-w-5xl xl:max-w-6xl mx-auto w-full px-3 py-5 pb-24 space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
        {/* Hero */}
        <section className="plus-glass-hero relative overflow-hidden rounded-3xl p-6 shadow-lg border">
          <div className="absolute -right-10 -top-10 w-40 h-40 rounded-full blur-3xl opacity-30 bg-primary/30" />
          <div className="relative">
            <div className="btn-grad inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-display tracking-[0.2em] uppercase text-white">
              <Star size={10} fill="currentColor" /> Plus
            </div>
            <h1 className="mt-3 text-3xl font-display font-bold">Asternal Plus</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {isPlus
                ? "Tus beneficios están activos. Ajusta cómo aparecen en tu perfil desde aquí."
                : <>Los beneficios de Plus están <span className="text-foreground font-semibold">disponibles en esta etapa</span>.</>}
            </p>
          </div>
        </section>

        {/* Reclamar orbes */}
        <FeatureCard icon={<Gift size={18} />} title="10.000 Orbes mensuales"
          desc={isPlus ? (canClaim ? "Disponibles para reclamar." : "Ya reclamaste este mes.") : "Reclama orbes cada mes."}
          locked={!isPlus}>
          <button disabled={!isPlus || !canClaim || claiming} onClick={claim}
            className="btn-grad w-full h-10 rounded-xl text-sm font-display tracking-widest text-white active:scale-[0.98] transition disabled:opacity-40">
            {claiming ? <Loader2 size={14} className="inline animate-spin" /> : canClaim ? "RECLAMAR AHORA" : "RECLAMADO"}
          </button>
          {claimMsg && <div className="text-[11px] text-muted-foreground mt-2 text-center">{claimMsg}</div>}
        </FeatureCard>

        {/* Insignia Plus */}
        <FeatureCard icon={<Star size={18} fill="currentColor" />} title="Insignia Plus"
          desc="Muestra tu insignia junto a tu nombre." locked={!isPlus}>
          <button disabled={!isPlus} onClick={toggleBadge}
            className="w-full h-10 rounded-xl text-sm font-display tracking-widest border transition active:scale-[0.98] disabled:opacity-40"
            style={{
              borderColor: "var(--primary)",
              color: me?.show_plus_badge ? "white" : "var(--primary)",
            }}>
            {me?.show_plus_badge ? "✓ VISIBLE" : "OCULTA"}
          </button>
        </FeatureCard>

        {/* Name effects — NEW */}
        <FeatureCard icon={<Wand2 size={18} />} title="Efectos de nombre"
          desc="Haz que tu nombre destaque en publicaciones y perfil." locked={!isPlus}>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
            <button onClick={() => setNameFx(null)} disabled={!isPlus}
            className={`plus-choice h-12 rounded-xl border-2 text-xs font-display transition ${!me?.name_effect ? "border-primary" : "border-border"} disabled:opacity-40`}>
              Ninguno
            </button>
            {NAME_EFFECTS.map(fx => (
              <button key={fx.id} onClick={() => setNameFx(fx.id)} disabled={!isPlus}
                className={`plus-choice h-12 rounded-xl border-2 grid place-items-center transition ${me?.name_effect === fx.id ? "border-primary" : "border-border"} disabled:opacity-40`}>
                <span className={`name-fx name-fx-${fx.id} text-sm font-display`}>{fx.label}</span>
              </button>
            ))}
          </div>
        </FeatureCard>

        {/* Fondos de perfil eliminados por petición del usuario */}


        {/* Frames */}
        <FeatureCard icon={<Palette size={18} />} title="Marcos de perfil"
          desc="Añade un marco animado a tu foto de perfil." locked={!isPlus}>
          <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2">
            <button onClick={() => setFrame(null)} disabled={!isPlus}
              className={`plus-choice aspect-square rounded-xl border-2 grid place-items-center text-[10px] font-mono transition ${!me?.avatar_frame ? "border-primary" : "border-border"}`}>
              Ninguno
            </button>
            {FRAMES.map(f => (
              <button key={f.id} onClick={() => setFrame(f.id)} disabled={!isPlus}
                className={`plus-choice aspect-square rounded-xl p-1 border-2 transition ${me?.avatar_frame === f.id ? "border-primary" : "border-transparent"} disabled:opacity-40`}
                style={{ background: f.css }} title={f.label}>
                <div className="w-full h-full rounded-lg bg-background/70 grid place-items-center text-[10px]">
                  {me?.avatar_frame === f.id && <Check size={14} />}
                </div>
              </button>
            ))}
          </div>
        </FeatureCard>

        {/* Redes sociales */}
        <FeatureCard icon={<Link2 size={18} />} title="Redes sociales"
          desc="Se muestran como iconos en tu perfil." locked={!isPlus}>
          <div className="space-y-2">
            <SocialInput icon={<Youtube size={14} />} placeholder="URL de YouTube"
              value={socials.youtube ?? ""} onChange={v => setSocials({ ...socials, youtube: v })} disabled={!isPlus} />
            <SocialInput icon={<Music2 size={14} />} placeholder="URL de TikTok"
              value={socials.tiktok ?? ""} onChange={v => setSocials({ ...socials, tiktok: v })} disabled={!isPlus} />
            <SocialInput icon={<Instagram size={14} />} placeholder="URL de Instagram"
              value={socials.instagram ?? ""} onChange={v => setSocials({ ...socials, instagram: v })} disabled={!isPlus} />
            <SocialInput icon={<Globe size={14} />} placeholder="Sitio web"
              value={socials.website ?? ""} onChange={v => setSocials({ ...socials, website: v })} disabled={!isPlus} />
            <button disabled={!isPlus || savedSocials === "saving"} onClick={saveSocials}
            className="btn-grad w-full h-9 rounded-xl text-xs font-display tracking-widest text-white active:scale-[0.98] transition disabled:opacity-40">
              {savedSocials === "saving" ? "GUARDANDO…" : savedSocials === "saved" ? "✓ GUARDADO" : "GUARDAR"}
            </button>
          </div>
        </FeatureCard>

        <FeatureCard icon={<Rocket size={18} />} title="Herramientas en prueba"
          desc="Consulta las funciones que están disponibles para probar." locked={!isPlus}>
          <div className="flex flex-wrap gap-2 text-[11px]">
            <span className="px-2 py-1 rounded-full border" style={{ borderColor: "var(--plus)", color: "var(--plus)" }}>Editor de animaciones</span>
            <span className="px-2 py-1 rounded-full border" style={{ borderColor: "var(--plus)", color: "var(--plus)" }}>Encuestas</span>
            <span className="px-2 py-1 rounded-full border" style={{ borderColor: "var(--plus)", color: "var(--plus)" }}>Contenido desbloqueable</span>
          </div>
        </FeatureCard>

        <section className="plus-glass-note relative overflow-hidden rounded-2xl border-2 p-5 space-y-3">
          <div className="flex items-center gap-2.5">
            <Gift size={18} style={{ color: "var(--plus)" }} />
            <div>
              <div className="font-display text-sm font-semibold">Disponibilidad de Plus</div>
              <div className="text-[10px] text-muted-foreground/60">Los beneficios habilitados en tu cuenta se gestionan desde este centro.</div>
            </div>
          </div>
        </section>

        <div className="text-center pt-2">
          <Link to="/" className="text-[11px] text-muted-foreground underline">Volver al inicio</Link>
        </div>
      </main>
    </div>
  );
}

function FeatureCard({ icon, title, desc, locked, children }: {
  icon: React.ReactNode; title: string; desc: string; locked: boolean; children: React.ReactNode;
}) {
  return (
    <section className="plus-glass-card rounded-2xl border border-border/70 bg-surface p-4 space-y-3 relative">
      <div className="flex items-start gap-3">
        <div className="btn-grad w-10 h-10 rounded-xl grid place-items-center shrink-0 text-white">{icon}</div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold flex items-center gap-2">
            {title}
            {locked && <span className="text-[9px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">PLUS</span>}
          </div>
          <div className="text-[11px] text-muted-foreground">{desc}</div>
        </div>
      </div>
      <div className={locked ? "opacity-60 pointer-events-none select-none" : ""}>{children}</div>
    </section>
  );
}

function SocialInput({ icon, placeholder, value, onChange, disabled }: {
  icon: React.ReactNode; placeholder: string; value: string; onChange: (v: string) => void; disabled?: boolean;
}) {
  return (
    <div className="plus-social-input flex items-center gap-2 bg-input/40 rounded-xl px-3 py-2">
      <span className="text-muted-foreground">{icon}</span>
      <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} disabled={disabled}
        className="flex-1 bg-transparent text-xs outline-none disabled:opacity-50" />
    </div>
  );
}
