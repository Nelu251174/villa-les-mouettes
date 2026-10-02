import "server-only";
import { sendMail } from "./mail";
import { listReservations, patchReservation, appendAudit } from "./store";
import { nightsBetween } from "./availability";

/** Factura ca text (PDF si date legale TVA/taxa de sejur: NEVERIFICAT, asteapta datele proprietarului). */
export async function sendDueInvoices(): Promise<{ sent: number; failed: number }> {
  let sent = 0, failed = 0;
  for (const r of await listReservations()) {
    if (r.status !== "confirmed" || !r.paidAt || r.invoiceSentAt || !r.invoiceDueAt || r.invoiceDueAt > new Date().toISOString()) continue;
    const eur = ((r.amountCents ?? 0) / 100).toFixed(2);
    const nights = nightsBetween(r.arrival, r.departure);
    const text = r.lang === "fr"
      ? `Facture — Villa Les Mouettes\n${r.name}\nSéjour ${r.arrival} → ${r.departure} (${nights} nuits)\nMontant payé : ${eur} EUR\nRéférence : ${r.id}`
      : `Invoice — Villa Les Mouettes\n${r.name}\nStay ${r.arrival} → ${r.departure} (${nights} nights)\nAmount paid: ${eur} EUR\nReference: ${r.id}`;
    const m = await sendMail(r.email, r.lang === "fr" ? "Villa Les Mouettes — votre facture" : "Villa Les Mouettes — your invoice", text);
    if (m.sent) {
      await patchReservation(r.id, { invoiceSentAt: new Date().toISOString() });
      await appendAudit({ actor: "system", action: "invoice.send", target: r.id, result: "sent" });
      sent++;
    } else {
      await appendAudit({ actor: "system", action: "invoice.send", target: r.id, result: "failed", reason: "mail" });
      failed++;
    }
  }
  return { sent, failed };
}
