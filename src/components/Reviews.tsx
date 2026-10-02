"use client";

import { useState } from "react";
import { I18N, type Lang } from "@/lib/content";
import type { PublicReview } from "@/lib/reviews";

type Props = { lang: Lang; average: number; count: number; demo: boolean; real: PublicReview[]; seeds: { text: string; by: string; rating: number }[] };

export function Stars({ n, size, label }: { n: number; size: number; label?: string }) {
  return (
    <div className="stars" role={label ? "img" : undefined} aria-label={label}>
      {[1, 2, 3, 4, 5].map((i) => <span key={i} style={{ fontSize: size, color: i <= Math.round(n) ? "var(--color-accent)" : "var(--color-neutral-400)" }}>★</span>)}
    </div>
  );
}

export default function Reviews({ lang, average, count, demo, real, seeds }: Props) {
  const t = I18N[lang];
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [done, setDone] = useState(false);

  function begin() {
    setOpen(true);
  }

  async function verify() {
    if (busy) return;
    setBusy(true); setMsg("");
    try {
      const res = await fetch("/api/reviews/verify", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, lang }) });
      setMsg(res.ok ? t.revLinkSent : res.status === 503 ? t.revUnavailable : t.errServer);
      if (res.ok) setDone(true);
    } catch { setMsg(t.errServer); }
    setBusy(false);
  }

  return (
    <>
      <div className="rev-head">
        <p className="rev-avg num">{average.toFixed(1)}</p>
        <div>
          <Stars n={average} size={20} label={`${average.toFixed(1)} / 5`} />
          <p className="label muted" style={{ margin: "10px 0 0" }}>
            {t.revSummary} · {count} {lang === "fr" ? "séjours vérifiés" : "verified stays"}
            {demo && <span className="demo">{t.demo}</span>}
          </p>
        </div>
        <div className="rev-actions">
          <button type="button" className="btn btn-primary" onClick={() => begin()}>{t.revLeave}</button>
          <span className="qs muted">{t.rateNow}
            <span style={{ display: "inline-flex", gap: 6 }}>
              {[1, 2, 3, 4, 5].map((i) => <button key={i} type="button" className="starbtn" aria-label={`${i} / 5`} onClick={() => begin()}>★</button>)}
            </span>
          </span>
        </div>
      </div>

      {open && (
        <div className="panel" style={{ margin: "0 0 42px", maxWidth: 640 }}>
          <>
          <h3 style={{ fontSize: 20, lineHeight: "28px", letterSpacing: "-0.01em", margin: "0 0 20px" }}>{t.revFormTitle}</h3>
          {done ? <p className="body" role="status" style={{ margin: 0 }}>{msg}</p> : (
            <>
              <p className="body" style={{ margin: "0 0 20px", fontSize: 14.5, lineHeight: "24px" }}>{t.revGateNote}</p>
              <label className="field" style={{ maxWidth: 400 }}>{t.revEmailLabel}<input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" disabled={busy} /></label>
              {msg && <p className="err" role="alert">{msg}</p>}
              <div style={{ marginTop: 20 }}><button type="button" className="btn btn-primary" onClick={verify} disabled={busy || !email.includes("@")}>{busy ? t.sending : t.revVerifyBtn}</button></div>
            </>
          )}
        </>
        </div>
      )}

      {real.length > 0 && (
        <div className="rev-grid" style={{ marginBottom: 28 }}>
          {real.map((r, i) => (
            <div key={i} className="rev mine">
              <Stars n={r.rating} size={16} />
              <p style={{ marginTop: 14 }}>{r.text}</p>
              <p className="by">— {r.name}</p>
            </div>
          ))}
        </div>
      )}

      {real.length === 0 && (
        <>
          <p className="label" style={{ color: "var(--color-accent-700)", margin: "0 0 14px" }}>{t.demo} — {t.demoReviews}</p>
          <div className="rev-grid">
            {seeds.map((s) => (
              <div key={s.by} className="rev">
                <Stars n={s.rating} size={16} />
                <p style={{ marginTop: 14 }}>{s.text}</p>
                <p className="by">{s.by}</p>
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
}
