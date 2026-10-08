// Cod doar pentru browser (aplicatia de admin): inregistrare service worker, notificari push, alarma sonora, ecran aprins.

export const SEEN_KEY = "vlm-admin-seen";
export const SCREEN_KEY = "vlm-admin-keep-awake";

export function b64ToU8(b64: string): Uint8Array<ArrayBuffer> {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export async function registerAdminSw(): Promise<ServiceWorkerRegistration | null> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return null;
  try {
    return await navigator.serviceWorker.register("/admin/sw.js", { scope: "/admin" });
  } catch {
    return null;
  }
}

export type PushState = "unsupported" | "denied" | "off" | "on";

export async function getPushState(): Promise<PushState> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return "unsupported";
  if (Notification.permission === "denied") return "denied";
  const reg = await navigator.serviceWorker.getRegistration("/admin");
  const sub = await reg?.pushManager.getSubscription();
  return sub && Notification.permission === "granted" ? "on" : "off";
}

/** Se apeleaza dintr-un click (gest al utilizatorului): cere permisiunea si inregistreaza telefonul pe server. */
export async function enablePush(): Promise<{ ok: boolean; error?: string }> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return { ok: false, error: "unsupported" };
  const perm = await Notification.requestPermission();
  if (perm !== "granted") return { ok: false, error: "denied" };
  const reg = (await registerAdminSw()) ?? undefined;
  if (!reg) return { ok: false, error: "sw" };
  await navigator.serviceWorker.ready;
  const keyRes = await fetch("/api/admin/push");
  if (!keyRes.ok) return { ok: false, error: "key" };
  const { publicKey } = (await keyRes.json()) as { publicKey: string };
  let sub = await reg.pushManager.getSubscription();
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToU8(publicKey) });
  const r = await fetch("/api/admin/push", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "subscribe", subscription: sub.toJSON() }) });
  return r.ok ? { ok: true } : { ok: false, error: "server" };
}

export async function disablePush(): Promise<void> {
  const reg = await navigator.serviceWorker.getRegistration("/admin");
  const sub = await reg?.pushManager.getSubscription();
  if (!sub) return;
  await fetch("/api/admin/push", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "unsubscribe", subscription: sub.toJSON() }) });
  await sub.unsubscribe();
}

/** Alarma sonora cu WebAudio: doua tonuri alternante, in bucla pana la oprire. Trebuie "deblocata" dintr-un click. */
export class Alarm {
  private ctx: AudioContext | null = null;
  private timer: number | null = null;
  private vib: number | null = null;

  unlock(): boolean {
    try {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return false;
      this.ctx ??= new AC();
      void this.ctx.resume();
      return true;
    } catch {
      return false;
    }
  }

  get ready(): boolean {
    return !!this.ctx && this.ctx.state === "running";
  }

  private beep(freq: number, ms: number) {
    const c = this.ctx;
    if (!c) return;
    const o = c.createOscillator(), g = c.createGain();
    o.type = "square";
    o.frequency.value = freq;
    const t = c.currentTime;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.35, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + ms / 1000);
    o.connect(g).connect(c.destination);
    o.start(t);
    o.stop(t + ms / 1000 + 0.05);
  }

  start() {
    if (this.timer !== null) return;
    let hi = true;
    const tick = () => { this.beep(hi ? 988 : 740, 320); hi = !hi; };
    tick();
    this.timer = window.setInterval(tick, 420);
    const vib = () => navigator.vibrate?.([350, 120, 350, 120, 700]);
    vib();
    this.vib = window.setInterval(vib, 2200);
  }

  stop() {
    if (this.timer !== null) { window.clearInterval(this.timer); this.timer = null; }
    if (this.vib !== null) { window.clearInterval(this.vib); this.vib = null; }
    navigator.vibrate?.(0);
  }
}

type WakeSentinel = { release: () => Promise<void> };
let wake: WakeSentinel | null = null;
export async function setKeepAwake(on: boolean): Promise<boolean> {
  try {
    const wl = (navigator as unknown as { wakeLock?: { request: (t: "screen") => Promise<WakeSentinel> } }).wakeLock;
    if (!on) { await wake?.release(); wake = null; return true; }
    if (!wl) return false;
    wake = await wl.request("screen");
    return true;
  } catch {
    return false;
  }
}
