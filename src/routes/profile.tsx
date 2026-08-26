import { createFileRoute, useNavigate, Link, Outlet, useMatch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Link2, Loader2, ShieldCheck, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { SubPageHeader } from "@/components/social/SubPageHeader";
import { ProfilePanel } from "@/components/social/ProfilePanel";
import { isMod as checkMod, getMyProfile, type Profile } from "@/lib/social/api";
import { startMultimodalLogin } from "@/lib/auth/manus";

export const Route = createFileRoute("/profile")({
  head: () => ({ meta: [{ title: "Mi perfil · Asternal" }] }),
  component: ProfilePage,
});

function ProfilePage() {
  const navigate = useNavigate();
  // Ruta hija (/profile/<id>): se renderiza el perfil de ESE usuario, no el nuestro.
  const otherMatch = useMatch({ from: "/profile/$userId", shouldThrow: false });
  const [myId, setMyId] = useState<string | null>(null);
  const [me, setMe] = useState<Profile | null>(null);
  const [mod, setMod] = useState(false);
  const [multimodalState, setMultimodalState] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [multimodalMessage, setMultimodalMessage] = useState("");

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { navigate({ to: "/auth", search: { returnTo: "/profile" } }); return; }
      setMyId(session.user.id);
      setMe(await getMyProfile());
      setMod(await checkMod());
    })();
  }, [navigate]);

  useEffect(() => {
    if (!me || !window.location.search.includes("multimodal=1")) return;
    let active = true;
    setMultimodalState("loading");
    void (async () => {
      try {
        const response = await fetch("/api/supabase/link-manus", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ username: me.username }),
        });
        const payload = await response.json() as { error?: string; session?: Record<string, unknown>; username?: string };
        if (!response.ok || !payload.session) throw new Error(payload.error || "No se pudo sincronizar la cuenta.");
        const { error } = await supabase.auth.setSession(payload.session as never);
        if (error) throw error;
        if (!active) return;
        setMultimodalState("success");
        setMultimodalMessage(`Cuenta sincronizada como @${payload.username || me.username}.`);
        window.history.replaceState({}, "", "/profile");
      } catch (error) {
        if (!active) return;
        setMultimodalState("error");
        setMultimodalMessage(error instanceof Error ? error.message : "No se pudo completar la sincronización.");
      }
    })();
    return () => { active = false; };
  }, [me]);

  const launchMultimodalLogin = () => {
    setMultimodalState("loading");
    setMultimodalMessage("Abriendo el acceso seguro de Manus…");
    try { startMultimodalLogin(); }
    catch (error) {
      setMultimodalState("error");
      setMultimodalMessage(error instanceof Error ? error.message : "No se pudo abrir Manus.");
    }
  };

  // Si la URL es /profile/<id>, el contenido real vive en la ruta hija
  // (profile.$userId) que el router monta en este Outlet.
  if (otherMatch) return <Outlet />;

  if (!myId) return null;
  return (
    <div className="min-h-screen w-full flex flex-col bg-background text-foreground">
      <SubPageHeader
        title="MI PERFIL"
        subtitle={me ? `@${me.username ?? "…"}` : undefined}
        right={
          me?.show_orbes !== false ? (
            <div title="Orbes" className="flex items-center gap-1.5 h-9 px-3 rounded-lg bg-primary/10 text-primary border border-primary/15 select-none">
              <Sparkles size={14} className="text-primary" fill="currentColor" />
              <span className="text-xs font-display font-semibold tabular-nums">{me?.orbes ?? 0}</span>
            </div>
          ) : undefined
        }
      />
      <main className="flex-1 max-w-2xl md:max-w-3xl lg:max-w-4xl mx-auto w-full px-3 py-3 pb-24">
        <section className="profile-multimodal-card mb-3 rounded-2xl border border-primary/25 bg-card/80 p-4 shadow-[0_16px_44px_rgba(40,120,210,0.12)]">
          <div className="flex items-start gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-primary/15 text-primary ring-1 ring-primary/25"><Link2 size={19} /></span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2"><h2 className="font-display text-sm font-semibold">Login multimodal</h2><ShieldCheck size={14} className="text-primary" /></div>
              <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">Vincula tu identidad de Manus con tu cuenta Asternal. Tus credenciales de Manus nunca se comparten con Supabase.</p>
              <button type="button" aria-label="Login multimodal con Manus" onClick={launchMultimodalLogin} disabled={multimodalState === "loading"} className="mt-3 inline-flex h-10 items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 via-blue-500 to-cyan-400 px-4 text-[11px] font-display font-semibold tracking-[0.08em] text-white shadow-[0_8px_22px_rgba(45,140,240,0.28)] transition hover:brightness-110 active:scale-[0.98] disabled:cursor-wait disabled:opacity-70">
                {multimodalState === "loading" ? <Loader2 size={14} className="animate-spin" /> : <Link2 size={14} />}
                {multimodalState === "loading" ? "SINCRONIZANDO…" : "LOGIN MULTIMODAL"}
              </button>
              {multimodalMessage && <p className={`mt-2 text-[10px] ${multimodalState === "error" ? "text-destructive" : "text-primary"}`} role="status">{multimodalMessage}</p>}
            </div>
          </div>
        </section>
        <ProfilePanel userId={myId} myId={myId} isMod={mod} viewingOwn={true} />
      </main>
    </div>
  );
}
