import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { priceStay } from "./pricing";
import { SITE } from "./site";
import type { Reservation } from "./store";

/** Plata e disponibila doar cu cheie Stripe si adresa site-ului setate. Suma vine din tarifar (src/lib/pricing.ts). */
export function paymentConfigured(): boolean {
  return !!process.env.STRIPE_SECRET_KEY;
}

/** Totalul sejurului in cenți sau null daca regulile (minim nopti / maxim persoane) nu sunt respectate. */
export function amountCents(r: Pick<Reservation, "arrival" | "departure" | "adults" | "children">): number | null {
  const p = priceStay(r.arrival, r.departure, r.adults + r.children);
  return p.ok ? p.totalCents : null;
}

export async function createCheckout(r: Reservation): Promise<{ url: string; sessionId: string } | null> {
  if (!paymentConfigured()) return null;
  const amount = amountCents(r);
  if (amount === null) return null;
  const base = SITE.siteUrl;
  const body = new URLSearchParams({
    mode: "payment",
    "payment_method_types[0]": "card",
    "payment_method_options[card][request_three_d_secure]": "any", // SCA/3DS cerut explicit
    customer_email: r.email,
    client_reference_id: r.id,
    "metadata[reservation_id]": r.id,
    success_url: `${base}/${r.lang}?paid=1`,
    cancel_url: `${base}/${r.lang}#booking`,
    "line_items[0][quantity]": "1",
    "line_items[0][price_data][currency]": "eur",
    "line_items[0][price_data][unit_amount]": String(amount),
    "line_items[0][price_data][product_data][name]": `Villa Les Mouettes ${r.arrival} → ${r.departure}`,
  });
  try {
    const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: { authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`, "content-type": "application/x-www-form-urlencoded", "idempotency-key": `vlm-${r.id}` },
      body,
    });
    if (!res.ok) return null;
    const j = (await res.json()) as { url?: string; id?: string };
    return j.url && j.id ? { url: j.url, sessionId: j.id } : null;
  } catch {
    return null;
  }
}

/** Verifica semnatura Stripe-Signature (t=..,v1=..) cu toleranta de 5 minute. */
export function verifyStripeSignature(payload: string, header: string | null, secret: string, now = Date.now()): boolean {
  if (!header) return false;
  const parts = Object.fromEntries(header.split(",").map((p) => p.split("=") as [string, string]));
  const t = parts.t, v1 = header.split(",").filter((p) => p.startsWith("v1=")).map((p) => p.slice(3));
  if (!t || v1.length === 0 || Math.abs(now / 1000 - Number(t)) > 300) return false;
  const expect = createHmac("sha256", secret).update(`${t}.${payload}`).digest();
  return v1.some((s) => {
    const got = Buffer.from(s, "hex");
    return got.length === expect.length && timingSafeEqual(got, expect);
  });
}
