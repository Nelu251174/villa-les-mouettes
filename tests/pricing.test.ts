import { describe, expect, it } from "vitest";
import { priceStay } from "../src/lib/pricing";

const total = (a: string, d: string, g: number) => {
  const p = priceStay(a, d, g);
  if (!p.ok) throw new Error(p.reason);
  return p.totalCents / 100;
};

describe("tarife", () => {
  it("restul anului: 1200 / noapte pentru 4 persoane", () => {
    expect(total("2026-11-10", "2026-11-15", 4)).toBe(6000);
    expect(total("2026-11-10", "2026-11-15", 2)).toBe(6000); // sub 4 persoane nu scade
  });
  it("8 persoane: +200 / persoana / noapte peste 1200", () => {
    expect(total("2026-11-10", "2026-11-15", 8)).toBe(10000); // 5 x (1200 + 4x200)
    expect(total("2026-11-10", "2026-11-15", 5)).toBe(7000);
  });
  it("aprilie 2027 (Masters): 500 / noapte", () => {
    expect(total("2027-04-03", "2027-04-06", 4)).toBe(1500);
    expect(total("2027-04-03", "2027-04-06", 8)).toBe(1500 + 3 * 800);
  });
  it("sejur care trece prin mai multe sezoane: pe noapte", () => {
    // 30.03, 31.03 la 1200; 01.04 la 500
    expect(total("2027-03-30", "2027-04-02", 4)).toBe(2900);
    // ultima noapte 12.04 inclusa la 500, 13.04 la 1200
    expect(total("2027-04-11", "2027-04-14", 4)).toBe(500 + 500 + 1200);
  });
  it("iunie 2027 (3-6 iunie): 3000 / noapte, noaptea de 6 inclusa", () => {
    expect(total("2027-06-03", "2027-06-06", 4)).toBe(9000); // nopti 3,4,5
    expect(total("2027-06-03", "2027-06-07", 4)).toBe(12000); // + noaptea de 6
  });
  it("decembrie 2026 (24-30): 1200 / noapte", () => {
    expect(total("2026-12-24", "2026-12-31", 4)).toBe(8400);
  });
  it("minim 3 nopti in orice perioada", () => {
    expect(priceStay("2026-11-10", "2026-11-12", 4)).toEqual({ ok: false, reason: "min_nights" });
    expect(priceStay("2027-06-03", "2027-06-05", 4)).toEqual({ ok: false, reason: "min_nights" });
    expect(priceStay("2026-11-10", "2026-11-13", 4).ok).toBe(true);
  });
  it("maxim 8 persoane; date si numar de persoane invalide", () => {
    expect(priceStay("2026-11-10", "2026-11-15", 9)).toEqual({ ok: false, reason: "max_guests" });
    expect(priceStay("2026-11-10", "2026-11-15", 0)).toEqual({ ok: false, reason: "guests" });
    expect(priceStay("2026-11-15", "2026-11-10", 4)).toEqual({ ok: false, reason: "dates" });
  });
});
