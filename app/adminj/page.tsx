import { createHash } from "crypto";
import { cookies } from "next/headers";
import { deleteRoom, loginAdminj, setRoomStatus, toggleRoomVisibility } from "./actions";
import { createSupabaseAdmin, isSupabaseAdminConfigured } from "@/lib/supabaseAdmin";
import type { RoomStatus } from "@/types/game";

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

const COOKIE_NAME = "mafia_adminj";
const STATUS_OPTIONS: RoomStatus[] = ["waiting", "assigned", "revealed", "day", "night", "ended"];

export const dynamic = "force-dynamic";

function getAdminToken() {
  const password = process.env.ADMINJ_PASSWORD;
  if (!password) return "";

  return createHash("sha256").update(password).digest("hex");
}

export default async function AdminjPage() {
  const cookieStore = await cookies();
  const isLoggedIn = cookieStore.get(COOKIE_NAME)?.value === getAdminToken();

  if (!process.env.ADMINJ_PASSWORD) {
    return (
      <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-4 py-8">
        <section className="rounded-lg border border-red-200 bg-red-50 p-6 text-red-900">
          <h1 className="text-2xl font-black">관리자 비밀번호 설정 필요</h1>
          <p className="mt-3 leading-7">
            Vercel 환경 변수에 <strong>ADMINJ_PASSWORD</strong>를 추가해 주세요.
          </p>
        </section>
      </main>
    );
  }

  if (!isLoggedIn) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-8">
        <section className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-black text-zinc-950">관리자 로그인</h1>
          <p className="mt-2 text-sm text-zinc-500">/adminj 관리자 비밀번호를 입력하세요.</p>
          <form action={loginAdminj} className="mt-6 space-y-3">
            <input
              name="password"
              type="password"
              placeholder="관리자 비밀번호"
              className="h-14 w-full rounded-lg border border-zinc-300 px-4 text-lg font-bold text-zinc-950 outline-none focus:border-red-500 focus:ring-2 focus:ring-red-100"
              required
            />
            <button className="min-h-14 w-full rounded-lg bg-zinc-950 px-5 py-4 text-lg font-black text-white">
              들어가기
            </button>
          </form>
        </section>
      </main>
    );
  }

  if (!isSupabaseAdminConfigured) {
    return (
      <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-4 py-8">
        <section className="rounded-lg border border-red-200 bg-red-50 p-6 text-red-900">
          <h1 className="text-2xl font-black">Supabase 관리자 키 필요</h1>
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
        <p className="text-sm font-bold text-red-300">/adminj</p>
        <h1 className="mt-1 text-2xl font-black">관리자</h1>
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
                  <form action={toggleRoomVisibility.bind(null, room.id, !room.is_visible)}>
                    <button className="min-h-11 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-black text-zinc-900">
                      {room.is_visible ? "숨기기" : "보이기"}
                    </button>
                  </form>
                  <form action={deleteRoom.bind(null, room.id)}>
                    <button className="min-h-11 w-full rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-black text-red-800">
                      방 삭제
                    </button>
                  </form>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6">
                {STATUS_OPTIONS.map((status) => (
                  <form key={status} action={setRoomStatus.bind(null, room.id, status)}>
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
