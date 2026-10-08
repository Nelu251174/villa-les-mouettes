import "server-only";
import { cookies } from "next/headers";
import { timingSafeEqual } from "node:crypto";
import { read, sign } from "./token";
import { appendAudit } from "./store";

export const ADMIN_COOKIE = "vlm_admin";

export const adminConfigured = () => !!process.env.VLM_ADMIN_PASSWORD && process.env.VLM_ADMIN_PASSWORD.length >= 12 && !!process.env.VLM_SECRET;

export function passwordOk(input: string): boolean {
  const a = Buffer.from(input), b = Buffer.from(process.env.VLM_ADMIN_PASSWORD ?? "");
  return a.length === b.length && a.length > 0 && timingSafeEqual(a, b);
}
export const makeSession = () => sign("admin", "owner", 14 * 86_400_000);
export async function isAdmin(): Promise<boolean> {
  const c = (await cookies()).get(ADMIN_COOKIE)?.value;
  return !!c && read("admin", c) === "owner";
}

// frana simpla anti brute-force: 5 incercari / 10 min per IP (in memorie)
const tries = new Map<string, number[]>();
export function loginAllowed(ip: string): boolean {
  const now = Date.now();
  const recent = (tries.get(ip) ?? []).filter((t) => now - t < 600_000);
  recent.push(now);
  tries.set(ip, recent);
  return recent.length <= 5;
}

export const audit = (action: string, target: string, result: string, reason?: string) => appendAudit({ actor: "owner", action, target, result, reason });
