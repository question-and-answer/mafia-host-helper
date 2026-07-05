import { notFound } from "next/navigation";
import { deleteRoom, setRoomStatus, toggleRoomVisibility } from "./actions";
import { createSupabaseAdmin, isSupabaseAdminConfigured } from "@/lib/supabaseAdmin";
import type { RoomStatus } from "@/types/game";

type SuperAdminPageProps = {
  params: Promise<{ secret: string }>;
};

type AdminRoom = {
  id: string;
  code: string;
  name: string;
  is_visible: boolean;
  status: RoomStatus;
  day_number: number;
  created_at: string | null;
  players: { count: number }[];
};

const STATUS_OPTIONS: RoomStatus[] = ["waiting", "assigned", "revealed", "day", "night", "ended"];

export const dynamic = "force-dynamic";

export default async function SuperAdminPage({ params }: SuperAdminPageProps) {
  const { secret } = await params;

  if (!process.env.SUPER_ADMIN_SECRET || secret !== process.env.SUPER_ADMIN_SECRET) {
    notFound();
  }

  if (!isSupabaseAdminConfigured) {
    return (
      <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-4 py-8">
        <section className="rounded-lg border border-red-200 bg-red-50 p-6 text-red-900">
          <h1 className="text-2xl font-black">슈퍼 관리자 설정 필요</h1>
          <p className="mt-3 leading-7">
            Vercel 환경 변수에 <strong>SUPABASE_SERVICE_ROLE_KEY</strong>를 추가해야 합니다.
          </p>
        </section>
      </main>
    );
  }

  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase
    .from("rooms")
    .select("id, code, name, is_visible, status, day_number, created_at, players(count)")
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    throw new Error(error.message);
  }

  const rooms = (data ?? []) as AdminRoom[];

  return (
    <main className="mx-auto min-h-screen w-full max-w-5xl px-4 py-6">
      <header className="rounded-lg bg-zinc-950 p-5 text-white shadow-sm">
        <p className="text-sm font-bold text-red-300">Secret URL</p>
        <h1 className="mt-1 text-2xl font-black">슈퍼 관리자</h1>
        <p className="mt-2 text-sm text-zinc-300">최근 50개 방을 관리합니다.</p>
      </header>

      <section className="mt-5 space-y-3">
        {rooms.length === 0 ? (
          <div className="rounded-lg border border-dashed border-zinc-300 bg-white p-8 text-center text-zinc-500">
            생성된 방이 없습니다.
          </div>
        ) : null}

        {rooms.map((room) => {
          const playerCount = room.players?.[0]?.count ?? 0;

          return (
            <article key={room.id} className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="text-xl font-black text-zinc-950">{room.name}</h2>
                  <p className="mt-1 font-mono text-sm font-bold text-zinc-500">{room.code}</p>
                  <p className="mt-2 text-sm font-bold text-zinc-600">
                    {room.is_visible ? "공개" : "비공개"} · {room.status} · {playerCount}명 · 낮 {room.day_number}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:min-w-72">
                  <form action={toggleRoomVisibility.bind(null, secret, room.id, !room.is_visible)}>
                    <button className="min-h-11 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-black text-zinc-900">
                      {room.is_visible ? "숨기기" : "보이기"}
                    </button>
                  </form>
                  <form action={deleteRoom.bind(null, secret, room.id)}>
                    <button className="min-h-11 w-full rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-black text-red-800">
                      방 삭제
                    </button>
                  </form>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6">
                {STATUS_OPTIONS.map((status) => (
                  <form key={status} action={setRoomStatus.bind(null, secret, room.id, status)}>
                    <button
                      className={`min-h-10 w-full rounded-lg px-2 py-2 text-xs font-black ${
                        room.status === status
                          ? "bg-zinc-950 text-white"
                          : "border border-zinc-300 bg-white text-zinc-800"
                      }`}
                    >
                      {status}
                    </button>
                  </form>
                ))}
              </div>
            </article>
          );
        })}
      </section>
    </main>
  );
}
