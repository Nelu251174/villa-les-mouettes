import { NextResponse } from "next/server";
import { sendDueInvoices } from "@/lib/invoice";

// Se apeleaza din cron extern (ex. la 5 min) cu header x-cron-secret = VLM_CRON_SECRET.
export async function POST(req: Request) {
  const s = process.env.VLM_CRON_SECRET;
  if (!s || req.headers.get("x-cron-secret") !== s) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  return NextResponse.json(await sendDueInvoices());
}
