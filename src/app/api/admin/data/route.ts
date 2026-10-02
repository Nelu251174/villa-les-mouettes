import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin";
import { listAudit, listBlocks, listOutbox, listReservations, listReviews } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const [reservations, reviews, blocks, audit, outbox] = await Promise.all([listReservations(), listReviews(), listBlocks(), listAudit(), listOutbox()]);
  const cfg = {
    mail: !!process.env.RESEND_API_KEY && !!process.env.VLM_MAIL_FROM,
    stripe: !!process.env.STRIPE_SECRET_KEY && !!process.env.STRIPE_WEBHOOK_SECRET,
    calendarLive: process.env.VLM_CALENDAR_DEMO !== "1",
  };
  return NextResponse.json({ reservations: reservations.reverse(), reviews: reviews.reverse(), blocks, audit: audit.slice(-50).reverse(), outbox: outbox.slice(-20).reverse(), cfg });
}
