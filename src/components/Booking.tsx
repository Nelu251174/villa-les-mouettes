"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { I18N, type Lang } from "@/lib/content";
import { SITE } from "@/lib/site";
import { type Range, isBookedIn, pickDate, rangeIsFree, toIso, addDays } from "@/lib/availability";

type Pay = { url: string | null; emailSent: boolean };
type Phase = "idle" | "sending" | "sent" | "failed";

export default function Booking({ lang }: { lang: Lang }) {
  const t = I18N[lang];
  const [ranges, setRanges] = useState<Range[] | null>(null);
  const [demo, setDemo] = useState(true);
  const [offset, setOffset] = useState(0);
  const [sel, setSel] = useState<{ arrival: string | null; departure: string | null }>({ arrival: null, departure: null });
  const [form, setForm] = useState({ adults: "2", children: "0", name: "", email: "", notes: "" });
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState("");
  const [loadFailed, setLoadFailed] = useState(false);
  const key = useRef<string>("");
  const [pay, setPay] = useState<Pay>({ url: null, emailSent: false });

  useEffect(() => {
    let live = true;
    fetch("/api/availability")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((j: { demo: boolean; ranges: Range[] }) => {
        if (live) { setRanges(j.ranges); setDemo(j.demo); }
      })
      .catch(() => live && setLoadFailed(true));
    return () => { live = false; };
  }, []);

  const today = toIso(new Date());
  const isBooked = (iso: string) => (ranges ? isBookedIn(iso, ranges) : true);

  const months = useMemo(() => {
    const base = new Date();
    return [0, 1].map((i) => {
      const first = new Date(base.getFullYear(), base.getMonth() + offset + i, 1);
      const lead = (first.getDay() + 6) % 7; // luni primul
      const len = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
      const label = first.toLocaleDateString(t.locale, { month: "long", year: "numeric" });
      const cells: (string | null)[] = [...Array(lead).fill(null), ...Array.from({ length: len }, (_, k) => toIso(new Date(first.getFullYear(), first.getMonth(), k + 1)))];
      return { label, cells };
    });
  }, [offset, t.locale]);

  const fmt = (iso: string | null) => (iso ? new Date(iso + "T00:00:00").toLocaleDateString(t.locale, { weekday: "short", day: "numeric", month: "short" }) : "");

  function pick(iso: string) {
    if (!ranges || phase === "sending") return;
    setError("");
    setSel((s) => pickDate(s, iso, isBooked));
  }

  async function submit() {
    if (phase === "sending") return;
    if (!sel.arrival || !sel.departure) return setError(t.errDates);
    if (form.name.trim().length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.email.trim())) return setError(t.errFields);
    if (!rangeIsFree(sel.arrival, sel.departure, isBooked)) return setError(t.errRange);
    setError("");
    setPhase("sending");
    if (!key.current) key.current = crypto.randomUUID(); // cheie de idempotenta pe actiune
    try {
      const res = await fetch("/api/reservations", {
        method: "POST",
        headers: { "content-type": "application/json", "idempotency-key": key.current },
        body: JSON.stringify({ ...form, arrival: sel.arrival, departure: sel.departure, lang }),
      });
      const j = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; payment?: { available: boolean; url?: string }; emails?: { client: boolean } };
      if (res.ok && j.ok) { setPay({ url: j.payment?.available ? (j.payment.url ?? null) : null, emailSent: !!j.emails?.client }); return setPhase("sent"); } // succes afisat DOAR dupa confirmarea serverului
      setError(j.error === "dates_taken" ? t.errRange : j.error === "fields" ? t.errFields : j.error === "dates" ? t.errDates : t.errServer);
      key.current = "";
      setPhase("failed");
    } catch {
      setError(t.errServer);
      key.current = "";
      setPhase("failed");
    }
  }

  function reset() {
    setSel({ arrival: null, departure: null });
    setForm({ adults: "2", children: "0", name: "", email: "", notes: "" });
    setPhase("idle");
    setError("");
    setPay({ url: null, emailSent: false });
    key.current = "";
  }

  const busy = phase === "sending";
  const mailto = `mailto:${SITE.email}?subject=${encodeURIComponent("Villa Les Mouettes — " + fmt(sel.arrival) + " → " + fmt(sel.departure))}`;

  return (
    <div className="book-grid">
      <div>
        <div className="cal-head">
          <button type="button" className="btn btn-ghost" onClick={() => setOffset((o) => Math.max(0, o - 1))} disabled={offset === 0}>{t.earlier}</button>
          <button type="button" className="btn btn-ghost" onClick={() => setOffset((o) => Math.min(17, o + 1))}>{t.later}</button>
        </div>
        {loadFailed && <p className="err" role="alert">{t.errServer}</p>}
        {!ranges && !loadFailed && <p className="muted" style={{ fontSize: 13.5 }}>{t.loadingCal}</p>}
        {months.map((m) => (
          <div key={m.label} style={{ marginBottom: 28 }}>
            <p className="display" style={{ fontSize: 17, lineHeight: "28px", margin: "0 0 14px", textTransform: "capitalize" }}>{m.label}</p>
            <div className="cal-grid">
              {t.dows.map((d) => <span key={d} className="dow">{d}</span>)}
              {m.cells.map((iso, i) => {
                if (!iso) return <span key={`e${i}`} />;
                const past = iso < today;
                const booked = isBooked(iso);
                const edge = iso === sel.arrival || iso === sel.departure;
                const inRange = !!sel.arrival && !!sel.departure && iso > sel.arrival && iso < sel.departure;
                const cls = ["day", booked && "booked", past && "past", inRange && "range", edge && "edge"].filter(Boolean).join(" ");
                // ziua de plecare poate fi o zi ocupata de urmatorul oaspete: se permite doar ca plecare
                const asDeparture = !!sel.arrival && !sel.departure && iso > sel.arrival && booked && !isBooked(addDays(iso, -1)) && rangeIsFree(sel.arrival, iso, isBooked);
                return (
                  <button key={iso} type="button" className={cls} disabled={!ranges || past || (booked && !asDeparture) || busy} onClick={() => pick(iso)} aria-label={`${fmt(iso)}${booked ? " — " + t.legendBooked : ""}`} aria-pressed={edge}>
                    {Number(iso.slice(8))}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
        <div className="legend muted">
          <span><i style={{ background: "var(--color-accent)" }} />{t.legendSelected}</span>
          <span><i style={{ background: "var(--color-neutral-300)" }} />{t.legendBooked}</span>
          <span><i style={{ border: "1px solid var(--color-neutral-400)" }} />{t.legendAvailable}</span>
        </div>
        {demo && <p className="label" style={{ margin: "14px 0 0", color: "var(--color-accent-700)" }}>{t.demo} — {t.demoBooked}</p>}
      </div>

      <div>
        {phase !== "sent" ? (
          <form onSubmit={(e) => { e.preventDefault(); void submit(); }} noValidate>
            <div className="form-grid">
              <label className="field">{t.fArrival}<input className="input" readOnly value={fmt(sel.arrival)} placeholder={t.fSelect} /></label>
              <label className="field">{t.fDeparture}<input className="input" readOnly value={fmt(sel.departure)} placeholder={t.fSelect} /></label>
              <label className="field">{t.fAdults}<select className="input" value={form.adults} onChange={(e) => setForm({ ...form, adults: e.target.value })} disabled={busy}>{[1, 2, 3, 4, 5, 6].map((n) => <option key={n}>{n}</option>)}</select></label>
              <label className="field">{t.fChildren}<select className="input" value={form.children} onChange={(e) => setForm({ ...form, children: e.target.value })} disabled={busy}>{[0, 1, 2, 3, 4].map((n) => <option key={n}>{n}</option>)}</select></label>
              <label className="field full">{t.fName}<input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={t.fNamePh} autoComplete="name" disabled={busy} /></label>
              <label className="field full">{t.fEmail}<input className="input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="you@example.com" autoComplete="email" disabled={busy} /></label>
              <label className="field full">{t.fNotes}<input className="input" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder={t.fNotesPh} disabled={busy} /></label>
            </div>
            {error && <p className="err" role="alert">{error}</p>}
            <div style={{ marginTop: 28 }}>
              <button type="submit" className="btn btn-primary" disabled={busy || !ranges}>{busy ? t.sending : t.fSubmit}</button>
            </div>
            <p className="trust"><Lock />{t.payTrust}</p>
            <p className="muted" style={{ fontSize: 13, lineHeight: "22px", margin: "8px 0 0" }}>{t.fNote}</p>
          </form>
        ) : (
          <div className="panel" role="status">
            <h3 style={{ fontSize: 24, lineHeight: "28px", letterSpacing: "-0.01em" }}>{t.thanksTitle}</h3>
            <p className="body" style={{ marginTop: 14 }}>{t.confirm1}{fmt(sel.arrival)}{t.confirm2}{fmt(sel.departure)}{t.confirm3}</p>
            {!pay.url && <p className="body" style={{ marginTop: 14 }}>{t.payOff}</p>}
            {!pay.emailSent && <p className="body" style={{ marginTop: 14 }}>{t.emailsNotSent}</p>}
            <div style={{ borderTop: "2px solid var(--color-divider)", marginTop: 28, paddingTop: 20 }}>
              <p className="label" style={{ color: "var(--color-accent-700)", margin: "0 0 10px" }}>{t.emailFlowTitle}</p>
              {[t.emailFlowPay, t.emailFlow1, t.emailFlow2, t.emailFlow3].map((s) => <p key={s} className="muted" style={{ fontSize: 13.5, lineHeight: "22px", margin: "4px 0 0" }}>— {s}</p>)}
            </div>
            <div className="row" style={{ marginTop: 28 }}>
              {pay.url ? (
                <a href={pay.url} className="btn btn-primary"><Lock />{t.payBtn}</a>
              ) : (
                <button type="button" className="btn btn-primary" disabled aria-disabled="true" title={t.payOff}><Lock />{t.payBtn}</button>
              )}
              <a href={mailto} className="btn btn-ghost">{t.emailSendBtn}</a>
              <button type="button" className="btn btn-ghost" onClick={reset}>{t.again}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Lock() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true"><rect x="3" y="11" width="18" height="11" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
  );
}
