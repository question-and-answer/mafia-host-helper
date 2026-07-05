export function getRecommendedDiscussionSeconds(playerCount: number): number {
  if (playerCount >= 26) return 8 * 60;
  if (playerCount >= 20) return 7 * 60;
  if (playerCount >= 14) return 5 * 60;
  if (playerCount >= 8) return 4 * 60;
  return 3 * 60;
}

export function formatSeconds(totalSeconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;

  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function getRemainingSeconds(
  discussionSeconds: number,
  discussionStartedAt: string | null,
): number {
  if (!discussionStartedAt) {
    return Math.max(0, discussionSeconds);
  }

  const elapsed = Math.floor((Date.now() - new Date(discussionStartedAt).getTime()) / 1000);
  return Math.max(0, discussionSeconds - elapsed);
}
