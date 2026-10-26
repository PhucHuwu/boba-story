"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin, visitorIp } from "@/lib/auth";
import { gameApi } from "@/lib/gameApi";
import { SESSION_COOKIE, SESSION_TTL_SEC, authConfigured, checkCredentials, createSessionToken } from "@/lib/session";

export type FormState = { error?: string; ok?: string; username?: string } | undefined;

export async function login(_prev: FormState, form: FormData): Promise<FormState> {
  if (!authConfigured()) return { error: "Trang quản trị chưa được cấu hình tài khoản." };
  const username = String(form.get("username") ?? "").trim();
  const password = String(form.get("password") ?? "");
  if (!username || !password || username.length > 100 || password.length > 200) return { error: "Nhập tên đăng nhập và mật khẩu.", username };
  const gate = await gameApi<{ allowed: boolean }>("/login-attempt", { method: "POST", body: { key: await visitorIp() } });
  if (!gate.ok) return { error: `Không kiểm tra được giới hạn đăng nhập: ${gate.error}`, username };
  if (!gate.data.allowed) return { error: "Sai quá nhiều lần. Thử lại sau 15 phút.", username };
  if (!checkCredentials(username, password)) return { error: "Sai tên đăng nhập hoặc mật khẩu.", username };
  (await cookies()).set(SESSION_COOKIE, createSessionToken(username), {
    httpOnly: true,
    // Always https on Vercel; plain http only when testing on localhost.
    secure: process.env.VERCEL === "1" || (await headers()).get("x-forwarded-proto") === "https",
    sameSite: "strict",
    path: "/",
    maxAge: SESSION_TTL_SEC,
  });
  redirect("/");
}

export async function logout() {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/login");
}

export async function setHandled(id: number, handled: boolean) {
  await requireAdmin();
  const r = await gameApi(`/feedback/${id}`, { method: "PATCH", body: { handled } });
  revalidatePath("/");
  return r.ok ? null : r.error;
}

export async function deleteFeedback(id: number) {
  await requireAdmin();
  const r = await gameApi(`/feedback/${id}`, { method: "DELETE" });
  revalidatePath("/");
  return r.ok ? null : r.error;
}

export async function postAnnouncement(_prev: FormState, form: FormData): Promise<FormState> {
  await requireAdmin();
  const hours = Number(form.get("hours") ?? 0);
  const r = await gameApi("/announcement", {
    method: "PUT",
    body: { text: String(form.get("text") ?? ""), tone: String(form.get("tone") ?? "info"), hours: hours > 0 ? hours : undefined },
  });
  revalidatePath("/announcement");
  return r.ok ? { ok: "Đã đăng thông báo. Người chơi sẽ thấy trong vòng khoảng 1 phút." } : { error: r.error };
}

export async function clearAnnouncement() {
  await requireAdmin();
  const r = await gameApi("/announcement", { method: "DELETE" });
  revalidatePath("/announcement");
  return r.ok ? null : r.error;
}
