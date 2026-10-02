import { NextResponse } from "next/server";
import { calendarIsDemo, occupiedRanges } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ demo: calendarIsDemo(), ranges: await occupiedRanges() });
}
