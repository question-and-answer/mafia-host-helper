import type { RoomStatus } from "@/types/game";

const STATUS_LABELS: Record<RoomStatus, string> = {
  waiting: "대기 중",
  assigned: "역할 배정 완료",
  revealed: "역할 공개",
  day: "낮",
  night: "밤",
  voting: "투표",
  ended: "종료",
};

const STATUS_STYLES: Record<RoomStatus, string> = {
  waiting: "bg-zinc-100 text-zinc-800 ring-zinc-200",
  assigned: "bg-amber-100 text-amber-900 ring-amber-200",
  revealed: "bg-emerald-100 text-emerald-900 ring-emerald-200",
  day: "bg-sky-100 text-sky-900 ring-sky-200",
  night: "bg-indigo-100 text-indigo-900 ring-indigo-200",
  voting: "bg-fuchsia-100 text-fuchsia-900 ring-fuchsia-200",
  ended: "bg-stone-200 text-stone-900 ring-stone-300",
};

export function StatusBadge({ status }: { status: RoomStatus }) {
  return (
    <span
      className={`inline-flex min-h-8 items-center rounded-full px-3 text-sm font-bold ring-1 ${STATUS_STYLES[status]}`}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}
