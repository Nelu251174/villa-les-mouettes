"use client";

import { useState } from "react";
import { I18N, type Lang } from "@/lib/content";

export default function ReviewForm({ lang, token }: { lang: Lang; token: string }) {
  const t = I18N[lang];
  const [rating, setRating] = useState(5);
  const [name, setName] = useState("");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [done, setDone] = useState(false);

  async function submit() {
    if (busy) return;
    setBusy(true); setMsg("");
    try {
      const r = await fetch("/api/reviews", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token, rating, name, text }) });
      if (r.ok) setDone(true); else setMsg(r.status === 409 ? t.revPending : r.status === 403 ? t.revTokenBad : t.errServer);
    } catch { setMsg(t.errServer); }
    setBusy(false);
  }

  if (done) return <p className="body" role="status">{t.revPending}</p>;
  return (
    <form onSubmit={(e) => { e.preventDefault(); void submit(); }}>
      <p className="label muted" style={{ margin: "0 0 10px" }}>{t.revStarsLabel}</p>
      <div style={{ display: "flex", gap: 8, margin: "0 0 20px" }}>
        {[1, 2, 3, 4, 5].map((i) => <button key={i} type="button" className={`starbtn${i <= rating ? " on" : ""}`} style={{ fontSize: 28 }} aria-label={`${i} / 5`} aria-pressed={i <= rating} onClick={() => setRating(i)}>★</button>)}
      </div>
      <div style={{ display: "grid", gap: 14 }}>
        <label className="field">{t.fName}<input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder={t.fNamePh} disabled={busy} /></label>
        <label className="field">{t.revTextLabel}<textarea className="input" rows={5} value={text} onChange={(e) => setText(e.target.value)} placeholder={t.revTextPh} disabled={busy} /></label>
      </div>
      {msg && <p className="err" role="alert">{msg}</p>}
      <div style={{ marginTop: 20 }}><button className="btn btn-primary" disabled={busy || name.trim().length < 2 || text.trim().length < 5}>{busy ? t.sending : t.revSubmit}</button></div>
    </form>
  );
}
