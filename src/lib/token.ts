import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

function secret(): string | null {
  const s = process.env.VLM_SECRET;
  return s && s.length >= 32 ? s : null;
}
export const secretConfigured = () => secret() !== null;

/** Token semnat cu scop (purpose) si expirare; scopurile diferite nu sunt interschimbabile. */
export function sign(purpose: string, subject: string, ttlMs: number): string | null {
  const s = secret();
  if (!s) return null;
  const body = Buffer.from(JSON.stringify({ p: purpose, s: subject, e: Date.now() + ttlMs })).toString("base64url");
  return `${body}.${createHmac("sha256", s).update(body).digest("base64url")}`;
}

export function read(purpose: string, token: string): string | null {
  const s = secret();
  if (!s) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expect = createHmac("sha256", s).update(body).digest();
  const got = Buffer.from(sig, "base64url");
  if (got.length !== expect.length || !timingSafeEqual(got, expect)) return null;
  try {
    const j = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as { p: string; s: string; e: number };
    return j.p === purpose && typeof j.s === "string" && j.e > Date.now() ? j.s : null;
  } catch {
    return null;
  }
}

export const signReviewToken = (reservationId: string) => sign("review", reservationId, 7 * 86_400_000);
export const readReviewToken = (t: string) => read("review", t);
