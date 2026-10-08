import { NextResponse } from "next/server";
import { SITE } from "@/lib/site";
import { mailConfigured, sendMail } from "@/lib/mail";
import { listReservations, listReviews } from "@/lib/store";
import { secretConfigured, signReviewToken } from "@/lib/token";

// Magic-link: nimeni nu poate primi un link pentru adresa altcuiva. Raspunsul e identic indiferent
// daca exista sau nu o sedere potrivita (fara enumerare de adrese).
export async function POST(req: Request) {
  if (!mailConfigured() || !secretConfigured()) return NextResponse.json({ status: "unavailable" }, { status: 503 });
  const b = (await req.json().catch(() => ({}))) as { email?: unknown; lang?: unknown };
  const email = typeof b.email === "string" ? b.email.trim().toLowerCase() : "";
  const lang = b.lang === "fr" ? "fr" : "en";
  if (email.length > 200 || !email.includes("@")) return NextResponse.json({ status: "sent" });
  const reviewed = new Set((await listReviews()).map((r) => r.reservationId));
  const stay = (await listReservations()).find((r) => r.status === "confirmed" && !!r.paidAt && r.email.toLowerCase() === email && !reviewed.has(r.id));
  if (stay) {
    const token = signReviewToken(stay.id);
    const base = SITE.siteUrl;
    const link = `${base}/${lang}/review?token=${token}`;
    await sendMail(
      stay.email,
      lang === "fr" ? "Villa Les Mouettes — laissez votre avis" : "Villa Les Mouettes — leave your review",
      lang === "fr" ? `Merci pour votre séjour. Laissez votre avis (lien valable 7 jours) :\n${link}` : `Thank you for staying with us. Leave your review (link valid 7 days):\n${link}`,
    );
  }
  return NextResponse.json({ status: "sent" });
}
