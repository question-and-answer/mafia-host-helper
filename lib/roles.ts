import type { RoleCounts } from "@/types/game";

export const ROLE_ORDER = [
  "마피아",
  "경찰",
  "의사",
  "영매",
  "바보",
  "큐피드",
  "사냥꾼",
  "햄스터",
  "시민",
] as const;

export function getRecommendedRoles(playerCount: number): RoleCounts {
  const roles: RoleCounts = {};

  if (playerCount < 5) {
    return roles;
  }

  if (playerCount >= 31) {
    roles["마피아"] = 6;
    roles["경찰"] = 1;
    roles["의사"] = 1;
    roles["영매"] = 1;
    roles["바보"] = 1;
    roles["큐피드"] = 1;
    roles["사냥꾼"] = 1;
    roles["햄스터"] = 1;
  } else if (playerCount >= 26) {
    roles["마피아"] = playerCount >= 29 ? 6 : 5;
    roles["경찰"] = 1;
    roles["의사"] = 1;
    roles["영매"] = 1;
    roles["바보"] = 1;
    roles["큐피드"] = 1;
    roles["사냥꾼"] = 1;
    roles["햄스터"] = 1;
  } else if (playerCount >= 20) {
    roles["마피아"] = playerCount >= 23 ? 5 : 4;
    roles["경찰"] = 1;
    roles["의사"] = 1;
    roles["큐피드"] = 1;
    roles["사냥꾼"] = 1;
    roles["햄스터"] = 1;
  } else if (playerCount >= 14) {
    roles["마피아"] = playerCount >= 17 ? 4 : 3;
    roles["경찰"] = 1;
    roles["의사"] = 1;
    roles["큐피드"] = 1;
    roles["사냥꾼"] = 1;
  } else if (playerCount >= 11) {
    roles["마피아"] = playerCount >= 12 ? 3 : 2;
    roles["경찰"] = 1;
    roles["의사"] = 1;
    roles["큐피드"] = 1;
    roles["사냥꾼"] = 1;
  } else if (playerCount >= 8) {
    roles["마피아"] = 2;
    roles["경찰"] = 1;
    roles["의사"] = 1;
    roles["큐피드"] = 1;
  } else {
    roles["마피아"] = 1;
    roles["경찰"] = 1;
    roles["의사"] = 1;
  }

  const assignedCount = Object.values(roles).reduce((sum, count) => sum + count, 0);
  roles["시민"] = Math.max(playerCount - assignedCount, 0);

  return sortRoleCounts(roles);
}

export function sortRoleCounts(roleCounts: RoleCounts): RoleCounts {
  return ROLE_ORDER.reduce<RoleCounts>((sorted, role) => {
    if (roleCounts[role] !== undefined) {
      sorted[role] = roleCounts[role];
    }
    return sorted;
  }, {});
}

export function getRoleTotal(roleCounts: RoleCounts): number {
  return Object.values(roleCounts).reduce((sum, count) => sum + Number(count || 0), 0);
}

export function expandRoles(roleCounts: RoleCounts): string[] {
  return Object.entries(roleCounts).flatMap(([role, count]) =>
    Array.from({ length: Math.max(0, Number(count) || 0) }, () => role),
  );
}

export function getTeamForRole(role: string): string {
  if (role === "마피아") return "마피아 팀";
  if (role === "바보" || role === "큐피드") return "특수 역할";
  if (role === "햄스터") return "제3세력";
  return "시민 팀";
}
