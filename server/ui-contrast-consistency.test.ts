import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const playButton = readFileSync(resolve(root, "src/components/social/PlayButton.tsx"), "utf8");
const gameCard = readFileSync(resolve(root, "src/components/social/GameCard.tsx"), "utf8");
const gamesHome = readFileSync(resolve(root, "src/components/social/GamesHome.tsx"), "utf8");
const postCard = readFileSync(resolve(root, "src/components/social/PostCard.tsx"), "utf8");
const plus = readFileSync(resolve(root, "src/routes/plus.tsx"), "utf8");
const glass = readFileSync(resolve(root, "src/glass-intensity.css"), "utf8");
const search = readFileSync(resolve(root, "src/components/social/SearchSection.tsx"), "utf8");
const profile = readFileSync(resolve(root, "src/components/social/ProfilePanel.tsx"), "utf8");
const styles = readFileSync(resolve(root, "src/styles.css"), "utf8");
const subPageHeader = readFileSync(resolve(root, "src/components/social/SubPageHeader.tsx"), "utf8");
const button = readFileSync(resolve(root, "client/src/components/ui/button.tsx"), "utf8");
const auth = readFileSync(resolve(root, "src/routes/auth.tsx"), "utf8");
const chat = readFileSync(resolve(root, "src/components/social/ChatSection.tsx"), "utf8");

describe("UI contrast and consistency", () => {
  it("uses one PlayButton in Home and the internal game card", () => {
    expect(playButton).toContain("btn-grad");
    expect(gameCard).toContain('import { PlayButton } from "./PlayButton";');
    expect(gameCard).toContain("<PlayButton");
    expect(gamesHome).toContain('import { PlayButton } from "./PlayButton";');
    expect(gamesHome).toContain("<PlayButton");
    expect(gamesHome).not.toContain('hasVisual ? "!bg-white');
  });

  it("keeps the publication hairline inside the card", () => {
    expect(postCard).toContain('className="mx-3 h-px grad-brand-fade');
  });

  it("keeps Plus inputs and X/Twitter readable on dark surfaces", () => {
    expect(glass).toContain(".plus-page .plus-social-input");
    expect(glass).toContain("background: oklch(0.19 0.035 258 / 0.98) !important;");
    expect(plus).toContain('placeholder="URL de X / Twitter"');
    expect(plus).toContain("placeholder:text-muted-foreground/80");
    expect(profile).toContain('label: "X / Twitter"');
    expect(profile).toContain('color: "#7dd3fc"');
  });

  it("gives search counters tabular numerals and visible contrast", () => {
    expect(search).toContain("tabular-nums text-center");
    expect(search).toContain('bg-muted/70 text-foreground/80');
    expect(search).toContain("text-primary-glow");
  });

  it("keeps the global visual system and shared controls coherent", () => {
    expect(styles).toContain(".ui-panel {");
    expect(styles).toContain("background: oklch(0.215 0.032 258 / 0.96);");
    expect(styles).not.toMatch(/(?:linear|radial|conic)-gradient/);
    expect(subPageHeader).toContain("ui-icon-tile");
    expect(button).toContain("transition-[background-color,border-color,box-shadow,color,transform]");
    expect(postCard).toContain("ui-panel");
    expect(postCard).not.toContain("bg-violet-500");
    expect(postCard).not.toContain("bg-rose-500");
  });

  it("keeps interactive controls solid and the mobile chat composer usable", () => {
    expect(styles).toContain("background: var(--primary);");
    expect(styles).toContain(".chat-composer {");
    expect(glass).toContain("background-image: none !important;");
    expect(glass).toContain(":is(button, a).grad-brand");
    expect(auth).toContain('stopColor="#ffe8a1"');
    expect(auth).toContain('stroke="#d29a3b"');
    expect(chat).toContain('className="chat-composer relative flex flex-wrap');
    expect(chat).toContain("chat-composer-text");
    expect(chat).toContain("chat-composer-send");
    expect(chat).not.toContain('background: "var(--gradient-asternal)"');
  });
});
