import { NextResponse } from "next/server";
import { appendAudit, listReservations, patchReservation, setReservationStatus } from "@/lib/store";
import { callOwner } from "@/lib/call";
import { notifyOwner } from "@/lib/push";
import { ownerEmail, sendMail } from "@/lib/mail";
import { verifyStripeSignature } from "@/lib/stripe";

export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: "not_configured" }, { status: 503 });
  const payload = await req.text();
  if (!verifyStripeSignature(payload, req.headers.get("stripe-signature"), secret)) return NextResponse.json({ error: "bad_signature" }, { status: 400 });

  const ev = JSON.parse(payload) as { id: string; type: string; data: { object: { id: string; payment_status?: string; metadata?: { reservation_id?: string }; amount_total?: number } } };
  if (ev.type !== "checkout.session.completed") return NextResponse.json({ received: true });
  const s = ev.data.object;
  const id = s.metadata?.reservation_id;
  if (!id || s.payment_status !== "paid") return NextResponse.json({ received: true });

  const existing = (await listReservations()).find((r) => r.id === id);
  if (!existing || existing.status === "confirmed") return NextResponse.json({ received: true }); // idempotent

  const done = await setReservationStatus(id, "confirmed", {
    paidAt: new Date().toISOString(),
    stripeSessionId: s.id,
    amountCents: s.amount_total ?? existing.amountCents,
    invoiceDueAt: new Date(Date.now() + 5 * 60_000).toISOString(), // factura la ~5 min dupa plata
  });
  if (!done.ok) {
    // Plata incasata dar datele nu mai sunt libere: nu confirmam in tacere; proprietarul decide rambursarea.
    await patchReservation(id, { paidAt: new Date().toISOString(), stripeSessionId: s.id });
    await appendAudit({ actor: "stripe", action: "payment.conflict", target: id, result: "failed", reason: done.reason });
    if (ownerEmail()) await sendMail(ownerEmail(), "URGENT: plata primita pe date deja ocupate", `Rezervarea ${id} (${existing.arrival} → ${existing.departure}) a fost platita dar datele sunt ocupate. Ramburseaza in Stripe sau rezolva manual.`);
    void callOwner({ ro: "Urgent. S-a primit o plată pentru date deja ocupate la Villa Les Mouettes. Verifică aplicația.", en: "Urgent. A payment was received for dates that are already taken at Villa Les Mouettes. Check the app." }, { tag: `conflict-${id}` });
    void notifyOwner({ title: "URGENT: plată pe date ocupate", body: `Rezervarea ${existing.name} ${existing.arrival} → ${existing.departure} a fost plătită, dar datele sunt ocupate. Rambursează sau rezolvă.`, tag: `conflict-${id}`, url: "/admin?tab=rezervari" });
    return NextResponse.json({ received: true });
  }
  void notifyOwner({ title: "Plată primită", body: `${existing.name} · ${existing.arrival} → ${existing.departure} · confirmată`, tag: `paid-${id}`, url: "/admin?tab=rezervari" });
  await appendAudit({ actor: "stripe", action: "payment.confirmed", target: id, result: "confirmed" });
  return NextResponse.json({ received: true });
}
