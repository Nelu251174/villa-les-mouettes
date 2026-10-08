"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Alarm, SCREEN_KEY, SEEN_KEY, disablePush, enablePush, getPushState, registerAdminSw, setKeepAwake, type PushState } from "@/lib/admin-client";

type Res = { id: string; status: string; arrival: string; departure: string; adults: number; children: number; name: string; email: string; notes: string; createdAt: string; paidAt?: string; invoiceSentAt?: string; amountCents?: number };
type Rev = { id: string; status: string; rating: number; name: string; text: string };
type Blk = { id: string; from: string; to: string; note: string };
type Aud = { at: string; actor: string; action: string; target: string; result: string; reason?: string };
type Mail = { at: string; to: string; subject: string; sent: boolean; error?: string };
type Data = { reservations: Res[]; reviews: Rev[]; blocks: Blk[]; audit: Aud[]; outbox: Mail[]; cfg: { mail: boolean; stripe: boolean; calendarLive: boolean } };
type Tab = "azi" | "rezervari" | "calendar" | "recenzii" | "setari";
const TABS: { id: Tab; label: string }[] = [
  { id: "azi", label: "Azi" }, { id: "rezervari", label: "Rezervări" }, { id: "calendar", label: "Calendar" }, { id: "recenzii", label: "Recenzii" }, { id: "setari", label: "Setări" },
];

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const addD = (s: string, n: number) => { const d = new Date(s + "T00:00:00"); d.setDate(d.getDate() + n); return iso(d); };
const nights = (a: string, b: string) => Math.round((new Date(b + "T00:00:00").getTime() - new Date(a + "T00:00:00").getTime()) / 86_400_000);
const fmtD = (s: string) => new Date(s + "T00:00:00").toLocaleDateString("ro-RO", { day: "numeric", month: "short" });
const eur = (c?: number) => (c ? `${(c / 100).toLocaleString("ro-RO", { maximumFractionDigits: 0 })} EUR` : "—");
const STATUS: Record<string, string> = { pending: "Cerere nouă", confirmed: "Confirmată", cancelled: "Anulată" };

export default function AdminPanel({ authed }: { authed: boolean }) {
  const [ok, setOk] = useState(authed);
  const [pw, setPw] = useState("");
  const [data, setData] = useState<Data | null>(null);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("azi");
  const [filter, setFilter] = useState<"toate" | "pending" | "confirmed" | "cancelled">("toate");
  const [blk, setBlk] = useState({ from: "", to: "", note: "" });
  const [month, setMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const [fresh, setFresh] = useState<Res[]>([]); // cereri noi nevazute -> alerta pe tot ecranul
  const [push, setPush] = useState<PushState>("off");
  const [awake, setAwake] = useState(false);
  const [installEvt, setInstallEvt] = useState<Event | null>(null);
  const alarm = useRef<Alarm | null>(null);
  const seen = useRef<Set<string> | null>(null);

  const getAlarm = () => (alarm.current ??= new Alarm());

  const load = useCallback(async () => {
    const r = await fetch("/api/admin/data", { cache: "no-store" });
    if (r.status === 401) return setOk(false);
    const d = (await r.json()) as Data;
    setData(d);
    // "Vazut" se tine pe acest telefon. Prima utilizare: cererile existente nu declanseaza alarma (apar in lista).
    if (seen.current === null) {
      let stored: string[] | null = null;
      try { stored = JSON.parse(localStorage.getItem(SEEN_KEY) ?? "null") as string[] | null; } catch { stored = null; }
      seen.current = new Set(stored ?? d.reservations.map((x) => x.id));
      if (!stored) localStorage.setItem(SEEN_KEY, JSON.stringify([...seen.current]));
    }
    const unseen = d.reservations.filter((x) => x.status === "pending" && !seen.current!.has(x.id));
    setFresh(unseen);
  }, []);

  // initializare: tab din adresa (?tab=), service worker, starea notificarilor, preferinta de ecran aprins
  useEffect(() => {
    if (!ok) return;
    let live = true;
    Promise.resolve().then(async () => {
      if (!live) return;
      const t = new URLSearchParams(location.search).get("tab");
      if (t && TABS.some((x) => x.id === t)) setTab(t as Tab);
      await registerAdminSw();
      setPush(await getPushState());
      setAwake(localStorage.getItem(SCREEN_KEY) === "1");
      await load();
    });
    const onMsg = (e: MessageEvent) => { if ((e.data as { type?: string })?.type === "push") void load(); };
    navigator.serviceWorker?.addEventListener("message", onMsg);
    const onVis = () => { if (document.visibilityState === "visible") void load(); };
    document.addEventListener("visibilitychange", onVis);
    const t = window.setInterval(() => { if (document.visibilityState === "visible") void load(); }, 10_000);
    const onInstall = (e: Event) => { e.preventDefault(); setInstallEvt(e); };
    window.addEventListener("beforeinstallprompt", onInstall);
    return () => {
      live = false;
      window.clearInterval(t);
      document.removeEventListener("visibilitychange", onVis);
      navigator.serviceWorker?.removeEventListener("message", onMsg);
      window.removeEventListener("beforeinstallprompt", onInstall);
    };
  }, [ok, load]);

  // alarma sonora cat timp exista cereri nevazute
  useEffect(() => {
    const a = getAlarm();
    if (fresh.length > 0) a.start(); else a.stop();
    return () => a.stop();
  }, [fresh.length]);

  // ecran aprins (se reia cand aplicatia revine in prim-plan)
  useEffect(() => {
    if (!ok || !awake) { void setKeepAwake(false); return; }
    void setKeepAwake(true);
    const re = () => { if (document.visibilityState === "visible") void setKeepAwake(true); };
    document.addEventListener("visibilitychange", re);
    return () => document.removeEventListener("visibilitychange", re);
  }, [ok, awake]);

  function markSeen(ids: string[]) {
    const s = seen.current ?? new Set<string>();
    ids.forEach((i) => s.add(i));
    seen.current = s;
    localStorage.setItem(SEEN_KEY, JSON.stringify([...s]));
    setFresh([]);
  }

  async function login() {
    setBusy("login"); setMsg("");
    const r = await fetch("/api/admin/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ password: pw }) });
    setBusy(null);
    if (r.ok) { setPw(""); setOk(true); } else setMsg(r.status === 429 ? "Prea multe încercări. Reîncearcă în 10 minute." : r.status === 503 ? "Admin neconfigurat pe server." : "Parolă greșită.");
  }
  async function act(key: string, body: Record<string, unknown>, okText: string) {
    if (busy) return;
    setBusy(key); setMsg("");
    try {
      const r = await fetch("/api/admin/action", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const j = (await r.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      setMsg(r.ok && j.ok ? okText : `Nu a mers: ${j.error === "dates_taken" ? "datele sunt deja ocupate" : (j.error ?? r.status)}`);
      await load();
    } catch { setMsg("Nu a mers: fără conexiune."); }
    setBusy(null);
  }

  async function enableAlerts() {
    setMsg("");
    getAlarm().unlock(); // gest al utilizatorului: deblocheaza sunetul
    const r = await enablePush();
    setPush(await getPushState());
    setMsg(r.ok ? "Alertele sunt active pe acest telefon." : r.error === "denied" ? "Ai refuzat notificările. Le activezi din setările telefonului pentru acest site." : r.error === "unsupported" ? "Telefonul/browserul nu permite notificări. Pe iPhone, instalează întâi aplicația pe ecranul principal." : "Nu s-au putut activa alertele. Reîncearcă.");
  }
  async function sendTest() {
    setBusy("test");
    const r = await fetch("/api/admin/push", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "test" }) });
    const j = (await r.json().catch(() => ({}))) as { ok?: boolean; sent?: number };
    setMsg(j.ok ? `Alertă trimisă către ${j.sent} telefon(e).` : "Nicio alertă trimisă: niciun telefon înregistrat sau serviciul push a refuzat.");
    setBusy(null);
  }
  function testAlarm() {
    getAlarm().unlock();
    const demo: Res = { id: "demo", status: "pending", arrival: iso(new Date()), departure: addD(iso(new Date()), 4), adults: 2, children: 0, name: "Test alarmă", email: "", notes: "", createdAt: new Date().toISOString(), amountCents: 480000 };
    setFresh([demo]);
  }
  async function install() {
    const e = installEvt as (Event & { prompt?: () => Promise<void> }) | null;
    if (e?.prompt) { await e.prompt(); setInstallEvt(null); }
  }

  const today = iso(new Date());
  const res = data?.reservations ?? [];
  const pending = res.filter((r) => r.status === "pending");
  const upcoming = res.filter((r) => r.status === "confirmed" && r.arrival >= today).sort((a, b) => a.arrival.localeCompare(b.arrival));
  const week = addD(today, 7);
  const revPending = (data?.reviews ?? []).filter((r) => r.status === "pending");

  if (!ok) {
    return (
      <main className="adm-login">
        <h1 className="h2" style={{ marginBottom: 6 }}>Villa Les Mouettes</h1>
        <p className="muted" style={{ margin: "0 0 28px" }}>Admin</p>
        <form onSubmit={(e) => { e.preventDefault(); void login(); }}>
          <label className="field">Parolă<input className="input" type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="current-password" disabled={busy === "login"} /></label>
          {msg && <p className="err" role="alert">{msg}</p>}
          <div style={{ marginTop: 20 }}><button className="btn btn-primary" style={{ width: "100%", justifyContent: "center" }} disabled={busy === "login" || !pw}>{busy === "login" ? "…" : "Intră"}</button></div>
        </form>
      </main>
    );
  }
  if (!data) return <main className="adm-login"><p className="muted">Se încarcă…</p></main>;

  const Btn = (k: string, body: Record<string, unknown>, label: string, okText: string, o?: { ghost?: boolean; confirm?: string }) => (
    <button key={k} type="button" className={`btn ${o?.ghost ? "btn-ghost" : "btn-primary"} adm-btn`} disabled={!!busy}
      onClick={() => { if (o?.confirm && !window.confirm(o.confirm)) return; void act(k, body, okText); }}>{busy === k ? "…" : label}</button>
  );

  const ResCard = (r: Res) => (
    <article key={r.id} className={`adm-card st-${r.status}`}>
      <div className="adm-row"><b className="adm-dates">{fmtD(r.arrival)} → {fmtD(r.departure)}</b><span className={`adm-badge st-${r.status}`}>{STATUS[r.status] ?? r.status}</span></div>
      <p className="adm-sub">{nights(r.arrival, r.departure)} nopți · {r.adults + r.children} pers. · <b>{eur(r.amountCents)}</b></p>
      <p className="adm-guest">{r.name} · <a href={`mailto:${r.email}`}>{r.email}</a></p>
      {r.notes && <p className="adm-note">„{r.notes}”</p>}
      <p className="adm-sub">{r.paidAt ? `Plătită ${fmtD(r.paidAt.slice(0, 10))}` : "Neplătită"}{r.invoiceSentAt ? " · factură trimisă" : ""}</p>
      <div className="adm-actions">
        {r.status !== "confirmed" && Btn(`c${r.id}`, { action: "reservation.confirm", id: r.id }, r.status === "cancelled" ? "Confirmă din nou" : "Confirmă", "Rezervare confirmată.")}
        {r.status === "confirmed" && !r.paidAt && Btn(`p${r.id}`, { action: "reservation.mark_paid", id: r.id }, "Marchează plătită", "Marcat ca plătit (în afara Stripe).", { ghost: true, confirm: "Confirmi că ai primit plata în afara Stripe?" })}
        {r.paidAt && !r.invoiceSentAt && Btn(`i${r.id}`, { action: "reservation.invoice_now", id: r.id }, "Trimite factura", "Factură trimisă.", { ghost: true })}
        {r.status !== "cancelled" && Btn(`x${r.id}`, { action: "reservation.cancel", id: r.id }, r.status === "pending" ? "Refuză" : "Anulează", "Rezervare anulată.", { ghost: true, confirm: "Sigur anulezi această rezervare?" })}
      </div>
    </article>
  );

  // ---- calendar ----
  const mStart = new Date(month.getFullYear(), month.getMonth(), 1);
  const lead = (mStart.getDay() + 6) % 7;
  const len = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const dayState = (d: string): "confirmed" | "pending" | "blocked" | "" => {
    if (data.blocks.some((b) => d >= b.from && d <= b.to)) return "blocked";
    if (res.some((r) => r.status === "confirmed" && d >= r.arrival && d < r.departure)) return "confirmed";
    if (res.some((r) => r.status === "pending" && d >= r.arrival && d < r.departure)) return "pending";
    return "";
  };

  return (
    <div className="adm">
      {fresh.length > 0 && (
        <div className="adm-overlay" role="alertdialog" aria-live="assertive" aria-label="Rezervare nouă">
          <div className="adm-overlay-in">
            <p className="adm-ov-kicker">⚠ ALERTĂ</p>
            <h1 className="adm-ov-title">{fresh.length > 1 ? `${fresh.length} CERERI NOI` : "REZERVARE NOUĂ"}</h1>
            {fresh.slice(0, 3).map((r) => (
              <div key={r.id} className="adm-ov-card">
                <b>{r.name}</b>
                <span>{fmtD(r.arrival)} → {fmtD(r.departure)} · {nights(r.arrival, r.departure)} nopți</span>
                <span>{r.adults + r.children} pers. · {eur(r.amountCents)}</span>
              </div>
            ))}
            {!getAlarm().ready && <p className="adm-ov-hint">Sunetul e blocat de telefon. Atinge butonul de mai jos ca să-l pornești.</p>}
            <div className="adm-ov-actions">
              <button className="adm-ov-btn" onClick={() => { getAlarm().unlock(); markSeen(fresh.map((x) => x.id)); if (fresh[0]?.id !== "demo") setTab("azi"); }}>Deschide</button>
              <button className="adm-ov-btn ghost" onClick={() => { getAlarm().unlock(); markSeen(fresh.map((x) => x.id)); }}>Am văzut · oprește sunetul</button>
            </div>
          </div>
        </div>
      )}

      <header className="adm-top">
        <b>Villa Les Mouettes</b>
        <span className="adm-top-r">{push === "on" ? <i className="dot on" title="Alerte active" /> : <i className="dot" title="Alerte oprite" />}{push === "on" ? "alerte active" : "alerte oprite"}</span>
      </header>
      {msg && <p role="status" className="adm-msg" onClick={() => setMsg("")}>{msg}</p>}

      <main className="adm-main">
        {tab === "azi" && (
          <>
            <div className="adm-kpis">
              <div className={`adm-kpi ${pending.length ? "hot" : ""}`}><b>{pending.length}</b><span>cereri noi</span></div>
              <div className="adm-kpi"><b>{upcoming.filter((r) => r.arrival <= week).length}</b><span>sosiri în 7 zile</span></div>
              <div className="adm-kpi"><b>{res.filter((r) => r.status === "confirmed" && r.departure >= today && r.departure <= week).length}</b><span>plecări în 7 zile</span></div>
              <div className={`adm-kpi ${revPending.length ? "hot" : ""}`}><b>{revPending.length}</b><span>recenzii de aprobat</span></div>
            </div>
            <h2 className="adm-h">Cereri noi</h2>
            {pending.length === 0 ? <p className="muted">Nicio cerere nouă.</p> : pending.map(ResCard)}
            <h2 className="adm-h">Următoarele sosiri</h2>
            {upcoming.length === 0 ? <p className="muted">Nicio sosire confirmată.</p> : upcoming.slice(0, 5).map(ResCard)}
          </>
        )}

        {tab === "rezervari" && (
          <>
            <div className="adm-chips" role="tablist">
              {([["toate", "Toate"], ["pending", "Noi"], ["confirmed", "Confirmate"], ["cancelled", "Anulate"]] as const).map(([k, l]) => (
                <button key={k} type="button" className={`adm-chip ${filter === k ? "on" : ""}`} onClick={() => setFilter(k)}>{l}</button>
              ))}
            </div>
            {res.filter((r) => filter === "toate" || r.status === filter).map(ResCard)}
            {res.filter((r) => filter === "toate" || r.status === filter).length === 0 && <p className="muted">Nimic de afișat.</p>}
          </>
        )}

        {tab === "calendar" && (
          <>
            <div className="adm-row" style={{ marginBottom: 12 }}>
              <button type="button" className="btn btn-ghost adm-btn" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}>←</button>
              <b style={{ textTransform: "capitalize" }}>{month.toLocaleDateString("ro-RO", { month: "long", year: "numeric" })}</b>
              <button type="button" className="btn btn-ghost adm-btn" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}>→</button>
            </div>
            <div className="adm-cal">
              {["L", "M", "M", "J", "V", "S", "D"].map((d, i) => <span key={i} className="adm-dow">{d}</span>)}
              {Array.from({ length: lead }).map((_, i) => <span key={`e${i}`} />)}
              {Array.from({ length: len }, (_, i) => { const d = iso(new Date(month.getFullYear(), month.getMonth(), i + 1)); const s = dayState(d); return <span key={d} className={`adm-day ${s}`}>{i + 1}</span>; })}
            </div>
            <div className="legend muted" style={{ marginTop: 12 }}>
              <span><i style={{ background: "var(--color-accent)" }} />Confirmat</span>
              <span><i style={{ background: "#e0a526" }} />Cerere nouă</span>
              <span><i style={{ background: "var(--color-neutral-400)" }} />Blocat de tine</span>
            </div>
            <h2 className="adm-h">Blochează date</h2>
            <form className="adm-form" onSubmit={(e) => { e.preventDefault(); void act("block", { action: "block.add", ...blk }, "Date blocate.").then(() => setBlk({ from: "", to: "", note: "" })); }}>
              <label className="field">De la<input className="input" type="date" value={blk.from} onChange={(e) => setBlk({ ...blk, from: e.target.value })} /></label>
              <label className="field">Până la (inclusiv)<input className="input" type="date" value={blk.to} onChange={(e) => setBlk({ ...blk, to: e.target.value })} /></label>
              <label className="field">Notă<input className="input" value={blk.note} onChange={(e) => setBlk({ ...blk, note: e.target.value })} placeholder="ex. folosință proprie" /></label>
              <button className="btn btn-primary adm-btn" disabled={!!busy || !blk.from || !blk.to}>{busy === "block" ? "…" : "Blochează"}</button>
            </form>
            {data.blocks.map((b) => (
              <div key={b.id} className="adm-card"><div className="adm-row"><b>{fmtD(b.from)} → {fmtD(b.to)}</b>{Btn(`b${b.id}`, { action: "block.remove", id: b.id }, "Șterge", "Blocare ștearsă.", { ghost: true, confirm: "Ștergi această blocare?" })}</div>{b.note && <p className="adm-sub">{b.note}</p>}</div>
            ))}
          </>
        )}

        {tab === "recenzii" && (
          <>
            {data.reviews.length === 0 && <p className="muted">Nicio recenzie încă.</p>}
            {data.reviews.map((v) => (
              <article key={v.id} className="adm-card">
                <div className="adm-row"><b>{"★".repeat(v.rating)}<span style={{ color: "var(--color-neutral-400)" }}>{"★".repeat(5 - v.rating)}</span></b><span className="adm-badge">{v.status === "approved" ? "Publicată" : v.status === "hidden" ? "Ascunsă" : "De aprobat"}</span></div>
                <p className="adm-guest">{v.name}</p><p className="adm-note">{v.text}</p>
                <div className="adm-actions">
                  {v.status !== "approved" && Btn(`a${v.id}`, { action: "review.approve", id: v.id }, "Aprobă", "Recenzie publicată.")}
                  {v.status !== "hidden" && Btn(`h${v.id}`, { action: "review.hide", id: v.id }, "Ascunde", "Recenzie ascunsă.", { ghost: true })}
                </div>
              </article>
            ))}
          </>
        )}

        {tab === "setari" && (
          <>
            <h2 className="adm-h">Alerte pe telefon</h2>
            <div className="adm-card">
              <p className="adm-sub">Notificări: <b>{push === "on" ? "active" : push === "denied" ? "refuzate în telefon" : push === "unsupported" ? "nesuportate aici" : "oprite"}</b></p>
              <div className="adm-actions">
                {push !== "on" && <button type="button" className="btn btn-primary adm-btn" onClick={() => void enableAlerts()}>Activează alertele pe acest telefon</button>}
                {push === "on" && <button type="button" className="btn btn-primary adm-btn" disabled={!!busy} onClick={() => void sendTest()}>{busy === "test" ? "…" : "Trimite o alertă de test"}</button>}
                <button type="button" className="btn btn-ghost adm-btn" onClick={testAlarm}>Testează alarma (ecran + sunet)</button>
                {push === "on" && <button type="button" className="btn btn-ghost adm-btn" onClick={async () => { await disablePush(); setPush(await getPushState()); setMsg("Alertele au fost oprite pe acest telefon."); }}>Oprește alertele aici</button>}
              </div>
              <label className="adm-check"><input type="checkbox" checked={awake} onChange={(e) => { setAwake(e.target.checked); localStorage.setItem(SCREEN_KEY, e.target.checked ? "1" : "0"); }} /> Ține ecranul aprins cât aplicația e deschisă</label>
              <p className="adm-sub" style={{ marginTop: 12 }}>Cât aplicația e <b>deschisă</b>, o cerere nouă pornește alarma pe tot ecranul, cu sunet și vibrație, până apeși „Am văzut”. Când aplicația e <b>închisă</b>, telefonul afișează notificarea cu vibrație și sunetul de notificare setat în telefon. Un site nu poate forța un ecran complet ca la apel sau un sunet fix cât telefonul e blocat. Pentru volum mare, setează în telefon sunetul notificărilor acestei aplicații la maxim și dezactivează „Nu deranja”.</p>
            </div>
            <h2 className="adm-h">Instalează ca aplicație</h2>
            <div className="adm-card">
              {installEvt ? <button type="button" className="btn btn-primary adm-btn" onClick={() => void install()}>Instalează aplicația</button> : null}
              <p className="adm-sub"><b>Android (Chrome):</b> meniul ⋮ → „Instalează aplicația” / „Adaugă pe ecranul principal”.<br /><b>iPhone (Safari):</b> butonul Partajare → „Adaugă pe ecranul principal”, apoi deschide aplicația din icoană și apasă „Activează alertele” (obligatoriu pe iPhone).</p>
            </div>
            <h2 className="adm-h">Sistem</h2>
            <div className="adm-card">
              <p className="adm-sub">Emailuri: <b>{data.cfg.mail ? "configurate" : "NECONFIGURATE (mesajele nu pleacă)"}</b><br />Plată Stripe: <b>{data.cfg.stripe ? "configurată" : "neconfigurată"}</b><br />Calendar: <b>{data.cfg.calendarLive ? "real" : "DEMO"}</b></p>
              <div className="adm-actions">{Btn("inv", { action: "invoice.run" }, "Trimite facturile scadente", "Facturi procesate.", { ghost: true })}</div>
            </div>
            <details className="adm-card"><summary>Mesaje ({data.outbox.length})</summary>{data.outbox.map((m, i) => <p key={i} className="adm-sub">{m.at.slice(0, 16)} · {m.to} · {m.subject} · <b>{m.sent ? "trimis" : `NETRIMIS (${m.error})`}</b></p>)}</details>
            <details className="adm-card"><summary>Jurnal ({data.audit.length})</summary>{data.audit.map((a, i) => <p key={i} className="adm-sub">{a.at.slice(0, 19)} · {a.actor} · {a.action} · <b>{a.result}</b>{a.reason ? ` (${a.reason})` : ""}</p>)}</details>
            <div className="adm-actions" style={{ marginTop: 20 }}><button type="button" className="btn btn-ghost adm-btn" onClick={async () => { await fetch("/api/admin/logout", { method: "POST" }); setOk(false); }}>Deconectare</button></div>
          </>
        )}
      </main>

      <nav className="adm-tabs" aria-label="Secțiuni">
        {TABS.map((t) => (
          <button key={t.id} type="button" className={tab === t.id ? "on" : ""} aria-current={tab === t.id} onClick={() => { setTab(t.id); window.scrollTo(0, 0); }}>
            {t.label}
            {t.id === "azi" && pending.length > 0 && <b className="adm-count">{pending.length}</b>}
            {t.id === "recenzii" && revPending.length > 0 && <b className="adm-count">{revPending.length}</b>}
          </button>
        ))}
      </nav>
    </div>
  );
}
