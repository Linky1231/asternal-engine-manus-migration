import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

/**
 * Cabecera compartida de sub-páginas (Orbes, Historial, Plus, Perfil, Admin…).
 *
 * Sustituye las 7 cabeceras duplicadas que había: cada página re-implementaba
 * «sticky + panel + botón atrás + título degradado». Ahora hay una sola fuente.
 *
 * - Cabecera plana (sin panel flotante): hairline inferior + blur al hacer
 *   scroll. Título en tinta (no glow falso), subtítulo mono opcional.
 * - `right` recibe acciones (píldora de orbes, insignia ACTIVO, etc.).
 */
export function SubPageHeader({
  title,
  icon,
  subtitle,
  right,
  onBack,
  backLabel = "Volver al menú principal",
}: {
  title: React.ReactNode;
  icon?: React.ReactNode;
  subtitle?: React.ReactNode;
  right?: React.ReactNode;
  onBack?: () => void;
  backLabel?: string;
}) {
  const back = onBack ? (
    <button
      onClick={onBack}
      aria-label={backLabel}
      className="glass-control ui-icon-tile w-10 h-10 rounded-xl active:scale-95 shrink-0"
    >
      <ArrowLeft size={16} />
    </button>
  ) : (
    <Link
      to="/"
      aria-label={backLabel}
      className="glass-control ui-icon-tile w-10 h-10 rounded-xl active:scale-95 shrink-0"
    >
      <ArrowLeft size={16} />
    </Link>
  );

  return (
    <header className="app-header glass-header sticky top-0 z-30 border-b border-white/[0.08]">
      <div className="max-w-2xl md:max-w-3xl lg:max-w-5xl xl:max-w-6xl mx-auto flex items-center gap-3 px-3 py-3">
        {back}
        <div className="flex-1 min-w-0">
          <div className="font-display text-[15px] font-semibold tracking-[-0.02em] text-foreground truncate flex items-center gap-2">
            {icon && <span className="text-primary shrink-0">{icon}</span>}
            <span className="truncate">{title}</span>
          </div>
          {subtitle && (
            <div className="text-[10px] font-mono tracking-[0.08em] text-muted-foreground/80 truncate mt-1">
              {subtitle}
            </div>
          )}
        </div>
        {right && <div className="flex items-center gap-2 shrink-0">{right}</div>}
      </div>
    </header>
  );
}
