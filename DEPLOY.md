# DEPLOY — villalesmouettes.com

Pasi in ordine. Dupa fiecare pas exista un test; nu trece la urmatorul pana nu iese bine.
Nimic de aici nu a fost rulat pe un server real (NEVERIFICAT): imaginea Docker si compose-ul nu au fost testate cu Docker in sesiunea de dezvoltare.

## 0. Ce iti trebuie
- Un VPS Linux (Ubuntu 24.04), minim 1 vCPU / 1 GB RAM, ex. Hetzner CX22 sau DigitalOcean. IP public fix.
- Acces la contul GoDaddy al domeniului `villalesmouettes.com`.
- Cont Resend (email). Cont Stripe (plati) doar cand ai tariful si datele legale.

## 1. DNS la GoDaddy (Domain → DNS → Add)
| Tip | Nume | Valoare |
|---|---|---|
| A | `@` | IP-ul VPS |
| A | `www` | IP-ul VPS |

Sterge inregistrarile `A` si "Parked"/"Forwarding" create implicit de GoDaddy pe `@` si `www`.
Test: `dig +short villalesmouettes.com` arata IP-ul VPS (propagarea poate dura minute pana la ore).

## 2. Pregatirea serverului
```bash
ssh root@IP
apt update && apt install -y docker.io docker-compose-v2 git ufw
ufw allow OpenSSH && ufw allow 80 && ufw allow 443 && ufw enable
git clone https://github.com/Nelu251174/villa-les-mouettes.git && cd villa-les-mouettes/deploy
```
Test: `docker compose version` raspunde.

## 3. Configurare
```bash
cp .env.production.example .env
openssl rand -base64 36   # ruleaza de 4 ori: VLM_ADMIN_PASSWORD, VLM_SECRET, VLM_CRON_SECRET, VLM_ICAL_KEY
nano .env
chmod 600 .env
```
Minim obligatoriu: `NEXT_PUBLIC_SITE_URL`, `VLM_ADMIN_PASSWORD` (12+ caractere), `VLM_SECRET` (32+), `VLM_CRON_SECRET`, `VLM_OWNER_EMAIL`.
`NEXT_PUBLIC_*` se citeste la build; daca o schimbi, refa `docker compose up -d --build`.

## 4. Pornire
```bash
docker compose up -d --build
docker compose ps          # app, caddy, invoices: Up
docker compose logs -f caddy   # asteapta "certificate obtained"
```
Test: `https://villalesmouettes.com/en` si `/fr` se deschid cu lacat valid; `https://www.villalesmouettes.com` redirectioneaza la domeniul fara www; `/admin` cere parola.
Daca certificatul nu se emite: DNS nu a propagat inca sau porturile 80/443 sunt blocate.

## 5. Email (Resend)
1. Resend → Domains → Add `villalesmouettes.com` → copiaza inregistrarile DNS (SPF, DKIM) in GoDaddy → Verify.
2. Pune `RESEND_API_KEY`, `VLM_MAIL_FROM` si `VLM_OWNER_EMAIL` in `.env`, apoi `docker compose up -d`.
3. Test: trimite o cerere de rezervare de pe site cu emailul tau. In `/admin` → Outbox trebuie sa arate **"delivered to provider"**, iar in inbox sosesc 2 mesaje (client + proprietar). Daca scrie "NOT sent", citeste eroarea de acolo.

## 6. Plati (Stripe) — doar cand ai tariful
1. Stripe Dashboard → Developers → API keys → `STRIPE_SECRET_KEY`.
2. Webhooks → Add endpoint `https://villalesmouettes.com/api/stripe/webhook`, eveniment `checkout.session.completed` → copiaza "Signing secret" in `STRIPE_WEBHOOK_SECRET`.
3. `VLM_RATE_EUR_PER_NIGHT=<tarif>`; `docker compose up -d`.
4. Test in **modul test** Stripe (card 4242 4242 4242 4242): cerere → buton de plata activ → dupa plata, rezervarea devine `confirmed` in `/admin`, datele devin ocupate, factura pleaca in ~5 minute. Abia dupa trece pe chei live.

## 7. Calendar real si lansare
- Introdu blocarile reale din `/admin` → Blocked dates, apoi pune `VLM_CALENDAR_LIVE=1` (dispare modelul DEMO).
- Inlocuieste in `src/lib/site.ts` adresa si coordonatele reale (`addressConfirmed`, `geo.confirmed`) si pozele originale in `public/photos/`.
- Cat timp nu ai recenzii reale, 4.9/27 si cele 3 recenzii raman marcate DEMO.
- Cu `NEXT_PUBLIC_SITE_URL` setat, site-ul nu mai are `noindex`. Trimite `https://villalesmouettes.com/sitemap.xml` in Google Search Console.
- Inainte de lansare publica (cerinte legale din brief, inca nefacute): politica de confidentialitate, termeni/anulare, banner cookie.

## 8. Operare
- **Backup**: volumul `vlm-data` contine rezervarile. `docker run --rm -v deploy_vlm-data:/d -v $PWD:/b alpine tar czf /b/vlm-data-$(date +%F).tgz -C /d .` (numele volumului poate avea alt prefix: `docker volume ls`). Faceti-l zilnic si copiati in afara serverului.
- **Actualizare**: `git pull && cd deploy && docker compose up -d --build`.
- **Loguri**: `docker compose logs -f app`.
- **Facturi**: serviciul `invoices` apeleaza `/api/cron/invoices` la 5 minute; buton manual in `/admin`.
- Nu sterge niciodata volumul `vlm-data` (`docker compose down -v` il sterge!).

## Riscuri cunoscute
- Stocarea e in fisiere JSON: un singur server, fara replici. Pentru trafic mare, mutati in baza de date.
- Facturile sunt text, nu PDF; TVA/taxa de sejur nesetate (astept datele legale).
