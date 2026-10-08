# Villa Les Mouettes (proiect MONACO)

Site de inchiriere vila, EN/FR, aplicatie Next.js de sine statatoare.
Sursa: brief "Villa Les Mouettes" (02.10.2026), design "Modernist" (Archivo, accent verde, colturi drepte).

    npm install && npm run dev      # http://localhost:3100 -> /en, /fr
    npm run typecheck && npm run lint && npm test && npm run build

## Ce este real si ce nu (runda 2)

| Parte | Stare |
|---|---|
| 13 sectiuni, EN/FR (`/en`, `/fr`), hreflang, OG/Twitter, JSON-LD, sitemap, robots | implementat, verificat in browser |
| Rezervari server-side, reverificare disponibilitate, confirmare protejata la dubla rezervare | implementat, 12 teste |
| Admin `/admin` = aplicatie instalabila pe telefon (PWA, in romana): taburi Azi / Rezervari / Calendar / Recenzii / Setari; alerta pe tot ecranul cu sunet+vibratie cand aplicatia e deschisa; notificari push (web-push, chei VAPID generate automat in `.data/vapid.json`) cand e inchisa. Push real pe telefon: **NEVERIFICAT** (netestat pe un telefon). iPhone: doar dupa "Adauga pe ecranul principal" (iOS 16.4+). Detalii vechi mai jos: `/admin` (parola `VLM_ADMIN_PASSWORD` + `VLM_SECRET`): rezervari (confirmare/anulare/plata offline), blocare date, moderare recenzii, factura, outbox, audit | implementat, verificat in browser |
| Recenzii: doar oaspeti cu sedere platita, magic-link pe email (token semnat, 7 zile), moderare, agregat real | implementat; **livrarea emailului NEVERIFICATA** (fara `RESEND_API_KEY`) |
| Emailuri (client, proprietar, factura) prin Resend | implementat; **NEVERIFICAT cu un furnizor real**. Fara cheie, mesajele raman in outbox cu `sent=false` si UI spune asta |
| Stripe Checkout (3DS cerut) + webhook cu semnatura verificata + factura la ~5 min | implementat; semnatura testata; **NEVERIFICAT cu Stripe real** (fara chei/tarif) |
| Factura PDF, TVA, taxa de sejur | **nefacut**: factura e text; astept datele legale |
| iCal export `/api/ical?key=` | implementat; import din Airbnb/Booking **nefacut** |
| Calendar | curat; blocheaza doar rezervari confirmate si blocari din admin (`VLM_CALENDAR_DEMO=1` = model de test) |
| Stocare | fisiere JSON in `.data/` (volum persistent obligatoriu); de mutat in DB inainte de trafic mare |

Cron factura: `POST /api/cron/invoices` cu header `x-cron-secret: $VLM_CRON_SECRET` la fiecare ~5 min (sau butonul din admin).
Stripe: webhook catre `/api/stripe/webhook`, eveniment `checkout.session.completed`.

Variabile: `VLM_ADMIN_PASSWORD`, `VLM_SECRET` (32+), `VLM_OWNER_EMAIL`, `RESEND_API_KEY`, `VLM_MAIL_FROM`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `VLM_CRON_SECRET`, `VLM_ICAL_KEY`, `VLM_CALENDAR_DEMO`, `NEXT_PUBLIC_SITE_URL` (fara ea site-ul cere noindex), `NEXT_PUBLIC_VLM_ACCENT` (`green` | `blue` | `petrol`), `VLM_DATA_DIR`.
