import { NextResponse } from "next/server";
import { audit, isAdmin } from "@/lib/admin";
import { notifyOwner, vapid } from "@/lib/push";
import { addPushSub, listPushSubs, removePushSubs } from "@/lib/store";

export const dynamic = "force-dynamic";

type Sub = { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } };
const validSub = (s: Sub | undefined): s is { endpoint: string; keys: { p256dh: string; auth: string } } =>
  !!s && typeof s.endpoint === "string" && s.endpoint.startsWith("https://") && s.endpoint.length < 1000 && typeof s.keys?.p256dh === "string" && typeof s.keys?.auth === "string";

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json({ publicKey: (await vapid()).publicKey, devices: (await listPushSubs()).length });
}

export async function POST(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  const b = (await req.json().catch(() => ({}))) as { action?: string; subscription?: Sub };
  if (b.action === "subscribe") {
    if (!validSub(b.subscription)) return NextResponse.json({ ok: false, error: "subscription" }, { status: 422 });
    await addPushSub({ endpoint: b.subscription.endpoint, keys: b.subscription.keys, ua: (req.headers.get("user-agent") ?? "").slice(0, 160) });
    await audit("push.subscribe", b.subscription.endpoint.slice(0, 60), "ok");
    return NextResponse.json({ ok: true, devices: (await listPushSubs()).length });
  }
  if (b.action === "unsubscribe") {
    if (!validSub(b.subscription)) return NextResponse.json({ ok: false, error: "subscription" }, { status: 422 });
    await removePushSubs([b.subscription.endpoint]);
    await audit("push.unsubscribe", b.subscription.endpoint.slice(0, 60), "ok");
    return NextResponse.json({ ok: true });
  }
  if (b.action === "test") {
    const r = await notifyOwner({ title: "Test alertă — Villa Les Mouettes", body: "Dacă vezi și auzi asta, notificările merg.", tag: "test", url: "/admin" });
    await audit("push.test", "-", r.sent > 0 ? "sent" : "failed", `sent=${r.sent} failed=${r.failed}`);
    return NextResponse.json({ ok: r.sent > 0, ...r });
  }
  return NextResponse.json({ ok: false, error: "unknown_action" }, { status: 400 });
}
