import { createHmac } from "node:crypto";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

process.env.VLM_DATA_DIR = mkdtempSync(path.join(tmpdir(), "vlm-"));
process.env.VLM_SECRET = "x".repeat(40);

let store: typeof import("../src/lib/store");
let stripe: typeof import("../src/lib/stripe");
let token: typeof import("../src/lib/token");
beforeAll(async () => {
  store = await import("../src/lib/store");
  stripe = await import("../src/lib/stripe");
  token = await import("../src/lib/token");
});

const guest = (arrival: string, departure: string) => ({ arrival, departure, adults: 2, children: 0, name: "A B", email: "a@b.co", notes: "", lang: "en" as const });

describe("rezervari", () => {
  it("o confirmare blocheaza datele; o a doua cerere pe aceleasi nopti e respinsa", async () => {
    const a = await store.createReservation(guest("2031-07-10", "2031-07-14"));
    expect(a.ok).toBe(true);
    if (!a.ok) return;
    expect((await store.setReservationStatus(a.reservation.id, "confirmed")).ok).toBe(true);
    const clash = await store.createReservation(guest("2031-07-12", "2031-07-16"));
    expect(clash).toEqual({ ok: false, reason: "dates_taken" });
    expect((await store.createReservation(guest("2031-07-14", "2031-07-16"))).ok).toBe(true); // plecare = sosire urmatoare
  });
  it("doua cereri simultane pe aceleasi date: exact una trece la confirmare", async () => {
    const [x, y] = await Promise.all([store.createReservation(guest("2031-08-01", "2031-08-05")), store.createReservation(guest("2031-08-01", "2031-08-05"))]);
    // ambele sunt 'pending' (nu blocheaza); confirmarea e cea care protejeaza
    expect(x.ok && y.ok).toBe(true);
    if (!x.ok || !y.ok) return;
    const c = await Promise.all([store.setReservationStatus(x.reservation.id, "confirmed"), store.setReservationStatus(y.reservation.id, "confirmed")]);
    expect(c.filter((r) => r.ok)).toHaveLength(1);
  });
  it("blocarile proprietarului ocupa noptile", async () => {
    await store.addBlock("2031-09-01", "2031-09-03", "test");
    expect((await store.createReservation(guest("2031-09-02", "2031-09-04"))).ok).toBe(false);
  });
  it("o singura recenzie pe sedere", async () => {
    const r = { rating: 5, name: "A B", text: "super", reservationId: "R1" };
    expect((await store.addReview(r)).ok).toBe(true);
    expect((await store.addReview(r)).ok).toBe(false);
  });
});

describe("tokenuri", () => {
  it("scopurile nu sunt interschimbabile si semnatura falsa e respinsa", () => {
    const t = token.sign("admin", "owner", 60_000)!;
    expect(token.read("admin", t)).toBe("owner");
    expect(token.read("review", t)).toBeNull();
    expect(token.read("admin", t.slice(0, -2) + "xx")).toBeNull();
    expect(token.read("admin", token.sign("admin", "owner", -1)!)).toBeNull();
  });
});

describe("semnatura Stripe", () => {
  const secret = "whsec_test";
  const body = '{"id":"evt_1"}';
  const header = (t: number) => `t=${t},v1=${createHmac("sha256", secret).update(`${t}.${body}`).digest("hex")}`;
  it("accepta semnatura corecta, respinge corp modificat, secret gresit si semnatura veche", () => {
    const now = 1_800_000_000_000, t = now / 1000;
    expect(stripe.verifyStripeSignature(body, header(t), secret, now)).toBe(true);
    expect(stripe.verifyStripeSignature(body + " ", header(t), secret, now)).toBe(false);
    expect(stripe.verifyStripeSignature(body, header(t), "other", now)).toBe(false);
    expect(stripe.verifyStripeSignature(body, header(t - 3600), secret, now)).toBe(false);
    expect(stripe.verifyStripeSignature(body, null, secret, now)).toBe(false);
  });
});
