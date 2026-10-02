import { describe, expect, it } from "vitest";
import { addDays, isIso, nightsBetween, pickDate, rangeIsFree } from "../src/lib/availability";

const booked = new Set(["2030-06-10", "2030-06-11"]);
const isBooked = (d: string) => booked.has(d);

describe("availability", () => {
  it("valideaza date ISO reale", () => {
    expect(isIso("2030-02-30")).toBe(false);
    expect(isIso("2030-06-10")).toBe(true);
    expect(isIso("10/06/2030")).toBe(false);
  });
  it("numara noptile", () => {
    expect(nightsBetween("2030-06-01", "2030-06-08")).toBe(7);
    expect(addDays("2030-06-30", 1)).toBe("2030-07-01");
  });
  it("respinge un interval care traverseaza zile ocupate", () => {
    expect(rangeIsFree("2030-06-08", "2030-06-13", isBooked)).toBe(false);
    expect(rangeIsFree("2030-06-01", "2030-06-08", isBooked)).toBe(true);
  });
  it("permite plecarea in prima zi ocupata (noaptea nu se consuma)", () => {
    expect(rangeIsFree("2030-06-08", "2030-06-10", isBooked)).toBe(true);
  });
  it("respinge plecare <= sosire", () => {
    expect(rangeIsFree("2030-06-08", "2030-06-08", isBooked)).toBe(false);
  });
  it("pickDate: sosire, plecare, reset", () => {
    let s = pickDate({ arrival: null, departure: null }, "2030-06-01", isBooked);
    expect(s).toEqual({ arrival: "2030-06-01", departure: null });
    s = pickDate(s, "2030-06-05", isBooked);
    expect(s.departure).toBe("2030-06-05");
    s = pickDate(s, "2030-06-20", isBooked); // dupa un interval complet -> reset
    expect(s).toEqual({ arrival: "2030-06-20", departure: null });
    s = pickDate(s, "2030-06-15", isBooked); // mai devreme -> reset
    expect(s.arrival).toBe("2030-06-15");
    const crossing = pickDate({ arrival: "2030-06-08", departure: null }, "2030-06-13", isBooked);
    expect(crossing).toEqual({ arrival: "2030-06-13", departure: null });
  });
});
