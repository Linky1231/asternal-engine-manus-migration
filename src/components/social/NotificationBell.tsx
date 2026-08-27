import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Bell } from "lucide-react";
import { countUnreadNotifications } from "@/lib/social/api";
import { NotificationsPanel } from "./NotificationsPanel";

/**
 * Campana de notificaciones: muestra el contador de no leídas en la cabecera y
 * abre el panel completo de estadísticas (NotificationsPanel) al tocarla.
 */
export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);

  const reload = async () => {
    try {
      setUnread(await countUnreadNotifications());
    } catch { /* noop */ }
  };

  // Carga inicial, actualización periódica y eventos de la interfaz.
  useEffect(() => {
    reload();
    const t = setInterval(reload, 45000);
    const onNotificationsChanged = () => { void reload(); };
    window.addEventListener("asternal-notifications:changed", onNotificationsChanged);
    return () => {
      clearInterval(t);
      window.removeEventListener("asternal-notifications:changed", onNotificationsChanged);
    };
  }, []);

  return (
    <div className="relative">
      <button
        onClick={() => { setOpen(true); setUnread(0); }}
        title={unread > 0 ? `${unread > 99 ? "+99" : unread} notificaciones sin leer` : "Notificaciones"}
        aria-label={unread > 0 ? `${unread > 99 ? "+99" : unread} notificaciones sin leer` : "Notificaciones"}
        className="glass-control ui-icon-tile relative w-10 h-10 rounded-xl active:scale-95 transition-colors text-ink-2 hover:text-foreground shrink-0"
      >
        <Bell size={16} />
        {unread > 0 && (
          <span className="absolute -top-1.5 -right-1.5 bg-destructive text-destructive-foreground text-[9px] font-mono rounded-full min-w-4 h-4 px-0.5 grid place-items-center animate-in zoom-in ring-2 ring-background">{unread > 99 ? "+99" : unread}</span>
        )}
      </button>

      {open && typeof document !== "undefined" && createPortal(
        <NotificationsPanel onClose={() => setOpen(false)} />,
        document.body,
      )}
    </div>
  );
}
