// Logica pura a calendarului. Datele sunt ISO "YYYY-MM-DD" (fara fus orar, comparate ca siruri).

export type Range = { from: string; to: string }; // ambele zile inclusiv

export function toIso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function addDays(iso: string, n: number): string {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + n);
  return toIso(d);
}

export function nightsBetween(arrival: string, departure: string): number {
  const a = new Date(arrival + "T00:00:00").getTime();
  const b = new Date(departure + "T00:00:00").getTime();
  return Math.round((b - a) / 86_400_000);
}

export function isIso(s: unknown): s is string {
  if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(s + "T00:00:00");
  return !Number.isNaN(d.getTime()) && toIso(d) === s;
}

/** DEMO: modelul din prototip. NU este calendarul real; se afiseaza marcat DEMO. */
export function demoBooked(iso: string): boolean {
  const d = new Date(iso + "T00:00:00");
  const day = d.getDate();
  const m = d.getMonth();
  return (day >= 3 + (m % 3) && day <= 6 + (m % 3)) || (day >= 18 && day <= 20 + (m % 2));
}

export function isBookedIn(iso: string, ranges: Range[]): boolean {
  return ranges.some((r) => iso >= r.from && iso <= r.to);
}

/**
 * Un sejur arrival→departure ocupa noptile [arrival, departure). Ziua de plecare poate fi
 * ocupata de urmatorul oaspete, deci nu conteaza; orice noapte ocupata invalideaza intervalul.
 */
export function rangeIsFree(arrival: string, departure: string, isBooked: (iso: string) => boolean): boolean {
  if (departure <= arrival) return false;
  for (let d = arrival; d < departure; d = addDays(d, 1)) {
    if (isBooked(d)) return false;
  }
  return true;
}

export type PickResult = { arrival: string | null; departure: string | null };

/** Regulile din brief: click 1 = sosire; click ulterior = plecare; click anterior sau interval cu zi ocupata = reset. */
export function pickDate(
  state: PickResult,
  iso: string,
  isBooked: (iso: string) => boolean,
): PickResult {
  const { arrival, departure } = state;
  if (!arrival || departure || iso <= arrival) return { arrival: iso, departure: null };
  if (!rangeIsFree(arrival, iso, isBooked)) return { arrival: iso, departure: null };
  return { arrival, departure: iso };
}
