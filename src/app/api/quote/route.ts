import { NextResponse } from "next/server";
import { isIso, nightsBetween, rangeIsFree, toIso, isBookedIn } from "@/lib/availability";
import { amountCents, paymentConfigured } from "@/lib/stripe";
import { occupiedRanges } from "@/lib/store";

export const dynamic = "force-dynamic";

/** Raspuns server-side: datele alese sunt libere? Cat costa (doar daca proprietarul a setat tariful)? Plata e activa? */
export async function GET(req: Request) {
  const u = new URL(req.url);
  const arrival = u.searchParams.get("arrival"), departure = u.searchParams.get("departure");
  if (!isIso(arrival) || !isIso(departure) || departure <= arrival || arrival < toIso(new Date()) || nightsBetween(arrival, departure) > 60) {
    return NextResponse.json({ ok: false, error: "dates" }, { status: 422 });
  }
  const taken = await occupiedRanges();
  const available = rangeIsFree(arrival, departure, (d) => isBookedIn(d, taken));
  const payment = paymentConfigured();
  return NextResponse.json({
    ok: true,
    available,
    nights: nightsBetween(arrival, departure),
    payment,
    amountCents: available && payment ? amountCents({ arrival, departure }) : null,
    currency: "EUR",
  });
}
