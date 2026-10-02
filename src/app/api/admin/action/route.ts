import { NextResponse } from "next/server";
import { audit, isAdmin } from "@/lib/admin";
import { isIso } from "@/lib/availability";
import { sendDueInvoices } from "@/lib/invoice";
import { addBlock, patchReservation, removeBlock, setReservationStatus, setReviewStatus } from "@/lib/store";

type Body = { action?: string; id?: string; from?: string; to?: string; note?: string };

export async function POST(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  const b = (await req.json().catch(() => ({}))) as Body;
  const fail = async (error: string, status = 422) => {
    await audit(`admin.${b.action}`, b.id ?? `${b.from}..${b.to}`, "failed", error);
    return NextResponse.json({ ok: false, error }, { status });
  };
  switch (b.action) {
    case "reservation.confirm":
    case "reservation.cancel": {
      if (!b.id) return fail("id");
      const status = b.action === "reservation.confirm" ? "confirmed" : "cancelled";
      const r = await setReservationStatus(b.id, status);
      if (!r.ok) return fail(r.reason, r.reason === "not_found" ? 404 : 409);
      await audit(b.action, b.id, status);
      return NextResponse.json({ ok: true });
    }
    case "reservation.mark_paid": {
      // Proprietarul atesta o plata primita in afara Stripe (transfer etc.); ramane in audit.
      if (!b.id) return fail("id");
      await patchReservation(b.id, { paidAt: new Date().toISOString(), invoiceDueAt: new Date().toISOString() });
      await audit(b.action, b.id, "ok", "offline_payment_attested");
      return NextResponse.json({ ok: true });
    }
    case "block.add": {
      if (!isIso(b.from) || !isIso(b.to) || b.to < b.from) return fail("dates");
      const blk = await addBlock(b.from, b.to, typeof b.note === "string" ? b.note : "");
      await audit("block.add", blk.id, "ok");
      return NextResponse.json({ ok: true });
    }
    case "block.remove": {
      if (!b.id || !(await removeBlock(b.id))) return fail("not_found", 404);
      await audit("block.remove", b.id, "ok");
      return NextResponse.json({ ok: true });
    }
    case "review.approve":
    case "review.hide": {
      if (!b.id || !(await setReviewStatus(b.id, b.action === "review.approve" ? "approved" : "hidden"))) return fail("not_found", 404);
      await audit(b.action, b.id, "ok");
      return NextResponse.json({ ok: true });
    }
    case "invoice.run": {
      const out = await sendDueInvoices();
      await audit("invoice.run", "-", out.failed ? "failed" : "ok", `sent=${out.sent} failed=${out.failed}`);
      return NextResponse.json({ ok: true, ...out });
    }
    case "reservation.invoice_now": {
      if (!b.id) return fail("id");
      await patchReservation(b.id, { invoiceDueAt: new Date().toISOString(), invoiceSentAt: undefined });
      const out = await sendDueInvoices();
      await audit(b.action, b.id, out.sent ? "sent" : "failed");
      return NextResponse.json({ ok: out.sent > 0, ...out });
    }
    default:
      return fail("unknown_action", 400);
  }
}
