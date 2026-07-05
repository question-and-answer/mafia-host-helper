"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DiscussionTimer } from "@/components/DiscussionTimer";
import { PlayerList } from "@/components/PlayerList";
import { RoleConfigEditor } from "@/components/RoleConfigEditor";
import { StatusBadge } from "@/components/StatusBadge";
import { expandRoles, getRecommendedRoles, getRoleTotal, getTeamForRole } from "@/lib/roles";
import { generateRoomCode } from "@/lib/roomCode";
import { shuffle } from "@/lib/shuffle";
import { isSupabaseConfigured, supabase } from "@/lib/supabaseClient";
import { formatSeconds, getRecommendedDiscussionSeconds, getRemainingSeconds } from "@/lib/timer";
import type { Player, RoleCounts, Room } from "@/types/game";

export function HostDashboard() {
  const [room, setRoom] = useState<Room | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [roleCounts, setRoleCounts] = useState<RoleCounts>({});
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const previousPlayerCountRef = useRef(0);

  const playerCount = players.length;
  const roleTotal = getRoleTotal(roleCounts);
  const joinLink = useMemo(() => {
    if (!room || typeof window === "undefined") return "";
    return `${window.location.origin}/join/${room.code}`;
  }, [room]);

  const loadRoom = useCallback(async (roomId: string) => {
    const { data, error: loadError } = await supabase
      .from("rooms")
      .select("*")
      .eq("id", roomId)
      .maybeSingle();

    if (loadError || !data) {
      window.localStorage.removeItem("mafia-host-room-id");
      return;
    }

    setRoom(data);
  }, []);

  const loadPlayers = useCallback(async (roomId: string) => {
    const { data, error: loadError } = await supabase
      .from("players")
      .select("*")
      .eq("room_id", roomId)
      .order("created_at", { ascending: true });

    if (loadError) {
      setError("참가자 목록을 불러오지 못했습니다.");
      return;
    }

    const nextPlayers = data ?? [];
    setPlayers(nextPlayers);
    if (nextPlayers.length !== previousPlayerCountRef.current) {
      previousPlayerCountRef.current = nextPlayers.length;
      setRoleCounts(getRecommendedRoles(nextPlayers.length));
    }
  }, []);

  useEffect(() => {
    const savedRoomId = window.localStorage.getItem("mafia-host-room-id");
    if (savedRoomId) {
      void loadRoom(savedRoomId);
    }
  }, [loadRoom]);

  useEffect(() => {
    if (!room?.id) return;

    const roomId = room.id;
    void loadPlayers(roomId);
    const channel = supabase
      .channel(`host-room-${roomId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "players", filter: `room_id=eq.${roomId}` },
        () => void loadPlayers(roomId),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "rooms", filter: `id=eq.${roomId}` },
        (payload) => setRoom(payload.new as Room),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [loadPlayers, room?.id]);

  async function createRoom() {
    if (!isSupabaseConfigured) {
      setError("Supabase 환경 변수를 먼저 설정해 주세요.");
      return;
    }

    setIsBusy(true);
    setError("");
    setMessage("");

    for (let attempt = 0; attempt < 8; attempt += 1) {
      const code = attempt === 0 ? `MAFIA${Math.floor(Math.random() * 90 + 10)}` : generateRoomCode();
      const { data, error: createError } = await supabase
        .from("rooms")
        .insert({ code })
        .select()
        .single();

      if (!createError && data) {
        window.localStorage.setItem("mafia-host-room-id", data.id);
        setRoom(data);
        setPlayers([]);
        setRoleCounts({});
        setMessage("방이 생성되었습니다.");
        setIsBusy(false);
        return;
      }
    }

    setError("방 코드 생성에 실패했습니다. 다시 시도해 주세요.");
    setIsBusy(false);
  }

  async function copyJoinLink() {
    if (!joinLink) return;
    await navigator.clipboard.writeText(joinLink);
    setMessage("참가 링크를 복사했습니다.");
  }

  async function assignRoles() {
    if (!room) return;
    setError("");
    setMessage("");

    if (playerCount === 0) {
      setError("아직 참가자가 없습니다.");
      return;
    }

    if (playerCount < 5) {
      setError("마피아 게임을 진행하기에는 인원이 너무 적습니다. 최소 5명 이상을 권장합니다.");
      return;
    }

    if (roleTotal !== playerCount) {
      setError("역할 수의 합이 참가자 수와 일치하지 않습니다.");
      return;
    }

    const roles = shuffle(expandRoles(roleCounts));
    if (roles.length !== playerCount) {
      setError("역할 수의 합이 참가자 수와 일치하지 않습니다.");
      return;
    }

    setIsBusy(true);
    const updates = players.map((player, index) =>
      supabase
        .from("players")
        .update({ role: roles[index], team: getTeamForRole(roles[index]), is_alive: true })
        .eq("id", player.id),
    );

    const results = await Promise.all(updates);
    const failed = results.some((result) => result.error);

    if (failed) {
      setError("역할 배정 중 오류가 발생했습니다.");
      setIsBusy(false);
      return;
    }

    await supabase
      .from("rooms")
      .update({ status: "assigned", discussion_started_at: null })
      .eq("id", room.id);
    setMessage("역할을 랜덤 배정했습니다. 아직 공개되지 않았습니다.");
    setIsBusy(false);
  }

  async function revealRoles() {
    if (!room) return;
    if (room.status !== "assigned") {
      setError("역할 배정 후 공개할 수 있습니다.");
      return;
    }

    await supabase.from("rooms").update({ status: "revealed" }).eq("id", room.id);
    setMessage("전체 역할을 공개했습니다.");
    setError("");
  }

  async function startDay() {
    if (!room) return;
    if (!["revealed", "day", "night"].includes(room.status)) {
      setError("역할 공개 후 낮을 시작할 수 있습니다.");
      return;
    }

    const seconds = getRecommendedDiscussionSeconds(playerCount);
    await supabase
      .from("rooms")
      .update({
        status: "day",
        day_number: room.status === "day" ? room.day_number : room.day_number + 1,
        discussion_seconds: seconds,
        discussion_started_at: new Date().toISOString(),
      })
      .eq("id", room.id);
    setError("");
  }

  async function startNight() {
    if (!room) return;
    if (!["revealed", "day", "night"].includes(room.status)) {
      setError("역할 공개 후 밤을 시작할 수 있습니다.");
      return;
    }

    await supabase
      .from("rooms")
      .update({ status: "night", discussion_started_at: null })
      .eq("id", room.id);
    setError("");
  }

  async function pauseTimer() {
    if (!room || room.status !== "day") return;
    const remaining = getRemainingSeconds(room.discussion_seconds, room.discussion_started_at);
    await supabase
      .from("rooms")
      .update({ discussion_seconds: remaining, discussion_started_at: null })
      .eq("id", room.id);
  }

  async function resumeTimer() {
    if (!room || room.status !== "day") return;
    await supabase
      .from("rooms")
      .update({ discussion_started_at: new Date().toISOString() })
      .eq("id", room.id);
  }

  async function addThirtySeconds() {
    if (!room || room.status !== "day") return;
    const remaining = getRemainingSeconds(room.discussion_seconds, room.discussion_started_at);
    await supabase
      .from("rooms")
      .update({
        discussion_seconds: remaining + 30,
        discussion_started_at: room.discussion_started_at ? new Date().toISOString() : null,
      })
      .eq("id", room.id);
  }

  async function endDiscussion() {
    if (!room) return;
    await supabase
      .from("rooms")
      .update({ discussion_seconds: 0, discussion_started_at: null })
      .eq("id", room.id);
  }

  async function resetGame() {
    if (!room) return;
    const confirmed = window.confirm("정말 게임을 초기화할까요? 역할 정보가 모두 삭제됩니다.");
    if (!confirmed) return;

    setIsBusy(true);
    await supabase
      .from("players")
      .update({ role: null, team: null, is_alive: true })
      .eq("room_id", room.id);
    await supabase
      .from("rooms")
      .update({
        status: "waiting",
        day_number: 0,
        discussion_seconds: 300,
        discussion_started_at: null,
      })
      .eq("id", room.id);
    setMessage("게임을 초기화했습니다.");
    setError("");
    setIsBusy(false);
  }

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-5 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-4 rounded-lg bg-zinc-950 p-5 text-white shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-bold text-red-300">마피아 사회자 도우미</p>
          <h1 className="mt-1 text-2xl font-black">호스트 대시보드</h1>
        </div>
        {room ? <StatusBadge status={room.status} /> : null}
      </header>

      {error ? <Alert tone="error">{error}</Alert> : null}
      {message ? <Alert tone="success">{message}</Alert> : null}

      {!room ? (
        <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
          <h2 className="text-xl font-black text-zinc-950">방 만들기</h2>
          <p className="mt-2 text-zinc-600">참가자에게 공유할 방 코드와 링크를 생성합니다.</p>
          <button
            type="button"
            onClick={createRoom}
            disabled={isBusy}
            className="mt-5 min-h-14 w-full rounded-lg bg-red-700 px-5 py-4 text-lg font-black text-white disabled:opacity-50 sm:w-auto"
          >
            방 생성하기
          </button>
        </section>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
          <section className="space-y-6">
            <Panel title="방 코드">
              <p className="text-5xl font-black tracking-normal text-zinc-950">{room.code}</p>
            </Panel>

            <Panel title="참가 링크">
              <div className="space-y-3">
                <input
                  readOnly
                  value={joinLink}
                  className="h-12 w-full rounded-lg border border-zinc-300 bg-zinc-50 px-3 text-sm text-zinc-700"
                />
                <button
                  type="button"
                  onClick={copyJoinLink}
                  className="min-h-12 w-full rounded-lg bg-zinc-950 px-4 py-3 font-black text-white"
                >
                  참가 링크 복사
                </button>
              </div>
            </Panel>

            <Panel title={`현재 참가자 수: ${playerCount}명`}>
              <PlayerList players={players} showRoles={room.status !== "waiting"} />
            </Panel>
          </section>

          <section className="space-y-6">
            <Panel title="추천 역할 구성">
              {playerCount < 5 ? (
                <Alert tone="error">
                  마피아 게임을 진행하기에는 인원이 너무 적습니다. 최소 5명 이상을 권장합니다.
                </Alert>
              ) : (
                <RoleConfigEditor
                  roleCounts={roleCounts}
                  playerCount={playerCount}
                  onChange={setRoleCounts}
                />
              )}
            </Panel>

            <Panel title="게임 진행">
              <div className="grid gap-3 sm:grid-cols-2">
                <ActionButton onClick={assignRoles} disabled={isBusy || playerCount < 5}>
                  역할 랜덤 배정
                </ActionButton>
                <ActionButton onClick={revealRoles} disabled={isBusy || room.status !== "assigned"}>
                  전체 역할 공개
                </ActionButton>
                <ActionButton onClick={startDay} disabled={isBusy}>
                  낮 시작
                </ActionButton>
                <ActionButton onClick={startNight} disabled={isBusy}>
                  밤 시작
                </ActionButton>
              </div>
              <button
                type="button"
                onClick={resetGame}
                disabled={isBusy}
                className="mt-3 min-h-12 w-full rounded-lg border border-red-200 bg-red-50 px-4 py-3 font-black text-red-800 disabled:opacity-50"
              >
                게임 초기화
              </button>
            </Panel>

            {room.status === "day" ? (
              <Panel title={`낮 ${room.day_number}일차`}>
                <DiscussionTimer
                  seconds={room.discussion_seconds}
                  startedAt={room.discussion_started_at}
                />
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <ActionButton onClick={pauseTimer}>일시정지</ActionButton>
                  <ActionButton onClick={resumeTimer}>다시 시작</ActionButton>
                  <ActionButton onClick={addThirtySeconds}>30초 추가</ActionButton>
                  <ActionButton onClick={endDiscussion}>토론 종료</ActionButton>
                </div>
              </Panel>
            ) : (
              <Panel title="토론 타이머">
                <p className="text-zinc-600">
                  낮 시작 시 권장 토론 시간이 자동 설정됩니다. 현재 권장 시간은{" "}
                  <strong>{formatSeconds(getRecommendedDiscussionSeconds(playerCount))}</strong>입니다.
                </p>
              </Panel>
            )}
          </section>
        </div>
      )}
    </main>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
      <h2 className="mb-4 text-lg font-black text-zinc-950">{title}</h2>
      {children}
    </section>
  );
}

function ActionButton({
  children,
  disabled,
  onClick,
}: {
  children: React.ReactNode;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="min-h-12 rounded-lg bg-zinc-950 px-4 py-3 font-black text-white shadow-sm disabled:cursor-not-allowed disabled:bg-zinc-300 disabled:text-zinc-500"
    >
      {children}
    </button>
  );
}

function Alert({ children, tone }: { children: React.ReactNode; tone: "error" | "success" }) {
  return (
    <div
      className={`rounded-lg border p-4 text-sm font-bold ${
        tone === "error"
          ? "border-red-200 bg-red-50 text-red-900"
          : "border-emerald-200 bg-emerald-50 text-emerald-900"
      }`}
    >
      {children}
    </div>
  );
}
