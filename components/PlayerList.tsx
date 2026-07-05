import type { Player } from "@/types/game";

export function PlayerList({ players, showRoles = false }: { players: Player[]; showRoles?: boolean }) {
  if (players.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-zinc-300 bg-white p-5 text-center text-zinc-500">
        아직 참가자가 없습니다.
      </div>
    );
  }

  return (
    <ul className="divide-y divide-zinc-200 overflow-hidden rounded-lg border border-zinc-200 bg-white">
      {players.map((player, index) => (
        <li key={player.id} className="flex items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <p className="truncate font-bold text-zinc-950">
              {index + 1}. {player.name}
            </p>
            {showRoles ? (
              <p className="text-sm text-zinc-500">
                {player.role ? `${player.role} · ${player.team ?? ""}` : "역할 미배정"}
              </p>
            ) : null}
          </div>
          <span className="shrink-0 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-800">
            참가
          </span>
        </li>
      ))}
    </ul>
  );
}
