import { describe, expect, it } from "vitest";
import { filterPlayHistoryToPublishedGames, isValidPlaySession, type PlaySessionRecord } from "../src/lib/social/history-validation";

const validSession = (gameId = "game-1"): PlaySessionRecord => ({
  gameId,
  gameTitle: "Juego real",
  coverUrl: null,
  startedAt: "2026-08-25T10:00:00.000Z",
  endedAt: "2026-08-25T10:20:00.000Z",
  durationSeconds: 1200,
});

describe("historial basado en datos reales", () => {
  it("acepta una sesión completa y coherente", () => {
    expect(isValidPlaySession(validSession())).toBe(true);
  });

  it("rechaza sesiones imposibles o incompletas", () => {
    expect(isValidPlaySession({ ...validSession(), durationSeconds: -20 })).toBe(false);
    expect(isValidPlaySession({ ...validSession(), endedAt: "2026-08-25T09:59:00.000Z" })).toBe(false);
    expect(isValidPlaySession({ ...validSession(), gameTitle: "" })).toBe(false);
  });

  it("conserva solo sesiones de juegos actualmente publicados", () => {
    const sessions = [validSession("published"), validSession("removed")];
    const games = [{ id: "published" }] as never[];
    expect(filterPlayHistoryToPublishedGames(sessions, games).map(session => session.gameId)).toEqual(["published"]);
  });
});
