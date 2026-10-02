"use client";

import { useCallback, useEffect, useState } from "react";

type Res = { id: string; status: string; arrival: string; departure: string; adults: number; children: number; name: string; email: string; notes: string; createdAt: string; paidAt?: string; invoiceSentAt?: string; amountCents?: number };
type Rev = { id: string; status: string; rating: number; name: string; text: string };
type Blk = { id: string; from: string; to: string; note: string };
type Aud = { at: string; actor: string; action: string; target: string; result: string; reason?: string };
type Mail = { at: string; to: string; subject: string; sent: boolean; error?: string };
type Data = { reservations: Res[]; reviews: Rev[]; blocks: Blk[]; audit: Aud[]; outbox: Mail[]; cfg: { mail: boolean; stripe: boolean; calendarLive: boolean } };

export default function AdminPanel({ authed }: { authed: boolean }) {
  const [ok, setOk] = useState(authed);
  const [pw, setPw] = useState("");
  const [data, setData] = useState<Data | null>(null);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState<string | null>(null); // idle -> in curs (cheia actiunii) -> rezultat in msg
  const [blk, setBlk] = useState({ from: "", to: "", note: "" });

  const load = useCallback(async () => {
    const r = await fetch("/api/admin/data");
    if (r.status === 401) return setOk(false);
    setData((await r.json()) as Data);
  }, []);
  useEffect(() => {
    if (!ok) return;
    let live = true;
    fetch("/api/admin/data").then(async (r) => {
      if (!live) return;
      if (r.status === 401) setOk(false); else setData((await r.json()) as Data);
    });
    return () => { live = false; };
  }, [ok]);

  async function login() {
    setBusy("login"); setMsg("");
    const r = await fetch("/api/admin/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ password: pw }) });
    setBusy(null);
    if (r.ok) { setPw(""); setOk(true); } else setMsg(r.status === 429 ? "Too many attempts. Try again in 10 minutes." : r.status === 503 ? "Admin not configured." : "Wrong password.");
  }
  async function act(key: string, body: Record<string, unknown>) {
    if (busy) return;
    setBusy(key); setMsg("");
    try {
      const r = await fetch("/api/admin/action", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const j = (await r.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      setMsg(r.ok && j.ok ? `Done: ${body.action}` : `Failed: ${body.action} (${j.error ?? r.status})`);
      await load();
    } catch { setMsg(`Failed: ${body.action} (network)`); }
    setBusy(null);
  }

  if (!ok) {
    return (
      <main className="wrap" style={{ padding: "84px var(--gutter)", maxWidth: 480 }}>
        <h1 className="h2" style={{ marginBottom: 28 }}>Admin</h1>
        <form onSubmit={(e) => { e.preventDefault(); void login(); }}>
          <label className="field">Password<input className="input" type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="current-password" disabled={busy === "login"} /></label>
          {msg && <p className="err" role="alert">{msg}</p>}
          <div style={{ marginTop: 20 }}><button className="btn btn-primary" disabled={busy === "login" || !pw}>{busy === "login" ? "…" : "Sign in"}</button></div>
        </form>
      </main>
    );
  }
  if (!data) return <main className="wrap" style={{ padding: 84 }}><p className="muted">Loading…</p></main>;

  const B = (k: string, body: Record<string, unknown>, label: string, ghost?: boolean) => (
    <button key={k} type="button" className={`btn ${ghost ? "btn-ghost" : "btn-primary"}`} style={{ padding: "6px 12px", fontSize: 13 }} disabled={!!busy} onClick={() => void act(k, body)}>{busy === k ? "…" : label}</button>
  );
  const h = { fontSize: 22, lineHeight: "28px", margin: "56px 0 14px" } as const;
  const cell = { padding: "8px 10px 8px 0", borderTop: "1px solid var(--color-neutral-400)", fontSize: 14, lineHeight: "20px", verticalAlign: "top" } as const;

  return (
    <main className="wrap" style={{ padding: "56px var(--gutter) 98px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 14, flexWrap: "wrap" }}>
        <h1 className="h2">Admin — Villa Les Mouettes</h1>
        <button className="btn btn-ghost" onClick={async () => { await fetch("/api/admin/logout", { method: "POST" }); setOk(false); }}>Sign out</button>
      </div>
      <p className="label muted" style={{ margin: "14px 0 0" }}>
        Email: {data.cfg.mail ? "configured" : "NOT configured (messages stay in outbox, not delivered)"} · Stripe: {data.cfg.stripe ? "configured" : "NOT configured"} · Calendar: {data.cfg.calendarLive ? "live" : "DEMO pattern shown to guests"}
      </p>
      {msg && <p role="status" className="label" style={{ margin: "14px 0 0", color: "var(--color-accent-700)" }}>{msg}</p>}

      <h2 className="display" style={h}>Reservations ({data.reservations.length})</h2>
      <div style={{ overflowX: "auto" }}><table style={{ borderCollapse: "collapse", width: "100%", minWidth: 760 }}><tbody>
        {data.reservations.map((r) => (
          <tr key={r.id}>
            <td style={cell}><b>{r.arrival} → {r.departure}</b><br /><span className="muted">{r.adults}+{r.children}</span></td>
            <td style={cell}>{r.name}<br /><span className="muted">{r.email}</span>{r.notes && <><br /><span className="muted">“{r.notes}”</span></>}</td>
            <td style={cell}><b>{r.status}</b><br /><span className="muted">{r.paidAt ? `paid ${r.paidAt.slice(0, 10)}` : "unpaid"}{r.invoiceSentAt ? " · invoice sent" : ""}</span></td>
            <td style={{ ...cell, display: "flex", gap: 6, flexWrap: "wrap" }}>
              {r.status !== "confirmed" && B(`c${r.id}`, { action: "reservation.confirm", id: r.id }, "Confirm")}
              {r.status !== "cancelled" && B(`x${r.id}`, { action: "reservation.cancel", id: r.id }, "Cancel", true)}
              {r.status === "confirmed" && !r.paidAt && B(`p${r.id}`, { action: "reservation.mark_paid", id: r.id }, "Mark paid (offline)", true)}
              {r.paidAt && !r.invoiceSentAt && B(`i${r.id}`, { action: "reservation.invoice_now", id: r.id }, "Send invoice", true)}
            </td>
          </tr>
        ))}
        {data.reservations.length === 0 && <tr><td className="muted" style={cell}>None yet.</td></tr>}
      </tbody></table></div>

      <h2 className="display" style={h}>Blocked dates</h2>
      <form style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "end" }} onSubmit={(e) => { e.preventDefault(); void act("block", { action: "block.add", ...blk }).then(() => setBlk({ from: "", to: "", note: "" })); }}>
        <label className="field">From<input className="input" type="date" value={blk.from} onChange={(e) => setBlk({ ...blk, from: e.target.value })} /></label>
        <label className="field">To (inclusive)<input className="input" type="date" value={blk.to} onChange={(e) => setBlk({ ...blk, to: e.target.value })} /></label>
        <label className="field">Note<input className="input" value={blk.note} onChange={(e) => setBlk({ ...blk, note: e.target.value })} /></label>
        <button className="btn btn-primary" disabled={!!busy || !blk.from || !blk.to}>{busy === "block" ? "…" : "Block"}</button>
      </form>
      {data.blocks.map((b) => (
        <p key={b.id} style={{ margin: "10px 0 0", display: "flex", gap: 12, alignItems: "center" }}>{b.from} → {b.to} <span className="muted">{b.note}</span>{B(`b${b.id}`, { action: "block.remove", id: b.id }, "Remove", true)}</p>
      ))}

      <h2 className="display" style={h}>Reviews ({data.reviews.length})</h2>
      {data.reviews.map((v) => (
        <div key={v.id} style={{ borderTop: "1px solid var(--color-neutral-400)", padding: "10px 0", display: "flex", gap: 14, justifyContent: "space-between", flexWrap: "wrap" }}>
          <div><b>{"★".repeat(v.rating)}</b> {v.name} — <i>{v.status}</i><br /><span className="muted">{v.text}</span></div>
          <div style={{ display: "flex", gap: 6 }}>
            {v.status !== "approved" && B(`a${v.id}`, { action: "review.approve", id: v.id }, "Approve")}
            {v.status !== "hidden" && B(`h${v.id}`, { action: "review.hide", id: v.id }, "Hide", true)}
          </div>
        </div>
      ))}
      {data.reviews.length === 0 && <p className="muted">None yet.</p>}

      <h2 className="display" style={h}>Invoices</h2>
      {B("inv", { action: "invoice.run" }, "Send all due invoices now")}

      <h2 className="display" style={h}>Outbox (last 20)</h2>
      {data.outbox.map((m, i) => <p key={i} className="muted" style={{ margin: "6px 0", fontSize: 13.5 }}>{m.at.slice(0, 16)} · {m.to} · {m.subject} · <b>{m.sent ? "delivered to provider" : `NOT sent (${m.error})`}</b></p>)}

      <h2 className="display" style={h}>Audit (last 50)</h2>
      {data.audit.map((a, i) => <p key={i} className="muted" style={{ margin: "6px 0", fontSize: 13.5 }}>{a.at.slice(0, 19)} · {a.actor} · {a.action} · {a.target} · <b>{a.result}</b>{a.reason ? ` (${a.reason})` : ""}</p>)}
    </main>
  );
}
