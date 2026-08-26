import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const home = readFileSync(resolve(root, "src/routes/index.tsx"), "utf8");
const bell = readFileSync(resolve(root, "src/components/social/NotificationBell.tsx"), "utf8");
const panel = readFileSync(resolve(root, "src/components/social/NotificationsPanel.tsx"), "utf8");

describe("notification header placement", () => {
  it("places the standalone bell after orbes and before the menu", () => {
    const orbes = home.indexOf("me.orbes");
    const bellImport = home.indexOf("<NotificationBell />");
    const menu = home.indexOf('title="Menú"');
    expect(orbes).toBeGreaterThan(-1);
    expect(bellImport).toBeGreaterThan(orbes);
    expect(menu).toBeGreaterThan(bellImport);
    expect(home).not.toContain('label="Notificaciones"');
    expect(home).not.toContain("notifOpen");
  });

  it("caps the visible badge at +99 and keeps the count accessible", () => {
    expect(bell).toContain('unread > 99 ? "+99" : unread');
    expect(bell).toContain("aria-label={unread > 0");
  });

  it("renders the open panel outside the glass header and locks the page scroll", () => {
    expect(bell).toContain("createPortal(");
    expect(bell).toContain("document.body");
    expect(panel).toContain("z-[150]");
    expect(panel).toContain('document.body.style.overflow = "hidden"');
    expect(panel).toContain('role="dialog"');
  });
});
