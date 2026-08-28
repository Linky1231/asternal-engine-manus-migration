import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

export const Route = createFileRoute("/reset-password")({
  head: () => ({ meta: [{ title: "Acceso seguro · Asternal" }] }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();

  useEffect(() => {
    void navigate({ to: "/auth", replace: true });
  }, [navigate]);

  return (
    <main className="min-h-screen grid place-items-center bg-background p-4 text-center">
      <section className="w-full max-w-sm rounded-xl border border-border bg-surface p-6 shadow-sm space-y-3">
        <h1 className="text-base font-semibold tracking-wide">Acceso administrado por Manus</h1>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Asternal no almacena contraseñas propias. Serás enviado al acceso seguro de Manus.
        </p>
        <Link to="/auth" className="inline-flex h-10 items-center justify-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground active:scale-[0.98] transition">
          Ir al acceso
        </Link>
      </section>
    </main>
  );
}
