import { createFileRoute, useNavigate, useSearch, Link } from "@tanstack/react-router";
import { useEffect, useState, useRef } from "react";
import { supabase, clearSupabaseCredentials } from "@/integrations/supabase/client";
import {
  Gamepad2, Mail, Lock, User, Eye, EyeOff, ArrowRight, Loader2,
  Check, AlertCircle, Sparkles, RefreshCw,
} from "lucide-react";
import { IDEA_HERO_COPY } from "@/lib/auth/idea-hero";
import {
  AUTH_FIELD_FOCUS_CLASS,
  AUTH_FIELD_FOCUS_ICON_CLASS,
  AUTH_FIELD_INPUT_FOCUS_CLASS,
} from "@/lib/auth/field-focus";
import { friendlyAuthError } from "@/lib/auth/friendly-error";

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

/* ─── Twinkling star ─── */
function Star({ index }: { index: number }) {
  const size = 1 + (index % 2);
  const x = `${(index * 37 + 13) % 100}%`;
  const y = `${(index * 23 + 5) % 100}%`;
  return (
    <div className="absolute rounded-full pointer-events-none"
      style={{
        width: size, height: size, left: x, top: y,
        background: "oklch(0.72 0.14 235)",
        animation: `twinkle ${3 + (index % 4)}s ease-in-out ${index * 0.35}s infinite`,
      }}
    />
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
      className="w-[168px] h-[200px] drop-shadow-[0_20px_24px_rgba(68,137,214,0.30)]"
      aria-hidden
    >
      <defs>
        <linearGradient id="idea-bulb-glass" x1="48" y1="34" x2="112" y2="142" gradientUnits="userSpaceOnUse">
          <stop stopColor="#eff9ff" />
          <stop offset="0.48" stopColor="#a9d9ff" />
          <stop offset="1" stopColor="#3d83d3" />
        </linearGradient>
        <linearGradient id="idea-bulb-base" x1="58" y1="143" x2="102" y2="168" gradientUnits="userSpaceOnUse">
          <stop stopColor="#dff1ff" />
          <stop offset="1" stopColor="#4f91d4" />
        </linearGradient>
      </defs>
      <circle cx="80" cy="87" r="62" fill="#77bdf2" opacity="0.16" />
      <g stroke="#68abe7" strokeWidth="5" strokeLinecap="round" opacity="0.9">
        <path d="M80 14v12" />
        <path d="m38 31 9 9" />
        <path d="M22 77h13" />
        <path d="m122 40 9-9" />
        <path d="M125 77h13" />
      </g>
      <path
        d="M80 31c-29 0-51 23-51 52 0 20 11 37 29 47v12h44v-12c18-10 29-27 29-47 0-29-22-52-51-52Z"
        fill="url(#idea-bulb-glass)"
        stroke="#4786c8"
        strokeWidth="3"
      />
      <path d="M63 91c5 4 9 11 10 24M97 91c-5 4-9 11-10 24M73 115h14" fill="none" stroke="#477bb3" strokeWidth="3.5" strokeLinecap="round" />
      <path d="M57 58c7-12 18-18 31-18" fill="none" stroke="#fff" strokeWidth="8" strokeLinecap="round" opacity="0.78" />
      <rect x="57" y="141" width="46" height="12" rx="6" fill="url(#idea-bulb-base)" stroke="#4f87c0" strokeWidth="2" />
      <path d="M65 158h30M68 166h24" stroke="#4f87c0" strokeWidth="5" strokeLinecap="round" />
    </svg>
  );
}

/* ─── Hero scene ─── */
function HeroScene() {
  return (
    <div className="relative w-full h-[230px] lg:h-[440px] select-none pointer-events-none">
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 origin-center scale-[0.6] lg:scale-100" style={{ willChange: "transform" }}>
        <div className="relative w-[460px] h-[460px]">

          {/* Ambient glows */}
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

/* ─── useFieldState ─── */
function useFieldState(initial = "") {
  const [value, setValue] = useState(initial);
  const [focused, setFocused] = useState(false);
  const [touched, setTouched] = useState(false);
  const hasValue = value.trim().length > 0;
  const showLabel = focused || hasValue;
  return { value, setValue, focused, setFocused, touched, setTouched, hasValue, showLabel };
}

/* ─── FloatInput ─── */
function FloatInput({
  label, icon: Icon, type, value, onChange, onFocus, onBlur,
  focused, hasValue, placeholder, autoComplete, maxLength, minLength,
  inputRef, children, error,
}: {
  label: string; icon: React.ElementType; type: string;
  value: string; onChange: (v: string) => void;
  onFocus?: () => void; onBlur?: () => void;
  focused: boolean; hasValue: boolean;
  placeholder?: string; autoComplete?: string;
  maxLength?: number; minLength?: number;
  inputRef?: React.RefObject<HTMLInputElement | null>;
  children?: React.ReactNode;
  error?: string | null;
}) {
  const isEmail = type === "email";
  const isValidEmail = isEmail && hasValue && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  const isValidPassword = type === "password" && hasValue && value.length >= 6;
  const showLabelLocal = focused || hasValue;

  return (
    <div className="space-y-1">
      <div className="relative group/input">
        <div className={`glass-control relative isolate flex items-center overflow-hidden rounded-xl ${
          focused
            ? AUTH_FIELD_FOCUS_CLASS
            : error
              ? 'border-destructive/40 ring-[3px] ring-destructive/[0.04]'
              : ''
        }`}>
          <span className={`relative z-10 flex w-10 shrink-0 justify-center pointer-events-none transition-colors duration-200 ${focused ? AUTH_FIELD_FOCUS_ICON_CLASS : error ? 'text-destructive/50' : 'text-muted-foreground/30'}`}>
            <Icon size={14} />
          </span>
          <div className="relative flex-1">
            <input ref={inputRef as React.RefObject<HTMLInputElement>}
              type={type} value={value} onChange={e => onChange(e.target.value)}
              onFocus={onFocus} onBlur={onBlur}
              placeholder={focused ? placeholder || "" : " "}
              autoComplete={autoComplete} maxLength={maxLength} minLength={minLength} required
              className={`w-full bg-transparent px-2.5 pt-4 pb-1.5 text-sm outline-none transition-all duration-200 placeholder:text-muted-foreground/20 ${AUTH_FIELD_INPUT_FOCUS_CLASS}`}
            />
            <label className={`absolute left-2.5 transition-all duration-200 pointer-events-none select-none origin-left ${
              showLabelLocal
                ? 'top-0.5 text-[10px] font-medium translate-y-0'
                : 'top-1/2 -translate-y-1/2 text-sm text-muted-foreground/40'
            } ${focused ? 'text-primary/70' : error ? 'text-destructive/60' : 'text-muted-foreground/50'}`}>
              {label}
            </label>
          </div>
          {hasValue && !focused && (
            <span className="pr-3 shrink-0 text-emerald-500">
              {(isEmail && isValidEmail) || (type === "password" && isValidPassword) || (type === "text" && hasValue)
                ? <Check size={14} /> : null}
            </span>
          )}
          {children}
        </div>
        {error && (
          <p className="text-[11px] text-destructive/80 mt-1 flex items-center gap-1.5 px-1">
            <AlertCircle size={11} className="shrink-0" /> {error}
          </p>
        )}
      </div>
    </div>
  );
}

/* ─── PasswordStrength ─── */
function PasswordStrength({ password }: { password: string }) {
  if (!password) return null;
  const len = password.length;
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasDigit = /\d/.test(password);
  const hasSpecial = /[^A-Za-z0-9]/.test(password);
  const score = [len >= 6, len >= 10, hasUpper && hasLower, hasDigit, hasSpecial].filter(Boolean).length;
  const strength = score <= 1 ? "weak" : score <= 3 ? "medium" : "strong";
  const colors = {
    weak: { bg: "bg-destructive/15", fill: "bg-destructive/70", text: "text-destructive/70" },
    medium: { bg: "bg-amber-100", fill: "bg-amber-400", text: "text-amber-600" },
    strong: { bg: "bg-emerald-100", fill: "bg-emerald-500", text: "text-emerald-600" },
  };
  const c = colors[strength];
  return (
    <div className="px-1 mt-1.5 space-y-1">
      <div className="flex gap-1">
        {[1, 2, 3].map(i => (
          <div key={i} className={`h-1 rounded-full flex-1 transition-all duration-500 ${i <= score ? c.fill : c.bg}`} />
        ))}
      </div>
      <p className={`text-[10px] font-medium tracking-wide ${c.text} capitalize`}>{strength}</p>
    </div>
  );
}

/* ─── Logo (rediseñado) ─── */
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
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const email = useFieldState();
  const password = useFieldState();
  const username = useFieldState();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string | null>>({});
  const [showPw, setShowPw] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const usernameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data?.session) navigate({ to: returnTo || "/" });
    });
    requestAnimationFrame(() => setLoaded(true));
  }, [navigate]);

  const clearErrors = () => { setErr(null); setFieldErrors({}); };

  // Recuperación rápida: si una clave guardada en el navegador es inválida
  // (p. ej. un token sbp_… pegado como anon key), la borra y recarga la app.
  const resetConnection = () => {
    clearSupabaseCredentials();
    window.location.reload();
  };

  const switchMode = (m: "signin" | "signup") => {
    clearErrors();
    setSuccessMsg(null);
    setMode(m);
  };

  /** Normaliza un nombre de usuario a la forma segura (minúsculas, a-z0-9_). */
  const cleanUsername = (v: string) => v.trim().toLowerCase().replace(/[^a-z0-9_]/g, "");

  /**
   * Resuelve el identificador de acceso: si es un correo se usa tal cual;
   * si es un nombre de usuario se mapea de forma determinista a
   * <usuario>@asternal.app (la misma cuenta creada al registrarse sin correo).
   */
  const resolveLoginEmail = (identifier: string): string => {
    const v = identifier.trim();
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return v;
    const u = cleanUsername(v);
    return `${u || "usuario"}@asternal.app`;
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearErrors();
    setSuccessMsg(null);
    email.setTouched(true);
    password.setTouched(true);
    if (mode === "signup") username.setTouched(true);

    const errors: Record<string, string> = {};
    if (!email.value.trim()) errors.email = "Escribe tu usuario o correo";
    if (mode === "signup" && !cleanUsername(username.value)) errors.username = "Elige un nombre de usuario";
    if (!password.value) errors.password = "La contraseña es obligatoria";
    else if (password.value.length < 6) errors.password = "Mínimo 6 caracteres";

    if (Object.keys(errors).length > 0) { setFieldErrors(errors); return; }

    setBusy(true);
    try {
      if (mode === "signup") {
        const u = cleanUsername(username.value);
        // Sin correo no pasa nada: se usa <usuario>@asternal.app (determinista,
        // sirve también para acceder después solo con el nombre de usuario).
        const emailFinal = email.value.trim() || `${u}@asternal.app`;
        const { error } = await supabase.auth.signUp({
          email: emailFinal, password: password.value,
          options: { data: { username: u } },
        });
        if (error) throw error;
        setSuccessMsg("Cuenta creada correctamente");
        setTimeout(() => navigate({ to: returnTo || "/" }), 1000);
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: resolveLoginEmail(email.value),
          password: password.value,
        });
        if (error) throw error;
        navigate({ to: returnTo || "/" });
      }
    } catch (e) {
      const msg = (e as Error).message;
      const friendly = friendlyAuthError(msg);
      setErr(friendly);
      if (/email|user|rate/i.test(msg))
        setFieldErrors(prev => ({ ...prev, email: friendly }));
      else if (/password|contraseña/i.test(msg))
        setFieldErrors(prev => ({ ...prev, password: friendly }));
    } finally { setBusy(false); }
  };

  return (
    <div className="min-h-dvh w-full flex flex-col bg-background overflow-y-auto relative">

      <ConfettiBurst active={!!successMsg} />

      {/* ─── Background layers ─── */}
      <div className="fixed inset-0 pointer-events-none select-none overflow-hidden" style={{ transform: "translateZ(0)" }}>
        {/* Base glow */}
        <div className="absolute inset-0 grad-brand-soft" />
        {/* Mesh blobs */}
        {/* Dot grid */}
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

        {/* Header: logo memorable */}
        <header className="w-full px-5 pt-4 sm:pt-6 flex justify-center">
          <Logo loaded={loaded} />
        </header>

        {/* Main grid */}
        <div className="flex-1 w-full max-w-6xl mx-auto grid lg:grid-cols-[1.05fr_1fr] items-center gap-2 lg:gap-14 px-5 pb-10 pt-3">

          {/* ─── BRAND + HERO ─── */}
          <div className="order-1 flex flex-col items-center text-center">

            {/* Hero visual — estrella de la página */}
            <div className="w-full" style={{
              animation: loaded ? 'scale-in 1100ms 100ms cubic-bezier(0.16,1,0.3,1) both' : 'none',
            }}>
              <HeroScene />
            </div>

            {/* Personality line */}
            <div style={{
              animation: loaded ? 'fade-in-up 500ms 300ms cubic-bezier(0.22,1,0.36,1) both' : 'none',
            }}>
              <div className="glass-control inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-[11px] font-display font-medium tracking-wide text-primary/80 -mt-1 lg:-mt-3">
                <Sparkles size={12} className="text-accent" />
                {IDEA_HERO_COPY.eyebrow}
              </div>
            </div>

            {/* Headline corta y directa */}
            <div style={{
              animation: loaded ? 'fade-in-up 600ms 420ms cubic-bezier(0.22,1,0.36,1) both' : 'none',
            }}>
              <h1 className="text-[clamp(1.8rem,3.6vw,2.9rem)] font-display font-bold tracking-tight leading-[1.08] text-foreground mt-4 mb-3 max-w-lg mx-auto">
                {IDEA_HERO_COPY.titleLead}{" "}
                <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                  {IDEA_HERO_COPY.titleAccent}
                </span>
              </h1>
            </div>

            {/* Descripción breve */}
            <div style={{
              animation: loaded ? 'fade-in-up 600ms 540ms cubic-bezier(0.22,1,0.36,1) both' : 'none',
            }}>
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
                {/* Tarjeta premium: borde degradado + sombras en capas + radius 24px */}
                <div className="glass-surface relative rounded-3xl">
                  <div className="relative rounded-3xl p-7 overflow-hidden group/form-card">

                    {/* Shine superior */}
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 h-px w-3/4 bg-gradient-to-r from-transparent via-white/90 to-transparent" />
                    {/* Glow interno */}
                    <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-64 h-32 bg-primary/5 blur-2xl rounded-full pointer-events-none" />

                    {/* Header */}
                    <div className="text-center mb-6 relative">
                      <div className="w-12 h-12 rounded-2xl grad-brand grid place-items-center mx-auto mb-3  relative">
                        <div className="absolute inset-0 rounded-2xl bg-primary/20 blur-lg scale-125 animate-pulse" style={{ animationDuration: '3s' }} />
                        <Gamepad2 size={22} className="text-white relative" />
                      </div>
                      <h2 className="text-lg font-display font-semibold tracking-tight text-foreground mb-0.5">
                        {mode === "signin" ? "Bienvenido de nuevo" : "Crea tu cuenta"}
                      </h2>
                      <p className="text-sm text-muted-foreground/70">
                        {mode === "signin" ? "Accede a tu estudio en la nube" : "Únete a la comunidad Asternal"}
                      </p>
                    </div>

                    {/* Selector de acceso: mismo gris suave y pastilla clara de la navegación inferior. */}
                    <div className="flex bg-muted/60 rounded-xl p-0.5 mb-5 relative" role="tablist" aria-label="Modo de acceso">
                      <div
                        className="absolute top-0.5 bottom-0.5 w-[calc(50%-2px)] rounded-[10px] bg-white shadow-sm will-change-transform"
                        style={{
                          left: 0,
                          transform: `translateX(${mode === "signin" ? 0 : 100}%)`,
                          transition: "transform 280ms cubic-bezier(0.22, 1, 0.36, 1)",
                          pointerEvents: "none" as const,
                        }}
                      />
                      {(["signin", "signup"] as const).map(m => (
                        <button key={m} type="button" onClick={() => switchMode(m)} role="tab"
                          aria-selected={mode === m}
                          className={`relative z-10 flex-1 min-h-11 rounded-[10px] text-xs font-display font-semibold tracking-wider transition-colors duration-200 ${
                            mode === m
                              ? "text-foreground"
                              : "text-muted-foreground/80 hover:text-foreground"
                          }`}>
                          {m === "signin" ? "ACCEDER" : "REGISTRARSE"}
                        </button>
                      ))}
                    </div>

                    {/* Form */}
                    <form onSubmit={onSubmit} className="space-y-3">
                      {mode === "signup" && (
                        <div style={{ animation: 'slide-in-up 300ms cubic-bezier(0.22,1,0.36,1) both', animationDelay: '0ms' }}>
                          <FloatInput label="Nombre de usuario" icon={User} type="text"
                            value={username.value} onChange={username.setValue}
                            onFocus={() => username.setFocused(true)}
                            onBlur={() => { username.setFocused(false); username.setTouched(true); }}
                            focused={username.focused} hasValue={username.hasValue}
                            placeholder="tu_usuario" autoComplete="username" maxLength={32}
                            inputRef={usernameRef as React.RefObject<HTMLInputElement>}
                            error={fieldErrors.username} />
                        </div>
                      )}

                      <div style={{ animation: 'slide-in-up 300ms cubic-bezier(0.22,1,0.36,1) both', animationDelay: '80ms' }}>
                        <FloatInput
                          label={mode === "signup" ? "Correo electrónico (opcional)" : "Usuario o correo"}
                          icon={mode === "signup" ? Mail : User}
                          type="text"
                          value={email.value} onChange={email.setValue}
                          onFocus={() => email.setFocused(true)}
                          onBlur={() => { email.setFocused(false); email.setTouched(true); }}
                          focused={email.focused} hasValue={email.hasValue}
                          placeholder={mode === "signup" ? "email@ejemplo.com (no es necesario)" : "tu_usuario o email@ejemplo.com"}
                          autoComplete={mode === "signup" ? "email" : "username"}
                          inputRef={emailRef} error={fieldErrors.email} />
                      </div>

                      <div style={{ animation: 'slide-in-up 300ms cubic-bezier(0.22,1,0.36,1) both', animationDelay: '160ms' }}>
                        <FloatInput label="Contraseña" icon={Lock} type={showPw ? "text" : "password"}
                          value={password.value} onChange={password.setValue}
                          onFocus={() => password.setFocused(true)}
                          onBlur={() => { password.setFocused(false); password.setTouched(true); }}
                          focused={password.focused} hasValue={password.hasValue}
                          placeholder={mode === "signup" ? "Mínimo 6 caracteres" : "••••••••"}
                          autoComplete={mode === "signup" ? "new-password" : "current-password"}
                          minLength={6} inputRef={passwordRef} error={fieldErrors.password}>
                          <button type="button" onClick={() => setShowPw(!showPw)}
                            className="pr-3 text-muted-foreground/30 hover:text-muted-foreground/60 transition-colors shrink-0" tabIndex={-1}>
                            {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
                          </button>
                        </FloatInput>
                        {mode === "signup" && <PasswordStrength password={password.value} />}
                      </div>

                      {err && !fieldErrors.email && !fieldErrors.password && !fieldErrors.username && (
                        <div className="flex items-start gap-2.5 px-3.5 py-2.5 rounded-lg bg-destructive/[0.04] border border-destructive/10 text-xs text-destructive/90 animate-[scale-in_200ms_ease-out]">
                          <div className="w-4 h-4 rounded-full bg-destructive/8 grid place-items-center shrink-0 mt-[1px] text-[9px] font-bold">!</div>
                          <span>{err}</span>
                        </div>
                      )}

                      {/* Recuperación de una configuración local de conexión inválida. */}
                      {err && /invalid api key|apikey|invalid key/i.test(err) && (
                        <button type="button" onClick={resetConnection}
                          className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-lg border border-dashed border-amber-400/50 text-[11px] font-medium text-amber-700 dark:text-amber-400 bg-amber-50/50 dark:bg-amber-950/20 hover:bg-amber-100/70 dark:hover:bg-amber-950/40 transition-colors"
                        >
                          <RefreshCw size={11} /> Restablecer conexión y recargar
                        </button>
                      )}

                      {successMsg && (
                        <div className="px-3.5 py-2.5 rounded-lg bg-emerald-50/80 border border-emerald-200/60 text-xs text-emerald-700/90 animate-[scale-in_300ms_ease-out]">
                          {successMsg}
                        </div>
                      )}

                      {/* Submit button */}
                      <div style={{ animation: 'slide-in-up 300ms cubic-bezier(0.22,1,0.36,1) both', animationDelay: '240ms' }}>
                        <button disabled={busy}
                          className="btn-grad relative w-full py-2.5 rounded-xl text-sm font-display font-semibold tracking-wide active:scale-[0.98] disabled:opacity-50 overflow-hidden group/btn"
                        >
                          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover/btn:translate-x-full transition-transform duration-700 ease-in-out" />
                          <div className="absolute inset-0 bg-white/[0.06] translate-y-full group-hover/btn:translate-y-0 transition-transform duration-500" />
                          <span className="relative z-10 flex items-center justify-center gap-2">
                            {busy ? (
                              <><Loader2 size={14} className="animate-spin" />{mode === "signin" ? "Accediendo…" : "Creando…"}</>
                            ) : (
                              <><span>{mode === "signin" ? "ACCEDER" : "CREAR CUENTA"}</span><ArrowRight size={13} className="group-hover/btn:translate-x-0.5 transition-transform" /></>
                            )}
                          </span>
                        </button>
                      </div>

                    </form>

                    <div className="mt-5 pt-4 border-t border-border/40">
                      {returnTo && returnTo.startsWith("/profile/") && (
                        <div className="mb-3 p-3 rounded-xl border border-primary/20 bg-primary/[0.04] text-center">
                          <p className="text-[11px] text-primary font-medium">
                            Inicia sesión o crea una cuenta para ver este perfil
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
