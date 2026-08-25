import type { Profile } from "@/lib/social/api";
import { isPlusActive } from "@/lib/social/api";
import { BadgeCheck, Star } from "lucide-react";

/**
 * Renders a user's display name with their Plus effect (if any and Plus is active).
 * Effects: glow, rainbow, sparkle, gradient, pulse, shadow, neon.
 */
export function UserName({
  p, size = "sm", showBadge = true, className = "",
}: {
  p: Profile | null | undefined;
  size?: "xs" | "sm" | "md" | "lg";
  showBadge?: boolean;
  className?: string;
}) {
  const name = p?.display_name || p?.username || "Jugador";
  const plusActive = !!p && isPlusActive(p);
  const effect = plusActive && p?.name_effect ? p.name_effect : null;
  const badge = plusActive && (p?.show_plus_badge ?? true);

  const sizeCls =
    size === "xs" ? "text-[11px]" :
    size === "md" ? "text-base" :
    size === "lg" ? "text-lg" : "text-sm";

  return (
    <span className={`inline-flex items-center gap-1 min-w-0 ${className}`}>
      <span
        className={`font-display ${sizeCls} ${effect ? `name-fx name-fx-${effect}` : "truncate"} ${effect ? "max-w-[180px] overflow-hidden text-ellipsis whitespace-nowrap" : ""}`}
        data-effect={effect ?? undefined}
      >
        {name}
      </span>
      {p?.is_verified && (
        <span className="inline-flex items-center text-sky-500 shrink-0" title="Cuenta verificada" aria-label="Cuenta verificada">
          <BadgeCheck size={size === "lg" ? 17 : size === "md" ? 15 : 13} fill="currentColor" className="text-white" />
        </span>
      )}
      {showBadge && badge && (
        <span
          className="inline-flex items-center px-1 py-0.5 rounded text-white text-[9px] font-display shrink-0"
          style={{ background: "var(--gradient-plus)" }}
          title="Asternal Plus"
        >
          <Star size={8} fill="currentColor" />
        </span>
      )}
    </span>
  );
}
