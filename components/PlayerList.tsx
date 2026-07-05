import type { Player } from "@/types/game";

type PlayerListProps = {
  players: Player[];
  showRoles?: boolean;
  canManage?: boolean;
  onRename?: (player: Player) => void;
  onRemove?: (player: Player) => void;
};

export function PlayerList({
  players,
  showRoles = false,
  canManage = false,
  onRename,
  onRemove,
}: PlayerListProps) {
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
        <li key={player.id} className="px-4 py-3">
          <div className="flex items-start justify-between gap-3">
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
          </div>

          {canManage ? (
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => onRename?.(player)}
                className="min-h-10 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-black text-zinc-900"
              >
                이름 수정
              </button>
              <button
                type="button"
                onClick={() => onRemove?.(player)}
                className="min-h-10 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-black text-red-800"
              >
                내보내기
              </button>
            </div>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
