"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { normalizeRoomCode } from "@/lib/roomCode";

export default function Home() {
  const router = useRouter();
  const [roomCode, setRoomCode] = useState("");
  const [error, setError] = useState("");

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
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col justify-center px-4 py-8">
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
    </main>
  );
}
