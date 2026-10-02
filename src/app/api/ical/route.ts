import { NextResponse } from "next/server";
import { addDays } from "@/lib/availability";
import { listBlocks, listReservations } from "@/lib/store";

export const dynamic = "force-dynamic";

// Export iCal (Airbnb/Booking pot importa feed-ul). Cere ?key=VLM_ICAL_KEY; fara cheie configurata, dezactivat.
export async function GET(req: Request) {
  const key = process.env.VLM_ICAL_KEY;
  if (!key || new URL(req.url).searchParams.get("key") !== key) return new NextResponse("forbidden", { status: 403 });
  const d = (iso: string) => iso.replaceAll("-", "");
  const ev: string[] = [];
  for (const r of await listReservations()) if (r.status === "confirmed") ev.push(vevent(`res-${r.id}`, d(r.arrival), d(r.departure), "Reserved"));
  for (const b of await listBlocks()) ev.push(vevent(`blk-${b.id}`, d(b.from), d(addDays(b.to, 1)), "Blocked"));
  const body = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Villa Les Mouettes//EN", ...ev, "END:VCALENDAR"].join("\r\n");
  return new NextResponse(body, { headers: { "content-type": "text/calendar; charset=utf-8" } });
}
function vevent(uid: string, s: string, e: string, sum: string) {
  return ["BEGIN:VEVENT", `UID:${uid}@villalesmouettes`, `DTSTART;VALUE=DATE:${s}`, `DTEND;VALUE=DATE:${e}`, `SUMMARY:${sum}`, "END:VEVENT"].join("\r\n");
}
