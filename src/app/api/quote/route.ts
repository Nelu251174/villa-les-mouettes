import { NextResponse } from "next/server";
import { isIso, nightsBetween, rangeIsFree, toIso, isBookedIn } from "@/lib/availability";
import { MAX_GUESTS, MIN_NIGHTS, priceStay } from "@/lib/pricing";
import { paymentConfigured } from "@/lib/stripe";
import { occupiedRanges } from "@/lib/store";

export const dynamic = "force-dynamic";

/** Server-side: datele sunt libere? Respecta minimul de nopti? Cat costa pentru numarul de persoane? Plata online e activa? */
export async function GET(req: Request) {
  const u = new URL(req.url);
  const arrival = u.searchParams.get("arrival"), departure = u.searchParams.get("departure");
  const guests = Number(u.searchParams.get("guests") ?? "2");
  if (!isIso(arrival) || !isIso(departure) || departure <= arrival || arrival < toIso(new Date()) || nightsBetween(arrival, departure) > 60) {
    return NextResponse.json({ ok: false, error: "dates" }, { status: 422 });
  }
  const taken = await occupiedRanges();
  const available = rangeIsFree(arrival, departure, (d) => isBookedIn(d, taken));
  const price = priceStay(arrival, departure, guests);
  return NextResponse.json({
    ok: true,
    available,
    nights: nightsBetween(arrival, departure),
    minNights: MIN_NIGHTS,
    maxGuests: MAX_GUESTS,
    rule: price.ok ? null : price.reason, // min_nights | max_guests | guests
    payment: paymentConfigured(),
    amountCents: available && price.ok ? price.totalCents : null,
    extraCents: available && price.ok ? price.extraCents : null,
    currency: "EUR",
  });
}
