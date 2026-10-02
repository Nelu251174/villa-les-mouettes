import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { type Range, demoBooked, addDays, toIso, rangeIsFree } from "./availability";

// Stocare minima pe fisiere JSON (de inlocuit cu o baza de date inainte de trafic real).
const DIR = process.env.VLM_DATA_DIR ?? path.join(process.cwd(), ".data");

export type Reservation = {
  id: string;
  status: "pending" | "confirmed" | "cancelled";
  arrival: string;
  departure: string;
  adults: number;
  children: number;
  name: string;
  email: string;
  notes: string;
  lang: "en" | "fr";
  createdAt: string;
  amountCents?: number;
  paidAt?: string;
  stripeSessionId?: string;
  invoiceDueAt?: string;
  invoiceSentAt?: string;
};
export type Review = { id: string; status: "pending" | "approved" | "hidden"; rating: number; name: string; text: string; reservationId: string; createdAt: string };
export type Block = { id: string; from: string; to: string; note: string; createdAt: string };
export type Audit = { at: string; actor: string; action: string; target: string; result: string; reason?: string };
export type Mail = { at: string; to: string; subject: string; text: string; sent: boolean; error?: string };

async function readJson<T>(file: string): Promise<T[]> {
  try {
    return JSON.parse(await fs.readFile(path.join(DIR, file), "utf8")) as T[];
  } catch {
    return [];
  }
}

// Scriere seriala + atomica (tmp + rename): doua cereri simultane nu se strica reciproc.
let chain: Promise<unknown> = Promise.resolve();
export function withLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = chain.then(fn, fn);
  chain = run.catch(() => undefined);
  return run;
}
async function writeJson(file: string, data: unknown): Promise<void> {
  await fs.mkdir(DIR, { recursive: true });
  const tmp = path.join(DIR, `${file}.${randomUUID()}.tmp`);
  await fs.writeFile(tmp, JSON.stringify(data, null, 2));
  await fs.rename(tmp, path.join(DIR, file));
}

export const listReservations = () => readJson<Reservation>("reservations.json");
export const listReviews = () => readJson<Review>("reviews.json");
export const listBlocks = () => readJson<Block>("blocks.json");
export const listAudit = () => readJson<Audit>("audit.json");
export const listOutbox = () => readJson<Mail>("outbox.json");

export function appendAudit(a: Omit<Audit, "at">): Promise<void> {
  return withLock(async () => {
    const all = await listAudit();
    all.push({ at: new Date().toISOString(), ...a });
    await writeJson("audit.json", all);
  });
}
export function appendMail(m: Mail): Promise<void> {
  return withLock(async () => {
    const all = await listOutbox();
    all.push(m);
    await writeJson("outbox.json", all);
  });
}

/** Calendarul e curat implicit: se blocheaza doar datele reale (rezervari confirmate + blocari din admin). Modelul DEMO apare doar cu VLM_CALENDAR_DEMO=1. */
export const calendarIsDemo = () => process.env.VLM_CALENDAR_DEMO === "1";

export function demoRanges(monthsAhead = 18): Range[] {
  const out: Range[] = [];
  const start = new Date();
  start.setDate(1);
  const end = new Date(start.getFullYear(), start.getMonth() + monthsAhead, 1);
  let open: string | null = null;
  let prev = "";
  for (const d = new Date(start); d < end; d.setDate(d.getDate() + 1)) {
    const iso = toIso(d);
    if (demoBooked(iso)) {
      if (!open) open = iso;
      prev = iso;
    } else if (open) {
      out.push({ from: open, to: prev });
      open = null;
    }
  }
  if (open) out.push({ from: open, to: prev });
  return out;
}

/** Nopti ocupate: rezervari confirmate + blocari ale proprietarului (+ DEMO daca e activ). */
export async function occupiedRanges(excludeId?: string): Promise<Range[]> {
  const res = (await listReservations()).filter((r) => r.status === "confirmed" && r.id !== excludeId).map((r) => ({ from: r.arrival, to: addDays(r.departure, -1) }));
  const blocks = (await listBlocks()).map((b) => ({ from: b.from, to: b.to }));
  return [...res, ...blocks, ...(calendarIsDemo() ? demoRanges() : [])];
}

const hit = (iso: string, rs: Range[]) => rs.some((r) => iso >= r.from && iso <= r.to);

export function createReservation(
  input: Omit<Reservation, "id" | "status" | "createdAt">,
): Promise<{ ok: true; reservation: Reservation } | { ok: false; reason: "dates_taken" }> {
  return withLock(async () => {
    const taken = await occupiedRanges();
    if (!rangeIsFree(input.arrival, input.departure, (d) => hit(d, taken))) return { ok: false as const, reason: "dates_taken" as const };
    const all = await listReservations();
    const reservation: Reservation = { ...input, id: randomUUID(), status: "pending", createdAt: new Date().toISOString() };
    all.push(reservation);
    await writeJson("reservations.json", all);
    return { ok: true as const, reservation };
  });
}

/** Confirma o rezervare doar daca nopțile sunt inca libere (previne dubla rezervare la confirmare). */
export function setReservationStatus(
  id: string,
  status: Reservation["status"],
  patch: Partial<Reservation> = {},
): Promise<{ ok: true; reservation: Reservation } | { ok: false; reason: "not_found" | "dates_taken" }> {
  return withLock(async () => {
    const all = await listReservations();
    const r = all.find((x) => x.id === id);
    if (!r) return { ok: false as const, reason: "not_found" as const };
    if (status === "confirmed" && r.status !== "confirmed") {
      const taken = await occupiedRanges(r.id);
      if (!rangeIsFree(r.arrival, r.departure, (d) => hit(d, taken))) return { ok: false as const, reason: "dates_taken" as const };
    }
    Object.assign(r, patch, { status });
    await writeJson("reservations.json", all);
    return { ok: true as const, reservation: r };
  });
}

export function patchReservation(id: string, patch: Partial<Reservation>): Promise<void> {
  return withLock(async () => {
    const all = await listReservations();
    const r = all.find((x) => x.id === id);
    if (r) Object.assign(r, patch);
    await writeJson("reservations.json", all);
  });
}

export function addBlock(from: string, to: string, note: string): Promise<Block> {
  return withLock(async () => {
    const all = await listBlocks();
    const b: Block = { id: randomUUID(), from, to, note: note.slice(0, 200), createdAt: new Date().toISOString() };
    all.push(b);
    await writeJson("blocks.json", all);
    return b;
  });
}
export function removeBlock(id: string): Promise<boolean> {
  return withLock(async () => {
    const all = await listBlocks();
    const next = all.filter((b) => b.id !== id);
    if (next.length === all.length) return false;
    await writeJson("blocks.json", next);
    return true;
  });
}

export function addReview(r: Omit<Review, "id" | "status" | "createdAt">): Promise<{ ok: true } | { ok: false; reason: "already_reviewed" }> {
  return withLock(async () => {
    const all = await listReviews();
    if (all.some((x) => x.reservationId === r.reservationId)) return { ok: false as const, reason: "already_reviewed" as const };
    all.push({ ...r, id: randomUUID(), status: "pending", createdAt: new Date().toISOString() });
    await writeJson("reviews.json", all);
    return { ok: true as const };
  });
}
export function setReviewStatus(id: string, status: Review["status"]): Promise<boolean> {
  return withLock(async () => {
    const all = await listReviews();
    const r = all.find((x) => x.id === id);
    if (!r) return false;
    r.status = status;
    await writeJson("reviews.json", all);
    return true;
  });
}
