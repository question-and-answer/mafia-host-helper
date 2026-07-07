"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseAdmin, isSupabaseAdminConfigured } from "@/lib/supabaseAdmin";
import type { RoomStatus } from "@/types/game";

function assertAdmin(password: string) {
  if (!process.env.ADMIN_URL_PASSWORD) {
    throw new Error("ADMIN_URL_PASSWORD is not configured.");
  }

  if (password !== process.env.ADMIN_URL_PASSWORD) {
    throw new Error("Invalid admin URL password.");
  }

  if (!isSupabaseAdminConfigured) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured.");
  }
}

function adminPath(password: string) {
  return `/admin/${password}`;
}

export async function toggleRoomVisibility(password: string, roomId: string, nextVisible: boolean) {
  assertAdmin(password);
  const supabase = createSupabaseAdmin();

  const { error } = await supabase
    .from("rooms")
    .update({ is_visible: nextVisible })
    .eq("id", roomId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath(adminPath(password));
}

export async function renameRoom(password: string, roomId: string, formData: FormData) {
  assertAdmin(password);
  const name = String(formData.get("name") ?? "").trim();

  if (!name) {
    throw new Error("Room name is required.");
  }

  const supabase = createSupabaseAdmin();
  const { error } = await supabase.from("rooms").update({ name }).eq("id", roomId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath(adminPath(password));
}

export async function setRoomStatus(password: string, roomId: string, status: RoomStatus) {
  assertAdmin(password);
  const supabase = createSupabaseAdmin();

  const { error } = await supabase
    .from("rooms")
    .update({
      status,
      discussion_started_at: status === "day" ? new Date().toISOString() : null,
    })
    .eq("id", roomId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath(adminPath(password));
}

export async function resetRoom(password: string, roomId: string) {
  assertAdmin(password);
  const supabase = createSupabaseAdmin();

  const [{ error: playersError }, { error: roomError }] = await Promise.all([
    supabase
      .from("players")
      .update({ role: null, team: null, private_info: null, is_alive: true })
      .eq("room_id", roomId),
    supabase
      .from("rooms")
      .update({
        status: "waiting",
        day_number: 0,
        discussion_seconds: 300,
        discussion_started_at: null,
      })
      .eq("id", roomId),
  ]);

  if (playersError || roomError) {
    throw new Error(playersError?.message ?? roomError?.message ?? "Reset failed.");
  }

  revalidatePath(adminPath(password));
}

export async function resetAllRooms(password: string) {
  assertAdmin(password);
  const supabase = createSupabaseAdmin();

  const [{ error: playersError }, { error: roomsError }] = await Promise.all([
    supabase.from("players").update({ role: null, team: null, private_info: null, is_alive: true }).neq("id", "00000000-0000-0000-0000-000000000000"),
    supabase
      .from("rooms")
      .update({
        status: "waiting",
        day_number: 0,
        discussion_seconds: 300,
        discussion_started_at: null,
      })
      .neq("id", "00000000-0000-0000-0000-000000000000"),
  ]);

  if (playersError || roomsError) {
    throw new Error(playersError?.message ?? roomsError?.message ?? "Reset all failed.");
  }

  revalidatePath(adminPath(password));
}

export async function deletePlayer(password: string, playerId: string) {
  assertAdmin(password);
  const supabase = createSupabaseAdmin();

  const { error } = await supabase.from("players").delete().eq("id", playerId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath(adminPath(password));
}

export async function deleteAllRooms(password: string) {
  assertAdmin(password);
  const supabase = createSupabaseAdmin();

  const { error } = await supabase
    .from("rooms")
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000");

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath(adminPath(password));
}

export async function deleteRoom(password: string, roomId: string) {
  assertAdmin(password);
  const supabase = createSupabaseAdmin();

  const { error } = await supabase.from("rooms").delete().eq("id", roomId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath(adminPath(password));
}
