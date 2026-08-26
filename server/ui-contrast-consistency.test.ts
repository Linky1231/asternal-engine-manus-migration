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
    expect(glass).toContain("oklch(0.16 0.03 258 / 0.98)");
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
});
