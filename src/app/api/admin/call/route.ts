import { NextResponse } from "next/server";
import { audit, isAdmin } from "@/lib/admin";
import { callOwner, publicCallStatus, saveCallSettings } from "@/lib/call";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json(await publicCallStatus());
}

export async function POST(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  if (b.action === "save") {
    const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
    const r = await saveCallSettings({ enabled: b.enabled === true, phone: str(b.phone), sid: str(b.sid), from: str(b.from), token: str(b.token) || undefined });
    await audit("call.settings", "-", r.ok ? "saved" : "failed", r.ok ? (b.enabled === true ? "enabled" : "disabled") : r.error);
    return NextResponse.json(r, { status: r.ok ? 200 : 422 });
  }
  if (b.action === "test") {
    const r = await callOwner({ ro: "Acesta este un apel de test de la Villa Les Mouettes. Dacă auzi asta, apelurile merg.", en: "This is a test call from Villa Les Mouettes. If you hear this, calls work." }, { force: true, tag: "test" });
    await audit("call.test", "-", r.called ? "placed" : "failed", r.reason);
    return NextResponse.json({ ok: r.called, reason: r.reason });
  }
  return NextResponse.json({ ok: false, error: "unknown_action" }, { status: 400 });
}
