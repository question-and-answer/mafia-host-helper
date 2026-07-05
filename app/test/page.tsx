"use client";

import { useState } from "react";
import { RoleGuide } from "@/components/RoleGuide";
import { generateRoomCode } from "@/lib/roomCode";
import { isSupabaseConfigured, supabase } from "@/lib/supabaseClient";

type TestPlayer = {
  id: string;
  name: string;
};

export default function TestPage() {
  const isTestPageEnabled =
    process.env.NODE_ENV !== "production" || process.env.NEXT_PUBLIC_ENABLE_TEST_PAGE === "true";
  const [roomCode, setRoomCode] = useState("");
  const [players, setPlayers] = useState<TestPlayer[]>([]);
  const [slotAIndex, setSlotAIndex] = useState(0);
  const [slotBIndex, setSlotBIndex] = useState(1);
  const [slotCIndex, setSlotCIndex] = useState(2);
  const [frameVersion, setFrameVersion] = useState(0);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isBusy, setIsBusy] = useState(false);

  const slotAPlayer = players[slotAIndex] ?? players[0] ?? null;
  const slotBPlayer = players[slotBIndex] ?? players[1] ?? players[0] ?? null;
  const slotCPlayer = players[slotCIndex] ?? players[2] ?? players[0] ?? null;

  if (!isTestPageEnabled) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-950 px-4 text-white">
        <section className="max-w-sm rounded-lg border border-zinc-700 bg-zinc-900 p-6 text-center">
          <h1 className="text-2xl font-black">테스트 페이지 비활성화</h1>
          <p className="mt-3 text-sm leading-6 text-zinc-300">
            배포 환경에서는 기본적으로 테스트 화면을 숨깁니다.
          </p>
        </section>
      </main>
    );
  }

  async function createTestRoom(playerCount: number) {
    if (!isSupabaseConfigured) {
      setError("Supabase 환경 변수를 먼저 설정해 주세요.");
      return;
    }

    setIsBusy(true);
    setError("");
    setMessage("");

    for (let attempt = 0; attempt < 8; attempt += 1) {
      const code = generateRoomCode();
      const { data: roomData, error: roomError } = await supabase.rpc("create_room_with_options", {
        p_code: code,
        p_name: `테스트 ${playerCount}명`,
        p_is_visible: false,
        p_password: null,
      });
      const room = roomData?.[0] ?? null;

      if (roomError || !room) {
        if (roomError?.message.includes("Could not find the table")) {
          setError("Supabase에 rooms 테이블이 없습니다. schema.sql을 먼저 실행해 주세요.");
          setIsBusy(false);
          return;
        }
        continue;
      }

      const testPlayers = Array.from({ length: playerCount }, (_, index) => ({
        room_id: room.id,
        name: `테스트 ${index + 1}`,
      }));

      const { data: createdPlayers, error: playersError } = await supabase
        .from("players")
        .insert(testPlayers)
        .select("id, name");

      if (playersError || !createdPlayers) {
        setError(
          `테스트 참가자 생성에 실패했습니다.${playersError?.message ? ` (${playersError.message})` : ""}`,
        );
        setIsBusy(false);
        return;
      }

      window.localStorage.setItem("mafia-host-room-id", room.id);
      setRoomCode(room.code);
      setPlayers(createdPlayers);
      setSlotAIndex(0);
      setSlotBIndex(Math.min(1, createdPlayers.length - 1));
      setSlotCIndex(Math.min(2, createdPlayers.length - 1));
      setFrameVersion((version) => version + 1);
      setMessage(`${room.code} 방에 테스트 참가자 ${playerCount}명을 만들었습니다.`);
      setIsBusy(false);
      return;
    }

    setError("테스트 방 생성에 실패했습니다. 잠시 후 다시 시도해 주세요.");
    setIsBusy(false);
  }

  function reloadFrames() {
    setFrameVersion((version) => version + 1);
  }

  function openPath(path: string) {
    window.open(path, "_blank", "noopener,noreferrer");
  }

  return (
    <main className="flex min-h-screen flex-col bg-[#220016] p-2 text-zinc-100">
      <header className="mb-2 overflow-hidden border border-zinc-500 bg-[#2b001b] shadow-2xl">
        <div className="flex h-7 items-center justify-between border-b border-zinc-500 bg-zinc-300 px-2 text-[11px] font-bold text-zinc-900">
          <span>/bin/bash - mafia-test 4-pane</span>
          <span>{roomCode ? `room:${roomCode}` : "room:none"}</span>
        </div>
        <div className="grid gap-3 p-3 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <p className="font-mono text-sm text-zinc-200">$ ./spawn-mafia-test</p>
            <p className="mt-1 text-xs text-zinc-400">
              터미널 멀티 창처럼 사회자와 여러 참가자 화면을 동시에 보면서 역할, 메모, 밤 소음을 확인합니다.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {[5, 8, 12, 20, 31].map((count) => (
              <button
                key={count}
                type="button"
                onClick={() => createTestRoom(count)}
                disabled={isBusy}
                className="h-9 border border-zinc-400 bg-[#3a0025] px-3 font-mono text-xs font-bold text-white hover:bg-[#510034] disabled:opacity-50"
              >
                {count}명
              </button>
            ))}
            <button
              type="button"
              onClick={reloadFrames}
              className="h-9 border border-zinc-400 bg-zinc-200 px-3 font-mono text-xs font-bold text-zinc-950"
            >
              reload
            </button>
            <button
              type="button"
              onClick={() => openPath("/host")}
              className="h-9 border border-zinc-400 bg-zinc-200 px-3 font-mono text-xs font-bold text-zinc-950"
            >
              host tab
            </button>
          </div>
        </div>
        {message || error ? (
          <div className="border-t border-zinc-700 px-3 py-2 font-mono text-xs">
            {message ? <p className="text-emerald-300">ok: {message}</p> : null}
            {error ? <p className="text-red-300">error: {error}</p> : null}
          </div>
        ) : null}
      </header>

      <section className="grid min-h-0 flex-1 grid-cols-1 gap-1 lg:grid-cols-3">
        <TerminalPane title="host:/host">
          <iframe
            key={`host-${frameVersion}`}
            title="host"
            src="/host"
            className="h-full w-full bg-white"
          />
        </TerminalPane>

        <TerminalPane
          title={slotAPlayer ? `player-a:/${slotAPlayer.name}` : "player-a:/empty"}
          toolbar={
            <PlayerToolbar
              players={players}
              selectedIndex={slotAIndex}
              onSelect={setSlotAIndex}
              onOpen={(player) => openPath(`/player/${player.id}`)}
            />
          }
        >
          {slotAPlayer ? (
            <iframe
              key={`player-a-${slotAPlayer.id}-${frameVersion}`}
              title="player-a"
              src={`/player/${slotAPlayer.id}`}
              className="h-full w-full bg-white"
            />
          ) : (
            <EmptyTerminal text="테스트 참가자를 먼저 생성하세요." />
          )}
        </TerminalPane>

        <TerminalPane
          title={slotBPlayer ? `player-b:/${slotBPlayer.name}` : "player-b:/empty"}
          toolbar={
            <PlayerToolbar
              players={players}
              selectedIndex={slotBIndex}
              onSelect={setSlotBIndex}
              onOpen={(player) => openPath(`/player/${player.id}`)}
            />
          }
        >
          {slotBPlayer ? (
            <iframe
              key={`player-b-${slotBPlayer.id}-${frameVersion}`}
              title="player-b"
              src={`/player/${slotBPlayer.id}`}
              className="h-full w-full bg-white"
            />
          ) : (
            <EmptyTerminal text="두 번째 플레이어 화면입니다." />
          )}
        </TerminalPane>

        <TerminalPane
          title={slotCPlayer ? `player-c:/${slotCPlayer.name}` : "player-c:/empty"}
          toolbar={
            <PlayerToolbar
              players={players}
              selectedIndex={slotCIndex}
              onSelect={setSlotCIndex}
              onOpen={(player) => openPath(`/player/${player.id}`)}
            />
          }
        >
          {slotCPlayer ? (
            <iframe
              key={`player-c-${slotCPlayer.id}-${frameVersion}`}
              title="player-c"
              src={`/player/${slotCPlayer.id}`}
              className="h-full w-full bg-white"
            />
          ) : (
            <EmptyTerminal text="세 번째 플레이어 화면입니다." />
          )}
        </TerminalPane>

        <TerminalPane title="roles.md + checklist">
          <div className="h-full overflow-auto bg-[#220016] p-4">
            <div className="mb-4 rounded border border-zinc-600 bg-[#310020] p-3 font-mono text-sm leading-7 text-zinc-200">
              <p><span className="text-zinc-500">01</span> 5/8/12/20/31명 버튼으로 테스트 방 생성</p>
              <p><span className="text-zinc-500">02</span> player-a/b/c에서 내 메모 입력 후 reload로 유지 확인</p>
              <p><span className="text-zinc-500">03</span> 각 player에서 소음 준비 버튼을 한 번씩 누름</p>
              <p><span className="text-zinc-500">04</span> host에서 역할 랜덤 배정, player는 아직 대기 화면</p>
              <p><span className="text-zinc-500">05</span> host에서 전체 역할 공개, player는 자기 역할만 확인</p>
              <p><span className="text-zinc-500">06</span> host에서 낮 시작 후 토론 타이머 확인</p>
              <p><span className="text-zinc-500">07</span> host에서 밤 시작 후 준비된 player 소음 자동 시작 확인</p>
            </div>
            <RoleGuide compact dark />
          </div>
        </TerminalPane>
      </section>
    </main>
  );
}

function TerminalPane({
  title,
  toolbar,
  children,
}: {
  title: string;
  toolbar?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <article className="flex min-h-[360px] flex-col overflow-hidden border border-zinc-500 bg-[#220016] lg:min-h-0">
      <div className="flex h-7 shrink-0 items-center justify-between border-b border-zinc-500 bg-zinc-300 px-2 text-[11px] font-bold text-zinc-950">
        <span>{title}</span>
        {toolbar ? <span>players</span> : null}
      </div>
      {toolbar ? (
        <div className="flex shrink-0 gap-1 overflow-x-auto border-b border-zinc-700 bg-[#310020] px-2 py-1">
          {toolbar}
        </div>
      ) : null}
      <div className="min-h-0 flex-1">{children}</div>
    </article>
  );
}

function PlayerToolbar({
  players,
  selectedIndex,
  onSelect,
  onOpen,
}: {
  players: TestPlayer[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  onOpen: (player: TestPlayer) => void;
}) {
  if (players.length === 0) {
    return <span className="font-mono text-xs text-zinc-400">no players</span>;
  }

  return (
    <>
      {players.map((player, index) => (
        <button
          key={player.id}
          type="button"
          onClick={() => onSelect(index)}
          className={`shrink-0 border px-2 py-1 font-mono text-[11px] font-bold ${
            selectedIndex === index
              ? "border-emerald-400 bg-emerald-950 text-emerald-100"
              : "border-zinc-700 bg-[#220016] text-zinc-300"
          }`}
        >
          {player.name}
        </button>
      ))}
      <button
        type="button"
        onClick={() => onOpen(players[selectedIndex] ?? players[0])}
        className="shrink-0 border border-zinc-400 bg-zinc-200 px-2 py-1 font-mono text-[11px] font-bold text-zinc-950"
      >
        open
      </button>
    </>
  );
}

function EmptyTerminal({ text }: { text: string }) {
  return (
    <div className="h-full bg-[#220016] p-3 font-mono text-sm text-zinc-300">
      <span className="text-zinc-500">$</span> {text}
    </div>
  );
}
