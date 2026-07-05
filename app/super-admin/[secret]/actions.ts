"use server";

import { createHash } from "crypto";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { createSupabaseAdmin, isSupabaseAdminConfigured } from "@/lib/supabaseAdmin";
import type { RoomStatus } from "@/types/game";

const COOKIE_NAME = "mafia_super_admin";

function getAdminToken(secret: string) {
  const password = process.env.SUPER_ADMIN_PASSWORD;
  if (!password) {
    throw new Error("SUPER_ADMIN_PASSWORD is not configured.");
  }

  return createHash("sha256").update(`${secret}:${password}`).digest("hex");
}

async function hasValidAdminCookie(secret: string) {
  const cookieStore = await cookies();
  return cookieStore.get(COOKIE_NAME)?.value === getAdminToken(secret);
}

async function assertAdmin(secret: string) {
  if (!process.env.SUPER_ADMIN_SECRET) {
    throw new Error("SUPER_ADMIN_SECRET is not configured.");
  }

  if (secret !== process.env.SUPER_ADMIN_SECRET) {
    throw new Error("Invalid super admin secret.");
  }

  if (!isSupabaseAdminConfigured) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured.");
  }

  if (!(await hasValidAdminCookie(secret))) {
    throw new Error("Super admin password is required.");
  }
}

export async function loginSuperAdmin(secret: string, formData: FormData) {
  if (!process.env.SUPER_ADMIN_SECRET || secret !== process.env.SUPER_ADMIN_SECRET) {
    throw new Error("Invalid super admin secret.");
  }

  const password = String(formData.get("password") ?? "");
  if (!process.env.SUPER_ADMIN_PASSWORD || password !== process.env.SUPER_ADMIN_PASSWORD) {
    throw new Error("비밀번호가 올바르지 않습니다.");
  }

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, getAdminToken(secret), {
    httpOnly: true,
    sameSite: "strict",
    secure: true,
    path: `/super-admin/${secret}`,
    maxAge: 60 * 60 * 8,
  });

  revalidatePath(`/super-admin/${secret}`);
}

export async function toggleRoomVisibility(secret: string, roomId: string, nextVisible: boolean) {
  await assertAdmin(secret);
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
  await assertAdmin(secret);
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
  await assertAdmin(secret);
  const supabase = createSupabaseAdmin();

  const { error } = await supabase.from("rooms").delete().eq("id", roomId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath(`/super-admin/${secret}`);
}
