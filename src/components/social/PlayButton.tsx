import { Loader2, Lock, Play } from "lucide-react";

export function PlayButton({
  label = "JUGAR",
  loadingLabel = "ABRIENDO",
  loading = false,
  locked = false,
  disabled = false,
  onClick,
  className = "",
  compact = false,
  "aria-label": ariaLabel,
}: {
  label?: string;
  loadingLabel?: string;
  loading?: boolean;
  locked?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  className?: string;
  compact?: boolean;
  "aria-label"?: string;
}) {
  const text = loading ? loadingLabel : label;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      aria-label={ariaLabel ?? text}
      className={`btn-grad inline-flex items-center justify-center gap-2 rounded-xl text-primary-foreground font-display tracking-widest text-xs transition-[transform,box-shadow,filter] active:scale-[0.97] disabled:cursor-wait disabled:opacity-70 ${compact ? "h-9 px-3" : "h-11 px-4 w-full"} ${className}`}
    >
      {loading ? <Loader2 size={compact ? 14 : 16} className="animate-spin" /> : locked ? <Lock size={compact ? 14 : 16} /> : <Play size={compact ? 14 : 16} fill="currentColor" />}
      <span>{text}</span>
    </button>
  );
}
