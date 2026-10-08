import { NextResponse } from "next/server";
import { isIso, nightsBetween, toIso } from "@/lib/availability";
import { MAX_GUESTS, MIN_NIGHTS, priceStay } from "@/lib/pricing";
import { clientConfirmation, ownerEmail, ownerNotification, sendMail } from "@/lib/mail";
import { callOwner } from "@/lib/call";
import { notifyOwner } from "@/lib/push";
import { createCheckout } from "@/lib/stripe";
import { appendAudit, createReservation, patchReservation } from "@/lib/store";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export async function POST(req: Request) {
  let b: Record<string, unknown>;
  try {
    b = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }
  const arrival = b.arrival, departure = b.departure;
  const name = typeof b.name === "string" ? b.name.trim() : "";
  const email = typeof b.email === "string" ? b.email.trim() : "";
  const notes = typeof b.notes === "string" ? b.notes.trim().slice(0, 1000) : "";
  const adults = Number(b.adults), children = Number(b.children);
  const lang = b.lang === "fr" ? "fr" : "en";

  if (!isIso(arrival) || !isIso(departure) || departure <= arrival || arrival < toIso(new Date()) || nightsBetween(arrival, departure) > 60) {
    return NextResponse.json({ ok: false, error: "dates" }, { status: 422 });
  }
  if (name.length < 2 || name.length > 120 || !EMAIL.test(email) || email.length > 200 || !Number.isInteger(adults) || adults < 1 || adults > 6 || !Number.isInteger(children) || children < 0 || children > 4) {
    return NextResponse.json({ ok: false, error: "fields" }, { status: 422 });
  }

  const price = priceStay(arrival, departure, adults + children);
  if (!price.ok) {
    return NextResponse.json({ ok: false, error: price.reason === "min_nights" ? "min_nights" : price.reason === "max_guests" ? "max_guests" : "fields", minNights: MIN_NIGHTS, maxGuests: MAX_GUESTS }, { status: 422 });
  }

  const res = await createReservation({ arrival, departure, adults, children, name, email, notes, lang });
  if (!res.ok) return NextResponse.json({ ok: false, error: "dates_taken" }, { status: 409 });
  const r = res.reservation;
  await patchReservation(r.id, { amountCents: price.totalCents });
  await appendAudit({ actor: "guest", action: "reservation.create", target: r.id, result: "pending" });
  // Alerta pe telefon: nu blocheaza raspunsul si nu poate sa-l strice.
  void notifyOwner({
    title: "Rezervare nouă",
    body: `${name} · ${arrival} → ${departure} · ${adults + children} pers. · ${(price.totalCents / 100).toLocaleString("ro-RO")} EUR`,
    tag: `res-${r.id}`,
    url: "/admin?tab=azi",
  });
  void callOwner(
    { ro: `Rezervare nouă la Villa Les Mouettes. ${name.replace(/[^\p{L}\p{N} .'-]/gu, "").slice(0, 40)}, ${nightsBetween(arrival, departure)} nopți, din ${arrival}. Deschide aplicația.`, en: `New reservation request at Villa Les Mouettes. ${nightsBetween(arrival, departure)} nights from ${arrival}. Open the app.` },
    { tag: `res-${r.id}` },
  );

  // Raspunsul spune exact ce s-a intamplat: sent = livrat de furnizor, nu "pus in coada".
  const c = clientConfirmation(r);
  const clientMail = await sendMail(email, c.subject, c.text);
  const o = ownerNotification(r, r.id);
  const owner = ownerEmail() ? await sendMail(ownerEmail(), o.subject, o.text) : { sent: false };

  const checkout = await createCheckout(r);
  if (checkout) await patchReservation(r.id, { stripeSessionId: checkout.sessionId, amountCents: price.totalCents });

  return NextResponse.json(
    { ok: true, id: r.id, status: r.status, payment: checkout ? { available: true, url: checkout.url } : { available: false }, emails: { client: clientMail.sent, owner: owner.sent } },
    { status: 201 },
  );
}
