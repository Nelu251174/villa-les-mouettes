import { NextResponse } from "next/server";
import { addReview } from "@/lib/store";
import { readReviewToken } from "@/lib/token";

export async function POST(req: Request) {
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const reservationId = typeof b.token === "string" ? readReviewToken(b.token) : null;
  if (!reservationId) return NextResponse.json({ ok: false, error: "not_verified" }, { status: 403 });
  const rating = Number(b.rating);
  const name = typeof b.name === "string" ? b.name.trim() : "";
  const text = typeof b.text === "string" ? b.text.trim() : "";
  if (!Number.isInteger(rating) || rating < 1 || rating > 5 || name.length < 2 || name.length > 80 || text.length < 5 || text.length > 2000) {
    return NextResponse.json({ ok: false, error: "fields" }, { status: 422 });
  }
  const r = await addReview({ rating, name, text, reservationId });
  if (!r.ok) return NextResponse.json({ ok: false, error: r.reason }, { status: 409 });
  // Intra ca "pending": apare public doar dupa aprobarea proprietarului.
  return NextResponse.json({ ok: true, status: "pending" }, { status: 201 });
}
