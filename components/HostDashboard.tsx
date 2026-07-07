"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DiscussionTimer } from "@/components/DiscussionTimer";
import { PlayerList } from "@/components/PlayerList";
import { RoleConfigEditor } from "@/components/RoleConfigEditor";
import { RoleGuide } from "@/components/RoleGuide";
import { StatusBadge } from "@/components/StatusBadge";
import { WhiteNoisePlayer } from "@/components/WhiteNoisePlayer";
import { ROLE_ORDER, expandRoles, getRecommendedRoles, getRoleTotal, getTeamForRole } from "@/lib/roles";
import { generateRoomCode, normalizeRoomCode } from "@/lib/roomCode";
import { shuffle } from "@/lib/shuffle";
import { isSupabaseConfigured, supabase } from "@/lib/supabaseClient";
import { formatSeconds, getRecommendedDiscussionSeconds, getRemainingSeconds } from "@/lib/timer";
import type { Player, RoleCounts, Room } from "@/types/game";

export function HostDashboard() {
  const [room, setRoom] = useState<Room | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [roleCounts, setRoleCounts] = useState<RoleCounts>({});
  const [manualRoles, setManualRoles] = useState<Record<string, string>>({});
  const [loverAId, setLoverAId] = useState("");
  const [loverBId, setLoverBId] = useState("");
  const [recoverCode, setRecoverCode] = useState("");
  const [roomName, setRoomName] = useState("마피아 게임방");
  const [isVisible, setIsVisible] = useState(true);
  const [usePassword, setUsePassword] = useState(false);
  const [roomPassword, setRoomPassword] = useState("");
  const [settingsPassword, setSettingsPassword] = useState("");
  const [settingsDirty, setSettingsDirty] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const previousPlayerCountRef = useRef(0);

  const playerCount = players.length;
  const roleTotal = getRoleTotal(roleCounts);
  const manualRoleStats = useMemo(() => {
    const manualCounts: RoleCounts = {};
    Object.values(manualRoles).forEach((role) => {
      if (!role) return;
      manualCounts[role] = (manualCounts[role] ?? 0) + 1;
    });

    const remainingCounts = Object.fromEntries(
      Object.entries(roleCounts).map(([role, count]) => [
        role,
        Math.max(Number(count || 0) - Number(manualCounts[role] || 0), 0),
      ]),
    ) as RoleCounts;
    const overAssignedRoles = Object.entries(manualCounts)
      .filter(([role, count]) => count > Number(roleCounts[role] || 0))
      .map(([role]) => role);

    return {
      manualCounts,
      manualTotal: getRoleTotal(manualCounts),
      remainingCounts,
      overAssignedRoles,
    };
  }, [manualRoles, roleCounts]);
  const joinLink = useMemo(() => {
    if (!room || typeof window === "undefined") return "";
    return `${window.location.origin}/join/${room.code}`;
  }, [room]);

  function firstRpcRow<T>(data: T[] | T | null): T | null {
    if (!data) return null;
    return Array.isArray(data) ? data[0] ?? null : data;
  }

  useEffect(() => {
    if (!room) return;
    if (settingsDirty) return;
    setRoomName(room.name);
    setIsVisible(room.is_visible);
    setUsePassword(room.has_password);
    setSettingsPassword("");
  }, [room, settingsDirty]);

  const loadRoom = useCallback(async (roomId: string) => {
    const { data, error: loadError } = await supabase.rpc("get_host_room", {
      p_room_id: roomId,
    });
    const loadedRoom = firstRpcRow(data);

    if (loadError || !loadedRoom) {
      window.localStorage.removeItem("mafia-host-room-id");
      return;
    }

    setRoom(loadedRoom);
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
      .subscribe();
    const roomPollId = window.setInterval(() => void loadRoom(roomId), 2000);

    return () => {
      window.clearInterval(roomPollId);
      void supabase.removeChannel(channel);
    };
  }, [loadPlayers, loadRoom, room?.id]);

  async function createRoom() {
    if (!isSupabaseConfigured) {
      setError("Supabase 환경 변수를 먼저 설정해 주세요.");
      return;
    }

    setIsBusy(true);
    setError("");
    setMessage("");
    let lastCreateError = "";

    if (usePassword && !roomPassword.trim()) {
      setError("비밀번호 사용을 켰다면 방 비밀번호를 입력해 주세요.");
      setIsBusy(false);
      return;
    }

    for (let attempt = 0; attempt < 8; attempt += 1) {
      const code = attempt === 0 ? `MAFIA${Math.floor(Math.random() * 90 + 10)}` : generateRoomCode();
      const { data, error: createError } = await supabase.rpc("create_room_with_options", {
        p_code: code,
        p_name: roomName,
        p_is_visible: isVisible,
        p_password: usePassword ? roomPassword : null,
      });

      const createdRoom = firstRpcRow(data);

      if (!createError && createdRoom) {
        window.localStorage.setItem("mafia-host-room-id", createdRoom.id);
        setRoom(createdRoom);
        setPlayers([]);
        setRoleCounts({});
        setMessage("방이 생성되었습니다.");
        setIsBusy(false);
        return;
      }

      lastCreateError = createError?.message ?? "";
    }

    if (lastCreateError.includes("Could not find the table")) {
      setError("Supabase에 rooms 테이블이 없습니다. supabase/schema.sql을 먼저 실행해 주세요.");
    } else if (lastCreateError.includes("row-level security")) {
      setError("Supabase RLS 정책 때문에 방을 만들 수 없습니다. MVP용 정책을 확인해 주세요.");
    } else {
      setError(`방 코드 생성에 실패했습니다.${lastCreateError ? ` (${lastCreateError})` : ""}`);
    }
    setIsBusy(false);
  }

  async function saveRoomSettings() {
    if (!room) return;
    if (!roomName.trim()) {
      setError("방 이름을 입력해 주세요.");
      return;
    }

    if (usePassword && !room.has_password && !settingsPassword.trim()) {
      setError("비밀번호 사용을 켰다면 방 비밀번호를 입력해 주세요.");
      return;
    }

    setIsBusy(true);
    const { data, error: settingsError } = await supabase.rpc("update_room_options", {
      p_room_id: room.id,
      p_name: roomName,
      p_is_visible: isVisible,
      p_password: usePassword ? settingsPassword || null : null,
      p_clear_password: !usePassword,
    });

    const updatedRoom = firstRpcRow(data);

    if (settingsError || !updatedRoom) {
      setError("방 설정을 저장하지 못했습니다. schema.sql이 최신인지 확인해 주세요.");
      setIsBusy(false);
      return;
    }

    setRoom(updatedRoom);
    setSettingsPassword("");
    setSettingsDirty(false);
    setMessage("방 설정을 저장했습니다.");
    setError("");
    setIsBusy(false);
  }

  async function recoverRoom(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const code = normalizeRoomCode(recoverCode);

    if (!code) {
      setError("불러올 방 코드를 입력해 주세요.");
      return;
    }

    const { data: entryData, error: entryError } = await supabase.rpc("get_room_entry", {
      p_code: code,
    });
    const roomEntry = firstRpcRow(entryData);

    if (entryError || !roomEntry) {
      setError("존재하지 않는 방 코드입니다.");
      return;
    }

    const { data: hostRoomData, error: hostRoomError } = await supabase.rpc("get_host_room", {
      p_room_id: roomEntry.id,
    });
    const hostRoom = firstRpcRow(hostRoomData);

    if (hostRoomError || !hostRoom) {
      setError("방을 불러오지 못했습니다.");
      return;
    }

    window.localStorage.setItem("mafia-host-room-id", hostRoom.id);
    setRoom(hostRoom);
    setRecoverCode("");
    setError("");
    setMessage(`${hostRoom.code} 방을 불러왔습니다.`);
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

    if (manualRoleStats.overAssignedRoles.length > 0) {
      setError(`수동 지정이 역할 수보다 많습니다: ${manualRoleStats.overAssignedRoles.join(", ")}`);
      return;
    }

    const fixedPlayers = players.filter((player) => Boolean(manualRoles[player.id]));
    const randomPlayers = players.filter((player) => !manualRoles[player.id]);
    const roles = shuffle(expandRoles(manualRoleStats.remainingCounts));
    if (roles.length !== randomPlayers.length) {
      setError("역할 수의 합이 참가자 수와 일치하지 않습니다.");
      return;
    }

    setIsBusy(true);
    const results = await Promise.all(
      [
        ...fixedPlayers.map((player) => {
          const role = manualRoles[player.id];
          return supabase
            .from("players")
            .update({ role, team: getTeamForRole(role), private_info: null, is_alive: true })
            .eq("id", player.id);
        }),
        ...randomPlayers.map((player, index) =>
          supabase
            .from("players")
            .update({ role: roles[index], team: getTeamForRole(roles[index]), private_info: null, is_alive: true })
            .eq("id", player.id),
        ),
      ],
    );

    if (results.some((result) => result.error)) {
      setError("역할 배정 중 오류가 발생했습니다.");
      setIsBusy(false);
      return;
    }

    await supabase
      .from("rooms")
      .update({ status: "assigned", discussion_started_at: null })
      .eq("id", room.id);
    setMessage(
      manualRoleStats.manualTotal > 0
        ? `수동 지정 ${manualRoleStats.manualTotal}명, 나머지 ${randomPlayers.length}명을 랜덤 배정했습니다. 아직 공개되지 않았습니다.`
        : "역할을 랜덤 배정했습니다. 아직 공개되지 않았습니다.",
    );
    setIsBusy(false);
  }

  async function revealRoles() {
    if (!room) return;
    if (room.status !== "assigned") {
      setError("역할 배정 후 공개할 수 있습니다.");
      return;
    }

    const confirmed = window.confirm("전체 역할을 공개할까요? 모든 참가자가 자기 역할을 볼 수 있습니다.");
    if (!confirmed) return;

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

  async function renamePlayer(player: Player) {
    if (!room) return;
    const nextName = window.prompt("새 이름을 입력하세요.", player.name)?.trim();
    if (!nextName || nextName === player.name) return;

    const duplicate = players.some(
      (item) => item.id !== player.id && item.name.trim().toLowerCase() === nextName.toLowerCase(),
    );
    if (duplicate) {
      setError("이미 같은 이름의 참가자가 있습니다.");
      return;
    }

    const { error: renameError } = await supabase
      .from("players")
      .update({ name: nextName })
      .eq("id", player.id)
      .eq("room_id", room.id);

    if (renameError) {
      setError("참가자 이름을 수정하지 못했습니다.");
      return;
    }

    setMessage("참가자 이름을 수정했습니다.");
    setError("");
  }

  async function removePlayer(player: Player) {
    if (!room) return;
    const confirmed = window.confirm(`${player.name} 참가자를 내보낼까요?`);
    if (!confirmed) return;

    const { error: removeError } = await supabase
      .from("players")
      .delete()
      .eq("id", player.id)
      .eq("room_id", room.id);

    if (removeError) {
      setError("참가자를 내보내지 못했습니다.");
      return;
    }

    setMessage(`${player.name} 참가자를 내보냈습니다.`);
    setError("");
  }

  async function resetGame() {
    if (!room) return;
    const confirmed = window.confirm("정말 게임을 초기화할까요? 역할 정보가 모두 삭제됩니다.");
    if (!confirmed) return;

    setIsBusy(true);
    await supabase
      .from("players")
      .update({ role: null, team: null, private_info: null, is_alive: true })
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
    setLoverAId("");
    setLoverBId("");
    setError("");
    setIsBusy(false);
  }

  async function saveSecretInfo() {
    if (!room) return;

    if ((loverAId && !loverBId) || (!loverAId && loverBId)) {
      setError("연인은 2명을 모두 선택해 주세요.");
      return;
    }

    if (loverAId && loverAId === loverBId) {
      setError("연인은 서로 다른 2명을 선택해야 합니다.");
      return;
    }

    const loverA = players.find((player) => player.id === loverAId) ?? null;
    const loverB = players.find((player) => player.id === loverBId) ?? null;
    const mafiaPlayers = players.filter((player) => player.role === "마피아");

    setIsBusy(true);
    setError("");
    setMessage("");

    const results = await Promise.all(
      players.map((player) => {
        const lines: string[] = [];
        if (loverA && loverB) {
          if (player.id === loverA.id) {
            lines.push(`연인: ${loverB.name}`);
            lines.push("큐피드가 지정한 연인입니다. 연인 규칙은 사회자의 진행 방식에 따르세요.");
          }
          if (player.id === loverB.id) {
            lines.push(`연인: ${loverA.name}`);
            lines.push("큐피드가 지정한 연인입니다. 연인 규칙은 사회자의 진행 방식에 따르세요.");
          }
        }

        if (player.role === "마피아") {
          const teammateNames = mafiaPlayers
            .filter((mafia) => mafia.id !== player.id)
            .map((mafia) => mafia.name);
          lines.push(
            teammateNames.length > 0
              ? `마피아 동료: ${teammateNames.join(", ")}`
              : "마피아 동료: 없음",
          );
        }

        return supabase
          .from("players")
          .update({ private_info: lines.length > 0 ? lines.join("\n") : null })
          .eq("id", player.id)
          .eq("room_id", room.id);
      }),
    );

    if (results.some((result) => result.error)) {
      setError("비밀 정보를 저장하지 못했습니다. schema.sql이 최신인지 확인해 주세요.");
      setIsBusy(false);
      return;
    }

    setMessage("연인 정보와 마피아 동료 정보를 저장했습니다.");
    setIsBusy(false);
  }

  async function clearSecretInfo() {
    if (!room) return;
    const confirmed = window.confirm("연인/마피아 동료 비밀 정보를 모두 지울까요?");
    if (!confirmed) return;

    setIsBusy(true);
    const { error: clearError } = await supabase
      .from("players")
      .update({ private_info: null })
      .eq("room_id", room.id);

    if (clearError) {
      setError("비밀 정보를 지우지 못했습니다.");
      setIsBusy(false);
      return;
    }

    setLoverAId("");
    setLoverBId("");
    setMessage("비밀 정보를 지웠습니다.");
    setError("");
    setIsBusy(false);
  }

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-5 px-4 pb-28 pt-5 sm:px-6 lg:px-8 lg:pb-8">
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
        <section className="space-y-4">
          <Panel title="방 만들기">
            <div className="space-y-4">
              <label className="block">
                <span className="text-sm font-bold text-zinc-700">방 이름</span>
                <input
                  value={roomName}
                  onChange={(event) => {
                    setRoomName(event.target.value);
                    setSettingsDirty(true);
                  }}
                  className="mt-2 h-14 w-full rounded-lg border border-zinc-300 px-4 text-lg font-bold text-zinc-950 outline-none focus:border-red-500 focus:ring-2 focus:ring-red-100"
                  maxLength={40}
                />
              </label>
              <label className="flex items-center justify-between gap-3 rounded-lg border border-zinc-200 p-4">
                <span>
                  <span className="block font-black text-zinc-950">공개 방 목록에 보이기</span>
                  <span className="text-sm text-zinc-500">켜면 첫 화면에서 참가자가 방을 선택할 수 있습니다.</span>
                </span>
                <input
                  type="checkbox"
                  checked={isVisible}
                  onChange={(event) => {
                    setIsVisible(event.target.checked);
                    setSettingsDirty(true);
                  }}
                  className="h-6 w-6"
                />
              </label>
              <label className="flex items-center justify-between gap-3 rounded-lg border border-zinc-200 p-4">
                <span>
                  <span className="block font-black text-zinc-950">비밀번호 사용</span>
                  <span className="text-sm text-zinc-500">끄면 방 코드만으로 참가할 수 있습니다.</span>
                </span>
                <input
                  type="checkbox"
                  checked={usePassword}
                  onChange={(event) => {
                    setUsePassword(event.target.checked);
                    setSettingsDirty(true);
                  }}
                  className="h-6 w-6"
                />
              </label>
              {usePassword ? (
                <input
                  value={roomPassword}
                  onChange={(event) => setRoomPassword(event.target.value)}
                  placeholder="방 비밀번호"
                  type="password"
                  className="h-14 w-full rounded-lg border border-zinc-300 px-4 text-lg font-bold text-zinc-950 outline-none focus:border-red-500 focus:ring-2 focus:ring-red-100"
                />
              ) : null}
            </div>
            <button
              type="button"
              onClick={createRoom}
              disabled={isBusy}
              className="mt-5 min-h-14 w-full rounded-lg bg-red-700 px-5 py-4 text-lg font-black text-white disabled:opacity-50"
            >
              방 생성하기
            </button>
          </Panel>

          <Panel title="기존 방 불러오기">
            <form onSubmit={recoverRoom} className="space-y-3">
              <input
                value={recoverCode}
                onChange={(event) => setRecoverCode(event.target.value)}
                placeholder="방 코드"
                className="h-14 w-full rounded-lg border border-zinc-300 px-4 text-lg font-bold uppercase text-zinc-950 outline-none focus:border-red-500 focus:ring-2 focus:ring-red-100"
              />
              <button
                type="submit"
                className="min-h-14 w-full rounded-lg bg-zinc-950 px-5 py-4 text-lg font-black text-white"
              >
                방 불러오기
              </button>
            </form>
          </Panel>
        </section>
      ) : (
        <>
          <MobileQuickActions
            room={room}
            isBusy={isBusy}
            playerCount={playerCount}
            assignRoles={assignRoles}
            revealRoles={revealRoles}
            startDay={startDay}
            startNight={startNight}
          />

          <div className="grid gap-5 lg:grid-cols-[1fr_1.1fr]">
            <section className="space-y-5">
              <Panel title="방 코드">
                <p className="mb-2 text-lg font-black text-zinc-700">{room.name}</p>
                <p className="text-5xl font-black tracking-normal text-zinc-950">{room.code}</p>
                <p className="mt-3 text-sm font-bold text-zinc-500">
                  {room.is_visible ? "공개 방" : "비공개 방"} · {room.has_password ? "비밀번호 있음" : "비밀번호 없음"}
                </p>
              </Panel>

              <Panel title="방 설정">
                <div className="space-y-4">
                  <label className="block">
                    <span className="text-sm font-bold text-zinc-700">방 이름</span>
                    <input
                      value={roomName}
                      onChange={(event) => setRoomName(event.target.value)}
                      className="mt-2 h-12 w-full rounded-lg border border-zinc-300 px-3 font-bold text-zinc-950 outline-none focus:border-red-500 focus:ring-2 focus:ring-red-100"
                      maxLength={40}
                    />
                  </label>
                  <label className="flex items-center justify-between gap-3 rounded-lg border border-zinc-200 p-3">
                    <span className="font-bold text-zinc-800">공개 방 목록에 보이기</span>
                    <input
                      type="checkbox"
                      checked={isVisible}
                      onChange={(event) => setIsVisible(event.target.checked)}
                      className="h-6 w-6"
                    />
                  </label>
                  <label className="flex items-center justify-between gap-3 rounded-lg border border-zinc-200 p-3">
                    <span className="font-bold text-zinc-800">비밀번호 사용</span>
                    <input
                      type="checkbox"
                      checked={usePassword}
                      onChange={(event) => setUsePassword(event.target.checked)}
                      className="h-6 w-6"
                    />
                  </label>
                  {usePassword ? (
                    <input
                      value={settingsPassword}
                      onChange={(event) => {
                        setSettingsPassword(event.target.value);
                        setSettingsDirty(true);
                      }}
                      placeholder={room.has_password ? "새 비밀번호를 입력하면 변경됩니다" : "방 비밀번호"}
                      type="password"
                      className="h-12 w-full rounded-lg border border-zinc-300 px-3 font-bold text-zinc-950 outline-none focus:border-red-500 focus:ring-2 focus:ring-red-100"
                    />
                  ) : null}
                  <button
                    type="button"
                    onClick={saveRoomSettings}
                    disabled={isBusy}
                    className="min-h-12 w-full rounded-lg bg-zinc-950 px-4 py-3 font-black text-white disabled:opacity-50"
                  >
                    방 설정 저장
                  </button>
                </div>
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

              <Panel title="사회자 메모">
                <HostNotes room={room} />
              </Panel>

              <Panel title={`현재 참가자 수: ${playerCount}명`}>
                <PlayerList
                  players={players}
                  showRoles={room.status !== "waiting"}
                  canManage
                  onRename={renamePlayer}
                  onRemove={removePlayer}
                />
              </Panel>
            </section>

            <section className="space-y-5">
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
                <p className="mt-3 rounded-lg bg-indigo-50 p-3 text-sm font-bold leading-6 text-indigo-950">
                  밤 시작을 누르면 참가자 화면이 밤으로 바뀌고, 미리 소음 준비를 눌러둔 휴대폰은 동시에 소음 재생을 시도합니다.
                </p>
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

              {room.status === "night" ? (
                <Panel title="사회자 밤 소음">
                  <WhiteNoisePlayer title="사회자용 소음" />
                </Panel>
              ) : null}

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

              <Panel title="수동 역할 지정">
                <ManualRoleAssigner
                  players={players}
                  roleCounts={roleCounts}
                  manualRoles={manualRoles}
                  manualCounts={manualRoleStats.manualCounts}
                  remainingCounts={manualRoleStats.remainingCounts}
                  onChange={setManualRoles}
                />
              </Panel>

              <Panel title="연인 / 마피아 비밀 정보">
                <SecretInfoSettings
                  players={players}
                  loverAId={loverAId}
                  loverBId={loverBId}
                  isBusy={isBusy}
                  onLoverAChange={setLoverAId}
                  onLoverBChange={setLoverBId}
                  onSave={saveSecretInfo}
                  onClear={clearSecretInfo}
                />
              </Panel>

              <Panel title="역할 설명">
                <RoleGuide />
              </Panel>
            </section>
          </div>
        </>
      )}
    </main>
  );
}

function ManualRoleAssigner({
  players,
  roleCounts,
  manualRoles,
  manualCounts,
  remainingCounts,
  onChange,
}: {
  players: Player[];
  roleCounts: RoleCounts;
  manualRoles: Record<string, string>;
  manualCounts: RoleCounts;
  remainingCounts: RoleCounts;
  onChange: (manualRoles: Record<string, string>) => void;
}) {
  const availableRoles = ROLE_ORDER.filter((role) => roleCounts[role] !== undefined);
  const manualTotal = getRoleTotal(manualCounts);

  function updatePlayerRole(playerId: string, role: string) {
    const nextRoles = { ...manualRoles };
    if (role) {
      nextRoles[playerId] = role;
    } else {
      delete nextRoles[playerId];
    }
    onChange(nextRoles);
  }

  function clearManualRoles() {
    onChange({});
  }

  function useCurrentRoles() {
    const nextRoles: Record<string, string> = {};
    players.forEach((player) => {
      if (player.role) {
        nextRoles[player.id] = player.role;
      }
    });
    onChange(nextRoles);
  }

  if (players.length === 0) {
    return <p className="text-sm font-bold text-zinc-500">참가자가 들어오면 수동 지정 표가 표시됩니다.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-black text-zinc-950">
            수동 지정 {manualTotal}명 · 나머지 {Math.max(players.length - manualTotal, 0)}명 랜덤
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={useCurrentRoles}
              className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs font-black text-zinc-800"
            >
              현재 역할 불러오기
            </button>
            <button
              type="button"
              onClick={clearManualRoles}
              className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-black text-red-800"
            >
              수동 초기화
            </button>
          </div>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {availableRoles.map((role) => {
            const remaining = Number(remainingCounts[role] || 0);
            const isOver = Number(manualCounts[role] || 0) > Number(roleCounts[role] || 0);
            return (
              <div
                key={role}
                className={`rounded-lg border px-3 py-2 text-sm font-bold ${
                  isOver ? "border-red-200 bg-red-50 text-red-900" : "border-zinc-200 bg-white text-zinc-700"
                }`}
              >
                {role}: 수동 {manualCounts[role] ?? 0} / 전체 {roleCounts[role] ?? 0} · 남음 {remaining}
              </div>
            );
          })}
        </div>
      </div>

      <div className="max-h-[520px] overflow-auto rounded-lg border border-zinc-200">
        {players.map((player, index) => (
          <label
            key={player.id}
            className="grid gap-2 border-b border-zinc-100 p-3 last:border-b-0 sm:grid-cols-[1fr_180px] sm:items-center"
          >
            <span className="min-w-0">
              <span className="block truncate font-black text-zinc-950">
                {index + 1}. {player.name}
              </span>
              <span className="text-xs font-bold text-zinc-500">
                {manualRoles[player.id] ? "수동 지정" : "남은 역할 중 랜덤"}
                {player.role ? ` · 현재 ${player.role}` : ""}
              </span>
            </span>
            <select
              value={manualRoles[player.id] ?? ""}
              onChange={(event) => updatePlayerRole(player.id, event.target.value)}
              className="h-11 rounded-lg border border-zinc-300 bg-white px-3 font-bold text-zinc-950 outline-none focus:border-red-500 focus:ring-2 focus:ring-red-100"
            >
              <option value="">랜덤</option>
              {availableRoles.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
    </div>
  );
}

function SecretInfoSettings({
  players,
  loverAId,
  loverBId,
  isBusy,
  onLoverAChange,
  onLoverBChange,
  onSave,
  onClear,
}: {
  players: Player[];
  loverAId: string;
  loverBId: string;
  isBusy: boolean;
  onLoverAChange: (playerId: string) => void;
  onLoverBChange: (playerId: string) => void;
  onSave: () => void;
  onClear: () => void;
}) {
  const mafiaPlayers = players.filter((player) => player.role === "마피아");
  const cupidPlayers = players.filter((player) => player.role === "큐피드");
  const loverA = players.find((player) => player.id === loverAId);
  const loverB = players.find((player) => player.id === loverBId);

  if (players.length === 0) {
    return <p className="text-sm font-bold text-zinc-500">참가자가 들어오면 연인과 마피아 정보를 설정할 수 있습니다.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
        <p className="text-sm font-black text-amber-950">
          플레이어에게 보일 비밀 정보를 사회자가 설정합니다. 저장 후 역할이 공개되면 각자 자기 정보만 볼 수 있습니다.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-sm font-black text-zinc-800">연인 1</span>
          <select
            value={loverAId}
            onChange={(event) => onLoverAChange(event.target.value)}
            className="mt-2 h-12 w-full rounded-lg border border-zinc-300 bg-white px-3 font-bold text-zinc-950 outline-none focus:border-red-500 focus:ring-2 focus:ring-red-100"
          >
            <option value="">선택 안 함</option>
            {players.map((player) => (
              <option key={player.id} value={player.id}>
                {player.name}
                {player.role ? ` · ${player.role}` : ""}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-sm font-black text-zinc-800">연인 2</span>
          <select
            value={loverBId}
            onChange={(event) => onLoverBChange(event.target.value)}
            className="mt-2 h-12 w-full rounded-lg border border-zinc-300 bg-white px-3 font-bold text-zinc-950 outline-none focus:border-red-500 focus:ring-2 focus:ring-red-100"
          >
            <option value="">선택 안 함</option>
            {players.map((player) => (
              <option key={player.id} value={player.id}>
                {player.name}
                {player.role ? ` · ${player.role}` : ""}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-sm leading-6">
        <p className="font-black text-zinc-950">
          큐피드: {cupidPlayers.length > 0 ? cupidPlayers.map((player) => player.name).join(", ") : "현재 없음"}
        </p>
        <p className="font-bold text-zinc-600">
          연인: {loverA && loverB ? `${loverA.name} ↔ ${loverB.name}` : "2명을 선택하면 저장됩니다."}
        </p>
        <p className="font-bold text-zinc-600">
          마피아 공유:{" "}
          {mafiaPlayers.length > 0
            ? mafiaPlayers.map((player) => player.name).join(", ")
            : "역할 배정 후 마피아가 있으면 서로 이름을 공유합니다."}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={onSave}
          disabled={isBusy}
          className="min-h-12 rounded-lg bg-zinc-950 px-4 py-3 font-black text-white disabled:bg-zinc-300 disabled:text-zinc-500"
        >
          비밀 정보 저장
        </button>
        <button
          type="button"
          onClick={onClear}
          disabled={isBusy}
          className="min-h-12 rounded-lg border border-red-200 bg-red-50 px-4 py-3 font-black text-red-800 disabled:opacity-50"
        >
          비밀 정보 지우기
        </button>
      </div>
    </div>
  );
}

function HostNotes({ room }: { room: Room }) {
  const [notes, setNotes] = useState("");
  const storageKey = `mafia-host-notes-${room.id}`;

  useEffect(() => {
    setNotes(window.localStorage.getItem(storageKey) ?? "");
  }, [storageKey]);

  function updateNotes(value: string) {
    setNotes(value);
    window.localStorage.setItem(storageKey, value);
  }

  function addTimestamp() {
    const now = new Date();
    const time = now.toLocaleTimeString("ko-KR", {
      hour: "2-digit",
      minute: "2-digit",
    });
    const phase = getStatusLabel(room.status);
    const dayLabel = room.day_number > 0 ? ` ${room.day_number}일차` : "";
    const prefix = `[${phase}${dayLabel} ${time}] `;
    updateNotes(notes ? `${notes}\n${prefix}` : prefix);
  }

  function clearNotes() {
    const confirmed = window.confirm("사회자 메모를 모두 지울까요?");
    if (!confirmed) return;
    updateNotes("");
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-bold leading-6 text-zinc-500">
          이 메모는 현재 사회자 기기에만 저장됩니다. 진행 기록, 의심 후보, 밤 행동 결과를 적어두세요.
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={addTimestamp}
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs font-black text-zinc-800"
          >
            현재 시점 추가
          </button>
          <button
            type="button"
            onClick={clearNotes}
            className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-black text-red-800"
          >
            지우기
          </button>
        </div>
      </div>
      <textarea
        value={notes}
        onChange={(event) => updateNotes(event.target.value)}
        placeholder="예: 1일차 토론 후보, 투표 결과, 밤 행동 순서, 사망자, 특이 발언..."
        className="min-h-44 w-full resize-y rounded-lg border border-zinc-300 p-3 text-base leading-7 text-zinc-950 outline-none focus:border-red-500 focus:ring-2 focus:ring-red-100"
      />
    </div>
  );
}

function MobileQuickActions({
  room,
  isBusy,
  playerCount,
  assignRoles,
  revealRoles,
  startDay,
  startNight,
}: {
  room: Room;
  isBusy: boolean;
  playerCount: number;
  assignRoles: () => void;
  revealRoles: () => void;
  startDay: () => void;
  startNight: () => void;
}) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-zinc-200 bg-white/95 p-3 shadow-[0_-8px_24px_rgba(0,0,0,0.12)] backdrop-blur lg:hidden">
      <div className="mx-auto grid max-w-md grid-cols-4 gap-2">
        <button
          type="button"
          onClick={assignRoles}
          disabled={isBusy || playerCount < 5}
          className="min-h-12 rounded-lg bg-zinc-950 px-2 text-xs font-black text-white disabled:bg-zinc-300 disabled:text-zinc-500"
        >
          배정
        </button>
        <button
          type="button"
          onClick={revealRoles}
          disabled={isBusy || room.status !== "assigned"}
          className="min-h-12 rounded-lg bg-red-700 px-2 text-xs font-black text-white disabled:bg-zinc-300 disabled:text-zinc-500"
        >
          공개
        </button>
        <button
          type="button"
          onClick={startDay}
          disabled={isBusy}
          className="min-h-12 rounded-lg bg-sky-700 px-2 text-xs font-black text-white disabled:bg-zinc-300 disabled:text-zinc-500"
        >
          낮
        </button>
        <button
          type="button"
          onClick={startNight}
          disabled={isBusy}
          className="min-h-12 rounded-lg bg-indigo-800 px-2 text-xs font-black text-white disabled:bg-zinc-300 disabled:text-zinc-500"
        >
          밤
        </button>
      </div>
    </div>
  );
}

function getStatusLabel(status: Room["status"]) {
  const labels: Record<Room["status"], string> = {
    waiting: "대기",
    assigned: "배정",
    revealed: "공개",
    day: "낮",
    night: "밤",
    voting: "투표",
    ended: "종료",
  };
  return labels[status];
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
