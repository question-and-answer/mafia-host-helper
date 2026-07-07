"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { DiscussionTimer } from "@/components/DiscussionTimer";
import { PersonalNotes } from "@/components/PersonalNotes";
import { RoleGuide } from "@/components/RoleGuide";
import { RoleCard } from "@/components/RoleCard";
import { StatusBadge } from "@/components/StatusBadge";
import { WhiteNoisePlayer } from "@/components/WhiteNoisePlayer";
import { isSupabaseConfigured, supabase } from "@/lib/supabaseClient";
import type { Player, Room } from "@/types/game";

export default function PlayerPage() {
  const params = useParams<{ playerId: string }>();
  const router = useRouter();
  const playerId = params.playerId;
  const [player, setPlayer] = useState<Player | null>(null);
  const [room, setRoom] = useState<Room | null>(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const loadRoomState = useCallback(async (roomId: string) => {
    const { data, error: roomError } = await supabase.rpc("get_room_state", {
      p_room_id: roomId,
    });
    const ownRoom = data?.[0] ?? null;

    if (roomError || !ownRoom) {
      setError("방 정보를 찾을 수 없습니다.");
      return;
    }

    setRoom(ownRoom);
  }, []);

  const loadPlayerAndRoom = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setError("Supabase 환경 변수를 먼저 설정해 주세요.");
      setIsLoading(false);
      return;
    }

    const { data: ownPlayer, error: playerError } = await supabase
      .from("players")
      .select("id, room_id, name, role, team, private_info, is_alive, created_at")
      .eq("id", playerId)
      .maybeSingle();

    if (playerError || !ownPlayer) {
      setError("참가자 정보를 찾을 수 없습니다.");
      setIsLoading(false);
      return;
    }

    setPlayer(ownPlayer);

    await loadRoomState(ownPlayer.room_id);
    setIsLoading(false);
  }, [loadRoomState, playerId]);

  useEffect(() => {
    void loadPlayerAndRoom();
  }, [loadPlayerAndRoom]);

  useEffect(() => {
    if (!player?.room_id) return;

    const playerRowId = player.id;
    const roomId = player.room_id;
    const channel = supabase
      .channel(`player-${playerRowId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "players", filter: `id=eq.${playerRowId}` },
        (payload) => setPlayer(payload.new as Player),
      )
      .subscribe();
    const roomPollId = window.setInterval(() => void loadRoomState(roomId), 2000);

    return () => {
      window.clearInterval(roomPollId);
      void supabase.removeChannel(channel);
    };
  }, [loadRoomState, player?.id, player?.room_id]);

  async function leaveRoom() {
    if (!player || !room) return;
    const confirmed = window.confirm("방에서 나갈까요? 다시 참가하려면 이름을 다시 입력해야 합니다.");
    if (!confirmed) return;

    const { error: leaveError } = await supabase
      .from("players")
      .delete()
      .eq("id", player.id)
      .eq("room_id", room.id);

    if (leaveError) {
      setError("방에서 나가지 못했습니다. 다시 시도해 주세요.");
      return;
    }

    window.localStorage.removeItem(`mafia-player-${room.code}`);
    router.replace(`/join/${room.code}`);
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col px-4 py-5">
      <header className="rounded-lg bg-zinc-950 p-5 text-white shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-bold text-red-300">마피아 사회자 도우미</p>
            <h1 className="mt-1 text-2xl font-black">{player?.name ?? "참가자"}</h1>
          </div>
          {room ? <StatusBadge status={room.status} /> : null}
        </div>
        {player && room ? (
          <button
            type="button"
            onClick={leaveRoom}
            className="mt-4 min-h-11 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm font-black text-white"
          >
            방 나가기
          </button>
        ) : null}
      </header>

      <section className="mt-5 flex-1 space-y-5">
        {isLoading ? <InfoCard text="정보를 불러오는 중입니다." /> : null}
        {error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-5 text-red-900">
            <p className="font-bold">{error}</p>
            <Link href="/" className="mt-4 inline-block font-black text-red-700">
              처음으로
            </Link>
          </div>
        ) : null}

        {player && room ? (
          <>
            <PersonalNotes storageKey={`mafia-notes-${player.id}`} />

            {room.status !== "night" ? (
              <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-5 shadow-sm">
                <WhiteNoisePlayer
                  title="밤 소음 준비"
                  helperText="밤이 되기 전 한 번 눌러두면, 사회자가 밤을 시작할 때 자동 재생을 시도합니다."
                  armStorageKey={`mafia-noise-armed-${player.id}`}
                />
              </div>
            ) : null}

            {["waiting", "assigned"].includes(room.status) ? (
              <>
                <InfoCard text="사회자가 역할을 공개할 때까지 기다려 주세요." />
                <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
                  <h2 className="mb-4 text-lg font-black text-zinc-950">시작 전 역할 설명</h2>
                  <RoleGuide compact />
                </div>
              </>
            ) : null}

            {["revealed", "day", "night", "voting"].includes(room.status) && player.role ? (
              <RoleCard role={player.role} privateInfo={player.private_info} />
            ) : null}

            {room.status === "day" ? (
              <div className="space-y-3">
                <InfoCard text="낮이 되었습니다" />
                <DiscussionTimer
                  seconds={room.discussion_seconds}
                  startedAt={room.discussion_started_at}
                  label="남은 토론 시간"
                />
              </div>
            ) : null}

            {room.status === "night" ? (
              <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-5 shadow-sm">
                <h2 className="text-2xl font-black text-indigo-950">밤이 되었습니다.</h2>
                <p className="mt-2 leading-7 text-indigo-900">
                  사플 방지를 위해 백색소음을 재생해 주세요.
                </p>
                <div className="mt-5">
                  <WhiteNoisePlayer
                    title="사플 방지 소음"
                    helperText="준비된 휴대폰은 밤 시작과 함께 자동 재생을 시도합니다. 안 들리면 재생을 눌러 주세요."
                    armStorageKey={`mafia-noise-armed-${player.id}`}
                    autoStartKey={`night-${room.id}-${room.day_number}`}
                  />
                </div>
              </div>
            ) : null}
          </>
        ) : null}
      </section>
    </main>
  );
}

function InfoCard({ text }: { text: string }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-5 text-center shadow-sm">
      <p className="text-lg font-black text-zinc-950">{text}</p>
    </div>
  );
}
