"use server";

import { createHash } from "crypto";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { createSupabaseAdmin, isSupabaseAdminConfigured } from "@/lib/supabaseAdmin";
import type { RoomStatus } from "@/types/game";

const COOKIE_NAME = "mafia_adminj";
const ADMIN_PATH = "/adminj";

function getAdminToken() {
  const password = process.env.ADMINJ_PASSWORD;
  if (!password) {
    throw new Error("ADMINJ_PASSWORD is not configured.");
  }

  return createHash("sha256").update(password).digest("hex");
}

async function assertAdmin() {
  if (!isSupabaseAdminConfigured) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured.");
  }

  const cookieStore = await cookies();
  if (cookieStore.get(COOKIE_NAME)?.value !== getAdminToken()) {
    throw new Error("Admin password is required.");
  }
}

export async function loginAdminj(formData: FormData) {
  const password = String(formData.get("password") ?? "");

  if (!process.env.ADMINJ_PASSWORD || password !== process.env.ADMINJ_PASSWORD) {
    throw new Error("비밀번호가 올바르지 않습니다.");
  }

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, getAdminToken(), {
    httpOnly: true,
    sameSite: "strict",
    secure: true,
    path: ADMIN_PATH,
    maxAge: 60 * 60 * 8,
  });

  revalidatePath(ADMIN_PATH);
}

export async function toggleRoomVisibility(roomId: string, nextVisible: boolean) {
  await assertAdmin();
  const supabase = createSupabaseAdmin();

  const { error } = await supabase
    .from("rooms")
    .update({ is_visible: nextVisible })
    .eq("id", roomId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath(ADMIN_PATH);
}

export async function setRoomStatus(roomId: string, status: RoomStatus) {
  await assertAdmin();
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

  revalidatePath(ADMIN_PATH);
}

export async function deleteRoom(roomId: string) {
  await assertAdmin();
  const supabase = createSupabaseAdmin();

  const { error } = await supabase.from("rooms").delete().eq("id", roomId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath(ADMIN_PATH);
}
