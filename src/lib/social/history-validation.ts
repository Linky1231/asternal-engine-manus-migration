export type PlaySessionRecord = {
  gameId: string;
  gameTitle: string;
  coverUrl: string | null;
  startedAt: string;
  endedAt: string;
  durationSeconds: number;
};

export type PublishedGameReference = { id: string };

export function isValidPlaySession(session: unknown): session is PlaySessionRecord {
  if (!session || typeof session !== "object") return false;
  const item = session as Partial<PlaySessionRecord>;
  const started = Date.parse(item.startedAt ?? "");
  const ended = Date.parse(item.endedAt ?? "");
  return typeof item.gameId === "string" && item.gameId.length > 0
    && typeof item.gameTitle === "string" && item.gameTitle.length > 0
    && Number.isFinite(started) && Number.isFinite(ended) && ended >= started
    && typeof item.durationSeconds === "number" && Number.isFinite(item.durationSeconds)
    && item.durationSeconds >= 3 && item.durationSeconds <= 24 * 60 * 60;
}

export function filterPlayHistoryToPublishedGames(
  sessions: readonly PlaySessionRecord[],
  games: readonly PublishedGameReference[],
): PlaySessionRecord[] {
  const publishedIds = new Set(games.map(game => game.id));
  return sessions.filter(session => publishedIds.has(session.gameId));
}
