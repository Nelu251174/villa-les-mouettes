import { addDays, nightsBetween } from "./availability";

/**
 * Tarife stabilite de proprietar (02.10.2026). Preturile sunt in EUR / noapte pentru pana la 4 persoane (o familie).
 * Sezoanele au date ISO; AMBELE capete sunt INCLUSE ca nopti (noaptea zilei de sfarsit se taxeaza la pretul sezonului).
 * Un sejur care trece prin mai multe sezoane se calculeaza pe noapte. In afara sezoanelor se aplica BASE_PER_NIGHT.
 * Taxa de sejur si TVA NU sunt incluse (nedecise).
 */
export const BASE_PER_NIGHT = 1200;
export const SEASONS: { id: string; from: string; to: string; perNight: number }[] = [
  { id: "monte-carlo-masters-2027", from: "2027-04-01", to: "2027-04-12", perNight: 500 },
  { id: "grand-prix-2027", from: "2027-06-03", to: "2027-06-06", perNight: 3000 },
  { id: "christmas-2026", from: "2026-12-24", to: "2026-12-30", perNight: 1200 },
];
export const INCLUDED_GUESTS = 4;
export const EXTRA_PER_GUEST_PER_NIGHT = 200;
export const MIN_NIGHTS = 3; // in orice perioada a anului
export const MAX_GUESTS = 8;

export function rateForNight(iso: string): number {
  return SEASONS.find((s) => iso >= s.from && iso <= s.to)?.perNight ?? BASE_PER_NIGHT;
}

export type Price =
  | { ok: true; nights: number; guests: number; roomCents: number; extraCents: number; totalCents: number }
  | { ok: false; reason: "min_nights" | "max_guests" | "guests" | "dates" };

/** guests = adulti + copii (toti se numara). Valorile se calculeaza in cenți ca sa nu existe erori de rotunjire. */
export function priceStay(arrival: string, departure: string, guests: number): Price {
  if (!(departure > arrival)) return { ok: false, reason: "dates" };
  if (!Number.isInteger(guests) || guests < 1) return { ok: false, reason: "guests" };
  if (guests > MAX_GUESTS) return { ok: false, reason: "max_guests" };
  const nights = nightsBetween(arrival, departure);
  if (nights < MIN_NIGHTS) return { ok: false, reason: "min_nights" };
  let room = 0;
  for (let d = arrival; d < departure; d = addDays(d, 1)) room += rateForNight(d) * 100;
  const extra = Math.max(0, guests - INCLUDED_GUESTS) * EXTRA_PER_GUEST_PER_NIGHT * 100 * nights;
  return { ok: true, nights, guests, roomCents: room, extraCents: extra, totalCents: room + extra };
}
