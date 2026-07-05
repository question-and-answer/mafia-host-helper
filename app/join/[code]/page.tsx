"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { normalizeRoomCode } from "@/lib/roomCode";
import { isSupabaseConfigured, supabase } from "@/lib/supabaseClient";
import type { Room } from "@/types/game";

export default function JoinPage() {
  const params = useParams<{ code: string }>();
  const router = useRouter();
  const code = normalizeRoomCode(params.code ?? "");
  const [room, setRoom] = useState<Room | null>(null);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isJoining, setIsJoining] = useState(false);

  const loadRoom = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setError("Supabase 환경 변수를 먼저 설정해 주세요.");
      setIsLoading(false);
      return;
    }

    const { data, error: loadError } = await supabase
      .from("rooms")
      .select("*")
      .eq("code", code)
      .maybeSingle();

    if (loadError || !data) {
      setError("존재하지 않는 방 코드입니다.");
      setIsLoading(false);
      return;
    }

    setRoom(data);
    setIsLoading(false);
  }, [code]);

  useEffect(() => {
    const savedPlayerId = window.localStorage.getItem(`mafia-player-${code}`);
    if (savedPlayerId) {
      router.replace(`/player/${savedPlayerId}`);
      return;
    }

    void loadRoom();
  }, [code, loadRoom, router]);

  async function joinRoom(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedName = name.trim();
    setError("");

    if (!trimmedName) {
      setError("이름을 입력해 주세요.");
      return;
    }

    if (!room) {
      setError("존재하지 않는 방 코드입니다.");
      return;
    }

    setIsJoining(true);
    const { data: duplicate } = await supabase
      .from("players")
      .select("id")
      .eq("room_id", room.id)
      .eq("name", trimmedName)
      .maybeSingle();

    if (duplicate) {
      setError("이미 같은 이름의 참가자가 있습니다.");
      setIsJoining(false);
      return;
    }

    const { data, error: joinError } = await supabase
      .from("players")
      .insert({ room_id: room.id, name: trimmedName })
      .select("id")
      .single();

    if (joinError || !data) {
      setError("입장 중 오류가 발생했습니다. 다시 시도해 주세요.");
      setIsJoining(false);
      return;
    }

    window.localStorage.setItem(`mafia-player-${code}`, data.id);
    router.replace(`/player/${data.id}`);
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-4 py-8">
      <section className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
        <Link href="/" className="text-sm font-bold text-red-700">
          처음으로
        </Link>
        <h1 className="mt-4 text-3xl font-black text-zinc-950">방 참가</h1>
        <p className="mt-2 text-zinc-600">방 코드: {code}</p>

        {isLoading ? <p className="mt-6 text-zinc-600">방을 확인하는 중입니다.</p> : null}
        {error ? <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm font-bold text-red-800">{error}</p> : null}

        {room ? (
          <form onSubmit={joinRoom} className="mt-6 space-y-3">
            <label className="block">
              <span className="text-sm font-bold text-zinc-700">이름을 입력하세요</span>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="mt-2 h-14 w-full rounded-lg border border-zinc-300 px-4 text-lg font-bold text-zinc-950 outline-none focus:border-red-500 focus:ring-2 focus:ring-red-100"
                maxLength={20}
              />
            </label>
            <button
              type="submit"
              disabled={isJoining}
              className="min-h-14 w-full rounded-lg bg-zinc-950 px-5 py-4 text-lg font-black text-white disabled:opacity-50"
            >
              입장하기
            </button>
            <p className="text-center text-sm text-zinc-500">사회자가 게임을 준비 중입니다</p>
          </form>
        ) : null}
      </section>
    </main>
  );
}
