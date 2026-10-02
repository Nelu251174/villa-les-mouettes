import "server-only";
import { appendMail } from "./store";

/**
 * Trimite prin Resend daca exista RESEND_API_KEY + VLM_MAIL_FROM. Altfel NU trimite:
 * mesajul ramane in outbox.json cu sent=false, iar apelantul primeste sent=false (nu pretindem livrare).
 */
export async function sendMail(to: string, subject: string, text: string): Promise<{ sent: boolean }> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.VLM_MAIL_FROM;
  if (!key || !from) {
    await appendMail({ at: new Date().toISOString(), to, subject, text, sent: false, error: "mail_not_configured" });
    return { sent: false };
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({ from, to: [to], subject, text }),
    });
    const ok = res.ok;
    await appendMail({ at: new Date().toISOString(), to, subject, text, sent: ok, error: ok ? undefined : `resend_${res.status}` });
    return { sent: ok };
  } catch (e) {
    await appendMail({ at: new Date().toISOString(), to, subject, text, sent: false, error: e instanceof Error ? e.message : "network" });
    return { sent: false };
  }
}

export const mailConfigured = () => !!process.env.RESEND_API_KEY && !!process.env.VLM_MAIL_FROM;
export const ownerEmail = () => process.env.VLM_OWNER_EMAIL ?? "";

type R = { arrival: string; departure: string; adults: number; children: number; name: string; email: string; notes: string; lang: "en" | "fr" };

export function clientConfirmation(r: R): { subject: string; text: string } {
  return r.lang === "fr"
    ? { subject: "Villa Les Mouettes — demande de réservation reçue", text: `Bonjour ${r.name},\n\nNous avons bien reçu votre demande du ${r.arrival} au ${r.departure} (${r.adults} adultes, ${r.children} enfants). Ceci est une preuve de demande, pas une confirmation de séjour : le propriétaire reviendra vers vous sous 24 heures.\n\nVilla Les Mouettes` }
    : { subject: "Villa Les Mouettes — reservation request received", text: `Hello ${r.name},\n\nWe received your request for ${r.arrival} to ${r.departure} (${r.adults} adults, ${r.children} children). This is proof of your request, not a confirmed stay: the owner will come back to you within 24 hours.\n\nVilla Les Mouettes` };
}
export function ownerNotification(r: R, id: string): { subject: string; text: string } {
  return { subject: `Nouvelle demande ${r.arrival} → ${r.departure} — ${r.name}`, text: `Demande ${id}\n${r.arrival} → ${r.departure}\nAdultes ${r.adults}, enfants ${r.children}\n${r.name} <${r.email}>\nNotes: ${r.notes || "-"}` };
}
