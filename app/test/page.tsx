"use client";

import { useEffect, useMemo, useState } from "react";
import { RoleGuide } from "@/components/RoleGuide";
import { generateRoomCode } from "@/lib/roomCode";
import { isSupabaseConfigured, supabase } from "@/lib/supabaseClient";

type TestPlayer = {
  id: string;
  name: string;
};

const DEFAULT_TILE_COUNT = 16;
const DEFAULT_COLUMNS = 8;

export default function TestPage() {
  const isTestPageEnabled =
    process.env.NODE_ENV !== "production" ||
    process.env.NEXT_PUBLIC_ENABLE_TEST_PAGE === "true" ||
    (typeof window !== "undefined" && window.location.pathname === "/test/this_is_password");
  const [roomCode, setRoomCode] = useState("");
  const [players, setPlayers] = useState<TestPlayer[]>([]);
  const [tileCount, setTileCount] = useState(DEFAULT_TILE_COUNT);
  const [columns, setColumns] = useState(DEFAULT_COLUMNS);
  const [labHeight, setLabHeight] = useState(820);
  const [focusedPane, setFocusedPane] = useState(0);
  const [playerPaneIndexes, setPlayerPaneIndexes] = useState<number[]>(
    Array.from({ length: DEFAULT_TILE_COUNT - 2 }, (_, index) => index),
  );
  const [frameVersion, setFrameVersion] = useState(0);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isBusy, setIsBusy] = useState(false);

  const playerPaneCount = Math.max(tileCount - 2, 1);
  const rows = Math.max(Math.ceil(tileCount / columns), 1);
  const visiblePlayerPaneIndexes = useMemo(
    () =>
      Array.from(
        { length: playerPaneCount },
        (_, index) => playerPaneIndexes[index] ?? index,
      ),
    [playerPaneCount, playerPaneIndexes],
  );

  useEffect(() => {
    setPlayerPaneIndexes((current) =>
      Array.from({ length: playerPaneCount }, (_, index) => current[index] ?? index),
    );
  }, [playerPaneCount]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const isTyping =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable;
      if (isTyping) return;

      const canSwitchPlayer = focusedPane > 0 && focusedPane <= playerPaneCount;
      if ((event.key === "ArrowRight" || event.key.toLowerCase() === "d") && canSwitchPlayer) {
        event.preventDefault();
        switchPlayer(focusedPane - 1, 1);
      }
      if ((event.key === "ArrowLeft" || event.key.toLowerCase() === "a") && canSwitchPlayer) {
        event.preventDefault();
        switchPlayer(focusedPane - 1, -1);
      }
      if (event.key >= "1" && event.key <= "9") {
        event.preventDefault();
        setFocusedPane(Math.min(Number(event.key) - 1, tileCount - 1));
      }
      if (event.key.toLowerCase() === "r") {
        event.preventDefault();
        reloadFrames();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

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
      setPlayerPaneIndexes(Array.from({ length: playerPaneCount }, (_, index) => index));
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

  function switchPlayer(paneIndex: number, direction: number) {
    if (players.length === 0) return;
    setPlayerPaneIndexes((current) => {
      const next = [...current];
      const currentIndex = next[paneIndex] ?? paneIndex;
      next[paneIndex] = (currentIndex + direction + players.length) % players.length;
      return next;
    });
  }

  function setPlayerForPane(paneIndex: number, playerIndex: number) {
    setFocusedPane(paneIndex + 1);
    setPlayerPaneIndexes((current) => {
      const next = [...current];
      next[paneIndex] = playerIndex;
      return next;
    });
  }

  function updateTileCount(nextTileCount: number) {
    setTileCount(nextTileCount);
    setColumns((current) => Math.min(current, nextTileCount));
  }

  return (
    <main className="flex min-h-screen flex-col bg-[#220016] p-2 text-zinc-100">
      <header className="mb-2 overflow-hidden border border-zinc-500 bg-[#2b001b] shadow-2xl">
        <div className="flex h-7 items-center justify-between border-b border-zinc-500 bg-zinc-300 px-2 text-[11px] font-bold text-zinc-900">
          <span>/bin/bash - mafia-test tiled-lab</span>
          <span>{roomCode ? `room:${roomCode}` : "room:none"}</span>
        </div>

        <div className="grid gap-3 p-3 xl:grid-cols-[1fr_auto] xl:items-end">
          <div>
            <p className="font-mono text-sm text-zinc-200">$ ./spawn-mafia-test --layout 2x8</p>
            <p className="mt-1 text-xs text-zinc-400">
              기본은 2x8 같은 크기 타일입니다. player 타일을 클릭하고 ←/→ 또는 A/D로 참가자를 바꿀 수 있습니다.
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              단축키: 1-9 타일 포커스, ←/→ 참가자 전환, R 새로고침
            </p>
          </div>

          <div className="flex flex-wrap items-end gap-2">
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

        <div className="grid gap-3 border-t border-zinc-700 p-3 text-xs md:grid-cols-3">
          <label className="font-mono text-zinc-300">
            tiles {tileCount}
            <input
              type="range"
              min="4"
              max="24"
              step="1"
              value={tileCount}
              onChange={(event) => updateTileCount(Number(event.target.value))}
              className="mt-1 w-full"
            />
          </label>
          <label className="font-mono text-zinc-300">
            columns {columns}
            <input
              type="range"
              min="2"
              max={Math.min(10, tileCount)}
              step="1"
              value={columns}
              onChange={(event) => setColumns(Number(event.target.value))}
              className="mt-1 w-full"
            />
          </label>
          <label className="font-mono text-zinc-300">
            height {labHeight}px
            <input
              type="range"
              min="520"
              max="1400"
              step="20"
              value={labHeight}
              onChange={(event) => setLabHeight(Number(event.target.value))}
              className="mt-1 w-full"
            />
          </label>
        </div>

        {message || error ? (
          <div className="border-t border-zinc-700 px-3 py-2 font-mono text-xs">
            {message ? <p className="text-emerald-300">ok: {message}</p> : null}
            {error ? <p className="text-red-300">error: {error}</p> : null}
          </div>
        ) : null}
      </header>

      <section
        className="grid min-w-full shrink-0 gap-1 overflow-auto"
        style={{
          height: labHeight,
          maxHeight: labHeight,
          minWidth: `${columns * 250}px`,
          gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`,
        }}
      >
        <TerminalPane
          title="0 host:/host"
          focused={focusedPane === 0}
          onFocus={() => setFocusedPane(0)}
        >
          <iframe
            key={`host-${frameVersion}`}
            title="host"
            src="/host"
            className="h-full w-full bg-white"
          />
        </TerminalPane>

        {visiblePlayerPaneIndexes.map((playerIndex, paneIndex) => {
          const player = players[playerIndex % Math.max(players.length, 1)] ?? null;
          const tileNumber = paneIndex + 1;

          return (
            <TerminalPane
              key={`pane-${paneIndex}`}
              title={player ? `${tileNumber} player:/${player.name}` : `${tileNumber} player:/empty`}
              focused={focusedPane === tileNumber}
              onFocus={() => setFocusedPane(tileNumber)}
              toolbar={
                <PlayerToolbar
                  players={players}
                  selectedIndex={playerIndex}
                  onSelect={(index) => setPlayerForPane(paneIndex, index)}
                  onOpen={(nextPlayer) => openPath(`/player/${nextPlayer.id}`)}
                  onPrev={() => switchPlayer(paneIndex, -1)}
                  onNext={() => switchPlayer(paneIndex, 1)}
                />
              }
            >
              {player ? (
                <iframe
                  key={`player-${paneIndex}-${player.id}-${frameVersion}`}
                  title={`player-${paneIndex}`}
                  src={`/player/${player.id}`}
                  className="h-full w-full bg-white"
                />
              ) : (
                <EmptyTerminal text="테스트 참가자를 먼저 생성하세요." />
              )}
            </TerminalPane>
          );
        })}

        <TerminalPane
          title={`${tileCount - 1} roles.md + checklist`}
          focused={focusedPane === tileCount - 1}
          onFocus={() => setFocusedPane(tileCount - 1)}
        >
          <div className="h-full overflow-auto bg-[#220016] p-4">
            <div className="mb-4 rounded border border-zinc-600 bg-[#310020] p-3 font-mono text-sm leading-7 text-zinc-200">
              <p><span className="text-zinc-500">01</span> 5/8/12/20/31명 버튼으로 테스트 방 생성</p>
              <p><span className="text-zinc-500">02</span> tiles/columns/height로 레이아웃 조절</p>
              <p><span className="text-zinc-500">03</span> player 타일 클릭 후 ←/→ 또는 A/D로 참가자 전환</p>
              <p><span className="text-zinc-500">04</span> 각 player에서 내 메모 입력 후 reload로 유지 확인</p>
              <p><span className="text-zinc-500">05</span> 각 player에서 소음 준비 버튼을 한 번씩 누름</p>
              <p><span className="text-zinc-500">06</span> host에서 역할 배정/공개/낮/밤 흐름 확인</p>
              <p><span className="text-zinc-500">07</span> 밤 시작 후 준비된 player 소음 자동 시작 확인</p>
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
  focused,
  onFocus,
  children,
}: {
  title: string;
  toolbar?: React.ReactNode;
  focused: boolean;
  onFocus: () => void;
  children: React.ReactNode;
}) {
  return (
    <article
      onPointerDown={onFocus}
      className={`flex min-h-0 flex-col overflow-hidden border bg-[#220016] ${
        focused ? "border-emerald-400 ring-2 ring-emerald-500" : "border-zinc-500"
      }`}
    >
      <div className="flex h-7 shrink-0 items-center justify-between gap-2 border-b border-zinc-500 bg-zinc-300 px-2 text-[11px] font-bold text-zinc-950">
        <span className="truncate">{title}</span>
        {toolbar ? <span className="shrink-0">players</span> : null}
      </div>
      {toolbar ? (
        <div className="flex h-10 shrink-0 gap-1 overflow-x-auto border-b border-zinc-700 bg-[#310020] px-2 py-1">
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
  onPrev,
  onNext,
}: {
  players: TestPlayer[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  onOpen: (player: TestPlayer) => void;
  onPrev: () => void;
  onNext: () => void;
}) {
  if (players.length === 0) {
    return <span className="font-mono text-xs text-zinc-400">no players</span>;
  }

  const selectedPlayer = players[selectedIndex % players.length] ?? players[0];

  return (
    <>
      <button
        type="button"
        onClick={onPrev}
        className="shrink-0 border border-zinc-500 bg-[#220016] px-2 font-mono text-[11px] font-bold text-white"
      >
        ←
      </button>
      {players.map((player, index) => (
        <button
          key={player.id}
          type="button"
          onClick={() => onSelect(index)}
          className={`shrink-0 border px-2 font-mono text-[11px] font-bold ${
            selectedPlayer.id === player.id
              ? "border-emerald-400 bg-emerald-950 text-emerald-100"
              : "border-zinc-700 bg-[#220016] text-zinc-300"
          }`}
        >
          {player.name}
        </button>
      ))}
      <button
        type="button"
        onClick={onNext}
        className="shrink-0 border border-zinc-500 bg-[#220016] px-2 font-mono text-[11px] font-bold text-white"
      >
        →
      </button>
      <button
        type="button"
        onClick={() => onOpen(selectedPlayer)}
        className="shrink-0 border border-zinc-400 bg-zinc-200 px-2 font-mono text-[11px] font-bold text-zinc-950"
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
