import "server-only";
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";
import { appendAudit, patchSettings, readSettings } from "./store";

/**
 * Apel telefonic automat catre proprietar (Twilio) la o cerere noua. Este OPRIT pana cand proprietarul il configureaza.
 * Token-ul Twilio se pastreaza criptat (AES-256-GCM, cheie derivata din VLM_SECRET) si nu mai este returnat niciodata.
 */
export type CallSettings = { enabled: boolean; phone: string; sid: string; tokenEnc: string; from: string; calls: number[] };
type Root = { call: CallSettings };

const E164 = /^\+[1-9]\d{7,14}$/;
export const validCall = { phone: (s: string) => E164.test(s), from: (s: string) => E164.test(s), sid: (s: string) => /^AC[a-fA-F0-9]{32}$/.test(s) };

const key = () => {
  const s = process.env.VLM_SECRET;
  if (!s || s.length < 32) throw new Error("VLM_SECRET lipseste");
  return scryptSync(s, "vlm-settings-v1", 32);
};
export function encrypt(plain: string): string {
  const iv = randomBytes(12), c = createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return [iv, c.getAuthTag(), enc].map((b) => b.toString("base64")).join(".");
}
export function decrypt(blob: string): string | null {
  try {
    const [iv, tag, enc] = blob.split(".").map((p) => Buffer.from(p, "base64"));
    const d = createDecipheriv("aes-256-gcm", key(), iv);
    d.setAuthTag(tag);
    return Buffer.concat([d.update(enc), d.final()]).toString("utf8");
  } catch {
    return null;
  }
}

export async function getCallSettings(): Promise<CallSettings | null> {
  const s = (await readSettings<Root>()).call;
  return s ? { enabled: !!s.enabled, phone: s.phone ?? "", sid: s.sid ?? "", tokenEnc: s.tokenEnc ?? "", from: s.from ?? "", calls: s.calls ?? [] } : null;
}

/** Ce vede interfata: fara token. */
export async function publicCallStatus() {
  const s = await getCallSettings();
  return {
    configured: !!s && validCall.phone(s.phone) && validCall.sid(s.sid) && validCall.from(s.from) && !!s.tokenEnc,
    enabled: !!s?.enabled,
    phoneMasked: s?.phone ? s.phone.slice(0, 4) + "•••" + s.phone.slice(-3) : "",
    sid: s?.sid ? s.sid.slice(0, 4) + "…" + s.sid.slice(-4) : "",
    from: s?.from ?? "",
  };
}

export async function saveCallSettings(input: { enabled: boolean; phone: string; sid: string; from: string; token?: string }): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!validCall.phone(input.phone)) return { ok: false, error: "phone" };
  if (!validCall.sid(input.sid)) return { ok: false, error: "sid" };
  if (!validCall.from(input.from)) return { ok: false, error: "from" };
  const cur = await getCallSettings();
  if (!input.token && !cur?.tokenEnc) return { ok: false, error: "token" };
  const tokenEnc = input.token ? encrypt(input.token.trim()) : cur!.tokenEnc;
  await patchSettings<Root>((c) => ({ ...c, call: { enabled: input.enabled, phone: input.phone, sid: input.sid, from: input.from, tokenEnc, calls: c.call?.calls ?? [] } }));
  return { ok: true };
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[c]!);
export const twiml = (text: string, voice: string, lang: string) =>
  `<Response><Pause length="1"/><Say voice="${voice}" language="${lang}">${esc(text)}</Say><Pause length="1"/><Say voice="${voice}" language="${lang}">${esc(text)}</Say></Response>`;

const MIN_GAP_MS = 120_000, MAX_PER_HOUR = 8; // protectie: formularul public nu poate declansa apeluri in lant

async function twilioCall(s: CallSettings, token: string, xml: string): Promise<{ ok: boolean; status: number }> {
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${s.sid}/Calls.json`, {
    method: "POST",
    headers: { authorization: "Basic " + Buffer.from(`${s.sid}:${token}`).toString("base64"), "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ To: s.phone, From: s.from, Twiml: xml }),
  });
  return { ok: res.ok, status: res.status };
}

/** Suna proprietarul. Nu arunca niciodata. `force` = test din aplicatie (ocoleste doar limita de frecventa). */
export async function callOwner(message: { ro: string; en: string }, opts: { force?: boolean; tag: string }): Promise<{ called: boolean; reason?: string }> {
  try {
    const s = await getCallSettings();
    if (!s || !s.enabled) return { called: false, reason: "disabled" };
    const token = s.tokenEnc ? decrypt(s.tokenEnc) : null;
    if (!token || !validCall.phone(s.phone) || !validCall.sid(s.sid) || !validCall.from(s.from)) return { called: false, reason: "not_configured" };
    const now = Date.now();
    const recent = s.calls.filter((t) => now - t < 3_600_000);
    if (!opts.force && ((recent.length && now - Math.max(...recent) < MIN_GAP_MS) || recent.length >= MAX_PER_HOUR)) {
      await appendAudit({ actor: "system", action: "call.skip", target: opts.tag, result: "rate_limited" });
      return { called: false, reason: "rate_limited" };
    }
    await patchSettings<Root>((c) => ({ ...c, call: { ...(c.call as CallSettings), calls: [...recent, now] } }));
    let r = await twilioCall(s, token, twiml(message.ro, "Polly.Carmen", "ro-RO"));
    if (!r.ok) r = await twilioCall(s, token, twiml(message.en, "Polly.Joanna", "en-US")); // vocea romana indisponibila pe cont -> engleza
    await appendAudit({ actor: "system", action: "call.place", target: opts.tag, result: r.ok ? "placed" : "failed", reason: r.ok ? undefined : `twilio_${r.status}` });
    return r.ok ? { called: true } : { called: false, reason: `twilio_${r.status}` };
  } catch (e) {
    await appendAudit({ actor: "system", action: "call.place", target: opts.tag, result: "failed", reason: e instanceof Error ? e.message.slice(0, 80) : "error" }).catch(() => undefined);
    return { called: false, reason: "error" };
  }
}
