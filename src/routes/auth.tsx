import { createFileRoute, useNavigate, useSearch, Link } from "@tanstack/react-router";
import { useEffect, useState, useRef } from "react";
import { Gamepad2, Sparkles, Loader2, AlertCircle } from "lucide-react";
import { IDEA_HERO_COPY } from "@/lib/auth/idea-hero";
import { getManusSessionUser, renderGoogleButton, type ManusSessionUser } from "@/lib/auth/manus";

export const Route = createFileRoute("/auth")({
  validateSearch: (search: Record<string, unknown>) => ({
    returnTo: typeof search.returnTo === "string" ? search.returnTo : "/",
  }),
  head: () => ({ meta: [{ title: "Asternal — Acceso a la plataforma" }] }),
  component: AuthPage,
});

/* ─── Confetti ─── */
function ConfettiBurst({ active }: { active: boolean }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (!active) { setShow(false); return; }
    setShow(true);
    const t = setTimeout(() => setShow(false), 2500);
    return () => clearTimeout(t);
  }, [active]);
  if (!show) return null;
  return (
    <div className="fixed inset-0 pointer-events-none z-[9998] overflow-hidden">
      {Array.from({ length: 32 }).map((_, i) => (
        <div key={i} className="absolute rounded-full"
          style={{
            left: `${45 + (i % 5) * 3}%`, top: `${30 + (i % 7) * 4}%`,
            width: 3 + (i % 4), height: 3 + (i % 4),
            background: ["oklch(0.55 0.15 262)","oklch(0.72 0.14 235)","oklch(0.65 0.2 150)","oklch(0.85 0.2 85)"][i % 4],
            animation: `confetti-fall ${1 + (i % 4) * 0.3}s ease-out ${(i % 8) * 0.05}s both`,
            opacity: 0,
          }}
        />
      ))}
    </div>
  );
}

/* ─── Circuit lines ─── */
function CircuitLines() {
  return (
    <svg className="absolute inset-0 w-full h-full opacity-[0.05]" xmlns="http://www.w3.org/2000/svg" fill="none" preserveAspectRatio="none">
      <g stroke="oklch(0.55 0.15 262)" strokeWidth="0.7">
        <path d="M0 12% H 35% V 7% H 65%" />
        <path d="M0 24% H 20% V 18% H 55%" />
        <path d="M100% 10% H 68% V 5% H 45%" />
        <path d="M100% 30% H 55% V 36% H 30%" />
        <path d="M35% 100% V 60% H 60%" />
        <path d="M70% 100% V 50% H 88%" />
      </g>
      <g fill="oklch(0.55 0.15 262)">
        <circle cx="35%" cy="7%" r="2.2" />
        <circle cx="65%" cy="7%" r="2.2" />
        <circle cx="20%" cy="18%" r="2.2" />
        <circle cx="55%" cy="18%" r="2.2" />
        <circle cx="60%" cy="36%" r="2.2" />
        <circle cx="30%" cy="36%" r="2.2" />
        <circle cx="60%" cy="60%" r="2.2" />
        <circle cx="88%" cy="50%" r="2.2" />
      </g>
    </svg>
  );
}

/* ─── Símbolo de idea ─── */
function IdeaBulb() {
  return (
    <svg
      viewBox="0 0 160 190"
      className="w-[168px] h-[200px] drop-shadow-[0_20px_28px_rgba(244,190,74,0.32)]"
      aria-hidden
    >
      <defs>
        <linearGradient id="idea-bulb-glass" x1="48" y1="34" x2="112" y2="142" gradientUnits="userSpaceOnUse">
          <stop stopColor="#fffdf0" />
          <stop offset="0.45" stopColor="#ffe8a1" />
          <stop offset="1" stopColor="#f0b94f" />
        </linearGradient>
        <linearGradient id="idea-bulb-base" x1="58" y1="143" x2="102" y2="168" gradientUnits="userSpaceOnUse">
          <stop stopColor="#fff0b8" />
          <stop offset="1" stopColor="#d9983d" />
        </linearGradient>
      </defs>
      <circle cx="80" cy="87" r="62" fill="#ffd166" opacity="0.20" />
      <g stroke="#f3c55f" strokeWidth="5" strokeLinecap="round" opacity="0.9">
        <path d="M80 14v12" />
        <path d="m38 31 9 9" />
        <path d="M22 77h13" />
        <path d="m122 40 9-9" />
        <path d="M125 77h13" />
      </g>
      <path
        d="M80 31c-29 0-51 23-51 52 0 20 11 37 29 47v12h44v-12c18-10 29-27 29-47 0-29-22-52-51-52Z"
        fill="url(#idea-bulb-glass)"
        stroke="#d29a3b"
        strokeWidth="3"
      />
      <path d="M63 91c5 4 9 11 10 24M97 91c-5 4-9 11-10 24M73 115h14" fill="none" stroke="#a66d2c" strokeWidth="3.5" strokeLinecap="round" />
      <path d="M57 58c7-12 18-18 31-18" fill="none" stroke="#fff" strokeWidth="8" strokeLinecap="round" opacity="0.78" />
      <rect x="57" y="141" width="46" height="12" rx="6" fill="url(#idea-bulb-base)" stroke="#bd8130" strokeWidth="2" />
      <path d="M65 158h30M68 166h24" stroke="#bd8130" strokeWidth="5" strokeLinecap="round" />
    </svg>
  );
}

/* ─── Hero scene ─── */
function HeroScene() {
  return (
    <div className="relative w-full h-[230px] lg:h-[440px] select-none pointer-events-none">
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 origin-center scale-[0.6] lg:scale-100" style={{ willChange: "transform" }}>
        <div className="relative w-[460px] h-[460px]">
          <div className="absolute left-1/2 top-[59%] -translate-x-1/2 -translate-y-1/2 w-[360px] h-[360px] rounded-full"
            style={{ background: "oklch(0.55 0.15 262 / 0.10)" }} />
          <div className="absolute left-1/2 top-[59%] -translate-x-1/2 -translate-y-1/2 w-[220px] h-[220px] rounded-full"
            style={{ background: "oklch(0.72 0.14 235 / 0.08)" }} />
          <div className="absolute left-1/2 top-[46%] -translate-x-1/2">
            <div className="relative z-10 flex justify-center" style={{ animation: "bob 4s ease-in-out infinite", willChange: "transform" }}>
              <IdeaBulb />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Logo ─── */
function Logo({ loaded }: { loaded: boolean }) {
  return (
    <div style={{ animation: loaded ? 'scale-in 700ms 0ms cubic-bezier(0.16,1,0.3,1) both' : 'none' }}>
      <Link to="/" className="inline-flex items-center gap-3 group">
        <div className="relative">
          <div className="absolute inset-0 rounded-2xl bg-primary/30 blur-xl scale-150 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          <div className="relative w-11 h-11 rounded-2xl grad-brand grid place-items-center shadow-lg shadow-primary/30"
            style={{ animation: "bob-slow 5s ease-in-out infinite" }}>
            <Gamepad2 size={22} className="text-white" />
          </div>
          <div className="absolute -right-1 -top-1 w-2.5 h-2.5 rounded-full bg-accent border-2 border-background animate-pulse" />
        </div>
        <span className="text-xl font-display font-bold tracking-tight text-foreground">
          Asternal
        </span>
      </Link>
    </div>
  );
}

/* ─── Main ─── */
function AuthPage() {
  const navigate = useNavigate();
  const { returnTo } = useSearch({ from: "/auth" });
  const [loaded, setLoaded] = useState(false);
  const [googleError, setGoogleError] = useState<string | null>(null);
  const [googleReady, setGoogleReady] = useState(false);
  const googleBtnRef = useRef<HTMLDivElement>(null);

  // Check for existing Google session → redirect if already logged in.
  useEffect(() => {
    getManusSessionUser().then(user => {
      if (user) navigate({ to: returnTo || "/" });
    });
    requestAnimationFrame(() => setLoaded(true));
  }, [navigate, returnTo]);

  // Initialize and render the Google sign-in button.
  useEffect(() => {
    if (!googleBtnRef.current) return;
    let cancelled = false;

    renderGoogleButton(googleBtnRef.current, (_user: ManusSessionUser) => {
      if (!cancelled) navigate({ to: returnTo || "/" });
    }).then(() => {
      if (!cancelled) setGoogleReady(true);
    }).catch((err: unknown) => {
      if (!cancelled) {
        setGoogleError(err instanceof Error ? err.message : "No se pudo cargar Google Sign-In.");
      }
    });

    return () => { cancelled = true; };
  }, [navigate, returnTo]);

  return (
    <div className="min-h-dvh w-full flex flex-col bg-background overflow-y-auto relative">
      <ConfettiBurst active={false} />

      {/* ─── Background layers ─── */}
      <div className="fixed inset-0 pointer-events-none select-none overflow-hidden" style={{ transform: "translateZ(0)" }}>
        <div className="absolute inset-0 grad-brand-soft" />
        <svg className="absolute inset-0 w-full h-full opacity-[0.02]" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="dot-grid-auth" x="0" y="0" width="28" height="28" patternUnits="userSpaceOnUse">
              <circle cx="1" cy="1" r="0.5" fill="oklch(0.55 0.15 262)" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#dot-grid-auth)" />
        </svg>
      </div>

      {/* ═══════ CONTENT ═══════ */}
      <div className="relative z-10 flex-1 flex flex-col">
        <header className="w-full px-5 pt-4 sm:pt-6 flex justify-center">
          <Logo loaded={loaded} />
        </header>

        <div className="flex-1 w-full max-w-6xl mx-auto grid lg:grid-cols-[1.05fr_1fr] items-center gap-2 lg:gap-14 px-5 pb-10 pt-3">
          {/* ─── BRAND + HERO ─── */}
          <div className="order-1 flex flex-col items-center text-center">
            <div className="w-full" style={{
              animation: loaded ? 'scale-in 1100ms 100ms cubic-bezier(0.16,1,0.3,1) both' : 'none',
            }}>
              <HeroScene />
            </div>
            <div style={{ animation: loaded ? 'fade-in-up 500ms 300ms cubic-bezier(0.22,1,0.36,1) both' : 'none' }}>
              <div className="glass-control inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-[11px] font-display font-medium tracking-wide text-primary/80 -mt-1 lg:-mt-3">
                <Sparkles size={12} className="text-accent" />
                {IDEA_HERO_COPY.eyebrow}
              </div>
            </div>
            <div style={{ animation: loaded ? 'fade-in-up 600ms 420ms cubic-bezier(0.22,1,0.36,1) both' : 'none' }}>
              <h1 className="text-[clamp(1.8rem,3.6vw,2.9rem)] font-display font-bold tracking-tight leading-[1.08] text-foreground mt-4 mb-3 max-w-lg mx-auto">
                {IDEA_HERO_COPY.titleLead}{" "}
                <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                  {IDEA_HERO_COPY.titleAccent}
                </span>
              </h1>
            </div>
            <div style={{ animation: loaded ? 'fade-in-up 600ms 540ms cubic-bezier(0.22,1,0.36,1) both' : 'none' }}>
              <p className="text-[15px] leading-relaxed text-muted-foreground/80 max-w-md mx-auto mb-8">
                {IDEA_HERO_COPY.description}
              </p>
            </div>
          </div>

          {/* ─── AUTH CARD ─── */}
          <div className="order-2 w-full flex justify-center lg:justify-end">
            <div className="w-full max-w-[400px]" style={{
              animation: loaded ? 'fade-in-up 800ms 700ms cubic-bezier(0.22,1,0.36,1) both' : 'none',
            }}>
              <div className="glass-surface relative rounded-3xl">
                <div className="relative rounded-3xl p-7 overflow-hidden group/form-card">
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 h-px w-3/4 bg-gradient-to-r from-transparent via-white/90 to-transparent" />
                  <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-64 h-32 bg-primary/5 blur-2xl rounded-full pointer-events-none" />

                  {/* Header */}
                  <div className="text-center mb-6 relative">
                    <div className="w-12 h-12 rounded-2xl grad-brand grid place-items-center mx-auto mb-3 relative">
                      <div className="absolute inset-0 rounded-2xl bg-primary/20 blur-lg scale-125 animate-pulse" style={{ animationDuration: '3s' }} />
                      <Gamepad2 size={22} className="text-white relative" />
                    </div>
                    <h2 className="text-lg font-display font-semibold tracking-tight text-foreground mb-0.5">
                      Bienvenido a Asternal
                    </h2>
                    <p className="text-sm text-muted-foreground/70">
                      Accede con tu cuenta de Google
                    </p>
                  </div>

                  <div className="space-y-3">
                    {/* Google Identity Services renders the button here */}
                    <div ref={googleBtnRef} className="flex justify-center min-h-[44px]">
                      {!googleReady && !googleError && (
                        <div className="inline-flex h-11 items-center gap-2 text-sm text-muted-foreground">
                          <Loader2 size={16} className="animate-spin" />
                          Cargando…
                        </div>
                      )}
                    </div>

                    {googleError && (
                      <div className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
                        <AlertCircle size={14} className="shrink-0 mt-0.5" />
                        <span>{googleError}</span>
                      </div>
                    )}

                    <p className="px-3 text-center text-xs leading-relaxed text-muted-foreground/75">
                      Tu acceso se administra de forma segura con Google. No necesitas crear otra contraseña en Asternal.
                    </p>
                  </div>

                  <div className="mt-5 pt-4 border-t border-border/40">
                    {returnTo && returnTo.startsWith("/profile/") && (
                      <div className="mb-3 p-3 rounded-xl border border-primary/20 bg-primary/[0.04] text-center">
                        <p className="text-[11px] text-primary font-medium">
                          Inicia sesión para ver este perfil
                        </p>
                        <p className="text-[9px] text-muted-foreground mt-1 font-mono">
                          Serás redirigido al perfil después de iniciar sesión
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
