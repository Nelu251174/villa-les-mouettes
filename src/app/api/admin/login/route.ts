import { NextResponse } from "next/server";
import { ADMIN_COOKIE, adminConfigured, audit, loginAllowed, makeSession, passwordOk } from "@/lib/admin";

export async function POST(req: Request) {
  if (!adminConfigured()) return NextResponse.json({ ok: false, error: "not_configured" }, { status: 503 });
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (!loginAllowed(ip)) return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429 });
  const { password } = (await req.json().catch(() => ({}))) as { password?: string };
  if (typeof password !== "string" || !passwordOk(password)) {
    await audit("admin.login", ip, "failed", "bad_password");
    return NextResponse.json({ ok: false, error: "bad_password" }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, makeSession()!, { httpOnly: true, sameSite: "strict", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 8 * 3600 });
  await audit("admin.login", ip, "ok");
  return res;
}
