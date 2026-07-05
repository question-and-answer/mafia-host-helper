"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseAdmin, isSupabaseAdminConfigured } from "@/lib/supabaseAdmin";
import type { RoomStatus } from "@/types/game";

function assertAdmin(secret: string) {
  if (!process.env.SUPER_ADMIN_SECRET) {
    throw new Error("SUPER_ADMIN_SECRET is not configured.");
  }

  if (secret !== process.env.SUPER_ADMIN_SECRET) {
    throw new Error("Invalid super admin secret.");
  }

  if (!isSupabaseAdminConfigured) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured.");
  }
}

export async function toggleRoomVisibility(secret: string, roomId: string, nextVisible: boolean) {
  assertAdmin(secret);
  const supabase = createSupabaseAdmin();

  const { error } = await supabase
    .from("rooms")
    .update({ is_visible: nextVisible })
    .eq("id", roomId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath(`/super-admin/${secret}`);
}

export async function setRoomStatus(secret: string, roomId: string, status: RoomStatus) {
  assertAdmin(secret);
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

  revalidatePath(`/super-admin/${secret}`);
}

export async function deleteRoom(secret: string, roomId: string) {
  assertAdmin(secret);
  const supabase = createSupabaseAdmin();

  const { error } = await supabase.from("rooms").delete().eq("id", roomId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath(`/super-admin/${secret}`);
}
