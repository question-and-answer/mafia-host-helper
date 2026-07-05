"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { RoleGuide } from "@/components/RoleGuide";
import { normalizeRoomCode } from "@/lib/roomCode";
import { isSupabaseConfigured, supabase } from "@/lib/supabaseClient";
import type { PublicRoom } from "@/types/game";

export default function Home() {
  const router = useRouter();
  const [roomCode, setRoomCode] = useState("");
  const [publicRooms, setPublicRooms] = useState<PublicRoom[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    void loadPublicRooms();
  }, []);

  async function loadPublicRooms() {
    if (!isSupabaseConfigured) return;

    const { data } = await supabase.rpc("list_visible_rooms");
    setPublicRooms(data ?? []);
  }

  const joinRoom = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const code = normalizeRoomCode(roomCode);

    if (!code) {
      setError("방 코드를 입력해 주세요.");
      return;
    }

    router.push(`/join/${code}`);
  };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col px-4 py-8">
      <section className="rounded-lg bg-zinc-950 p-6 text-white shadow-sm sm:p-8">
        <p className="text-sm font-bold text-red-300">오프라인 마피아 진행용</p>
        <h1 className="mt-3 text-4xl font-black tracking-normal sm:text-5xl">
          마피아 사회자 도우미
        </h1>
        <p className="mt-4 text-lg leading-8 text-zinc-200">
          역할 배정, 낮/밤 진행, 토론 타이머, 백색소음까지 한 번에 관리하세요.
        </p>
        <Link
          href="/host"
          className="mt-8 flex min-h-14 w-full items-center justify-center rounded-lg bg-red-700 px-5 py-4 text-lg font-black text-white shadow-sm"
        >
          사회자로 시작하기
        </Link>
      </section>

      <section className="mt-5 rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="text-xl font-black text-zinc-950">방 코드로 참가하기</h2>
        <form onSubmit={joinRoom} className="mt-4 space-y-3">
          <input
            value={roomCode}
            onChange={(event) => setRoomCode(event.target.value)}
            placeholder="예: MAFIA31"
            className="h-14 w-full rounded-lg border border-zinc-300 px-4 text-lg font-bold uppercase text-zinc-950 outline-none focus:border-red-500 focus:ring-2 focus:ring-red-100"
          />
          {error ? <p className="text-sm font-bold text-red-700">{error}</p> : null}
          <button
            type="submit"
            className="min-h-14 w-full rounded-lg bg-zinc-950 px-5 py-4 text-lg font-black text-white"
          >
            방 코드로 참가하기
          </button>
        </form>
      </section>

      <section className="mt-5 rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xl font-black text-zinc-950">공개 방</h2>
          <button
            type="button"
            onClick={loadPublicRooms}
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-black text-zinc-800"
          >
            새로고침
          </button>
        </div>
        <div className="mt-4 space-y-3">
          {publicRooms.length === 0 ? (
            <p className="rounded-lg border border-dashed border-zinc-300 p-4 text-center text-sm text-zinc-500">
              지금 보이는 공개 방이 없습니다.
            </p>
          ) : null}
          {publicRooms.map((room) => (
            <Link
              key={room.id}
              href={`/join/${room.code}`}
              className="block rounded-lg border border-zinc-200 p-4 active:bg-zinc-50"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-black text-zinc-950">{room.name}</h3>
                  <p className="mt-1 font-mono text-sm font-bold text-zinc-500">{room.code}</p>
                </div>
                <span className="shrink-0 rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-bold text-zinc-700">
                  {room.has_password ? "비밀번호" : "무비번"}
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="mt-5 rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-xl font-black text-zinc-950">역할 설명</h2>
        <RoleGuide />
      </section>
    </main>
  );
}
