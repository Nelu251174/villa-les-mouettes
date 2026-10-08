import "server-only";
import webpush from "web-push";
import { appendAudit, listPushSubs, readVapid, removePushSubs, writeVapid } from "./store";

export type PushPayload = { title: string; body: string; url?: string; tag?: string };

export async function vapid(): Promise<{ publicKey: string; privateKey: string }> {
  const existing = await readVapid();
  if (existing) return existing;
  await writeVapid(webpush.generateVAPIDKeys());
  return (await readVapid())!; // dupa scriere (sau dupa o scriere concurenta) citim varianta salvata
}

/**
 * Trimite o notificare tuturor telefoanelor abonate. Nu arunca niciodata (un push esuat nu trebuie sa strice rezervarea).
 * Abonamentele moarte (404/410) se sterg. Rezultatul ramane in audit.
 */
export async function notifyOwner(p: PushPayload): Promise<{ sent: number; failed: number; removed: number }> {
  try {
    const subs = await listPushSubs();
    if (subs.length === 0) return { sent: 0, failed: 0, removed: 0 };
    const keys = await vapid();
    webpush.setVapidDetails(process.env.VLM_VAPID_SUBJECT ?? "mailto:support@villalesmouettes.com", keys.publicKey, keys.privateKey);
    const body = JSON.stringify({ ...p, url: p.url ?? "/admin" });
    let sent = 0, failed = 0;
    const dead: string[] = [];
    await Promise.all(
      subs.map(async (s) => {
        try {
          await webpush.sendNotification({ endpoint: s.endpoint, keys: s.keys }, body, { TTL: 86_400, urgency: "high", topic: p.tag?.slice(0, 32).replace(/[^A-Za-z0-9_-]/g, "") || undefined });
          sent++;
        } catch (e) {
          const code = (e as { statusCode?: number }).statusCode;
          if (code === 404 || code === 410) dead.push(s.endpoint);
          else failed++;
        }
      }),
    );
    if (dead.length) await removePushSubs(dead);
    await appendAudit({ actor: "system", action: "push.send", target: p.tag ?? p.title, result: failed ? "failed" : sent ? "sent" : "none", reason: `sent=${sent} failed=${failed} removed=${dead.length}` });
    return { sent, failed, removed: dead.length };
  } catch (e) {
    await appendAudit({ actor: "system", action: "push.send", target: p.tag ?? p.title, result: "failed", reason: e instanceof Error ? e.message.slice(0, 120) : "error" }).catch(() => undefined);
    return { sent: 0, failed: 1, removed: 0 };
  }
}
