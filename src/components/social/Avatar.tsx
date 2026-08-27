import { useEffect, useState } from "react";
import type { Profile } from "@/lib/social/api";

/** Forma mínima de perfil: acepta Profile, ManagedUser y objetos de grupo. */
export type AvatarLike = {
  id?: string;
  username?: string | null;
  display_name?: string | null;
  avatar_url?: string | null;
};

/** Colores sólidos deterministas para el monograma de respaldo. */
const FALLBACK_COLORS = [
  "oklch(0.58 0.15 266)",
  "oklch(0.56 0.14 276)",
  "oklch(0.64 0.09 230)",
  "oklch(0.59 0.13 270)",
  "oklch(0.62 0.11 256)",
];

/** Hash FNV-1a estable por id/usuario → color fijo (nunca cambia entre renders). */
function hashKey(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Avatar universal: foto subida → monograma con color sólido determinista.
 *
 * Mientras la foto carga se muestra un fondo NEUTRO y la imagen aparece al
 * instante cuando se decodifica. El color determinista solo se ve cuando no
 * hay foto o la URL falló — entonces sí, la inicial con color de marca.
 */
export function Avatar({
  p,
  size,
  className = "",
  style,
  rounded = "full",
  label,
}: {
  p?: AvatarLike | null;
  /** Si se omite, el tamaño lo controla className (útil para tamaños responsive). */
  size?: number;
  className?: string;
  style?: React.CSSProperties;
  rounded?: "full" | "xl" | "lg" | "md";
  label?: string;
}) {
  const [imgFailed, setImgFailed] = useState(false);
  const url = p?.avatar_url;
  const name = (label || p?.display_name || p?.username || "").trim();
  const initial = (name.charAt(0) || "A").toUpperCase();
  const seed = p?.id ?? p?.username ?? name ?? "user";
  const fallbackColor = FALLBACK_COLORS[hashKey(seed) % FALLBACK_COLORS.length];

  // Al cambiar la URL (o aparecer) se reintenta la imagen: el fondo vuelve al
  // estado neutro mientras carga y el color vuelve si la URL falla.
  useEffect(() => {
    setImgFailed(false);
  }, [url]);

  const roundCls = rounded === "full" ? "rounded-full" : rounded === "xl" ? "rounded-xl" : rounded === "lg" ? "rounded-lg" : "rounded-md";
  const dims = size !== undefined ? { width: size, height: size, fontSize: Math.max(10, size * 0.42) } : {};
  const showPhoto = !!url && !imgFailed;
  const showMonogram = !showPhoto; // sin foto o URL rota → inicial con color sólido
  return (
    <div
      className={`relative overflow-hidden shrink-0 grid place-items-center font-display font-semibold text-white ${roundCls} ${className}`}
      style={{
        ...dims,
        // Foto presente pero aún cargando: fondo neutro quieto. El color de
        // respaldo solo pinta cuando no hay foto que mostrar.
        ...(showPhoto ? { background: "var(--surface-2)" } : { backgroundColor: fallbackColor }),
        ...style,
      }}
    >
      {showMonogram && <span className="relative">{initial}</span>}
      {showPhoto && (
        <img
          key={url}
          src={url}
          alt=""
          loading="eager"
          onError={() => setImgFailed(true)}
          className="absolute inset-0 w-full h-full object-cover"
        />
      )}
    </div>
  );
}
