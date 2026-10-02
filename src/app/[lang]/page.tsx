import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import Booking from "@/components/Booking";
import Reviews from "@/components/Reviews";
import { I18N, LANGS, type Lang } from "@/lib/content";
import { aggregate, type PublicReview } from "@/lib/reviews";
import { ALT, GALLERY, MAPS_HREF, PHOTOS, SITE } from "@/lib/site";
import { listReviews } from "@/lib/store";

export const revalidate = 60;

const WHATSAPP = "M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.52.149-.174.198-.298.297-.497.1-.198.05-.371-.025-.52-.074-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z";

function Split({ kicker, title, copy, img, alt, w, h, imageFirst, id }: { kicker: string; title: string; copy: string[]; img: string; alt: string; w: number; h: number; imageFirst?: boolean; id?: string }) {
  return (
    <section id={id} className="split">
      <figure style={{ margin: 0 }} className={imageFirst ? "first" : undefined}>
        <Image className="photo" src={img} alt={alt} width={w} height={h} sizes="(max-width: 900px) 100vw, 560px" />
      </figure>
      <div>
        <span className="kicker">{kicker}</span>
        <h2 className="h2">{title}</h2>
        {copy.map((c, i) => <p key={i} className="body" style={i === 0 ? { marginTop: 28 } : undefined}>{c}</p>)}
      </div>
    </section>
  );
}

export default async function Page({ params }: { params: Promise<{ lang: string }> }) {
  const { lang: raw } = await params;
  if (!LANGS.includes(raw as Lang)) notFound();
  const lang = raw as Lang;
  const t = I18N[lang];
  const other: Lang = lang === "en" ? "fr" : "en";

  const approved = (await listReviews()).filter((r) => r.status === "approved");
  const real: PublicReview[] = approved.map((r) => ({ rating: r.rating, name: r.name, text: r.text }));
  const agg = aggregate(real);
  const seeds = [
    { text: t.rev1, by: t.rev1By, rating: 5 },
    { text: t.rev2, by: t.rev2By, rating: 5 },
    { text: t.rev3, by: t.rev3By, rating: 4 },
  ];

  // JSON-LD: aggregateRating/Review SEULEMENT din recenzii reale (cele demo nu se publica ca date structurate).
  const jsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "VacationRental",
    name: SITE.name,
    description: t.heroSub,
    image: [`${SITE.siteUrl}/photos/facade.jpg`],
    address: { "@type": "PostalAddress", addressLocality: "Roquebrune-Cap-Martin", postalCode: "06190", addressCountry: "FR" },
    amenityFeature: [t.am1, t.am2, t.am3, t.am4, t.am5, t.am6, t.am7, t.am8].map((n) => ({ "@type": "LocationFeatureSpecification", name: n, value: true })),
    ...(SITE.siteUrl ? { url: `${SITE.siteUrl}/${lang}` } : {}),
    ...(SITE.geo.confirmed ? { geo: { "@type": "GeoCoordinates", latitude: SITE.geo.lat, longitude: SITE.geo.lng } } : {}),
    ...(real.length ? {
      aggregateRating: { "@type": "AggregateRating", ratingValue: agg.average, reviewCount: agg.count, bestRating: 5 },
      review: real.map((r) => ({ "@type": "Review", reviewRating: { "@type": "Rating", ratingValue: r.rating }, author: { "@type": "Person", name: r.name }, reviewBody: r.text })),
    } : {}),
  };

  const amen = [t.am1, t.am2, t.am3, t.am4, t.am5, t.am6, t.am7, t.am8];
  const tags = [t.tag1, t.tag2, t.tag3, t.tag4, t.tag5];

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <span id="top" />
      <nav className="nav" aria-label="Main">
        <a href="#top" className="nav-brand" aria-label={lang === "fr" ? "Villa Les Mouettes — haut de page" : "Villa Les Mouettes — back to top"}>Villa Les Mouettes</a>
        <div className="links">
          <a href="#about">{t.navVilla}</a><a href="#location">{t.navLocation}</a><a href="#gallery">{t.navGallery}</a><a href="#reviews">{t.navReviews}</a><a href="#contact">{t.navContact}</a>
        </div>
        <span className="lang" aria-label="Language">
          <span aria-current="true">{lang.toUpperCase()}</span>
          <Link href={`/${other}`} hrefLang={other} lang={other}>{other.toUpperCase()}</Link>
        </span>
        <a href="#booking" className="btn btn-primary">{t.navCta}</a>
      </nav>

      <header className="hero">
        <Image src={PHOTOS.facade} alt={ALT.facade} fill priority sizes="100vw" style={{ objectFit: "cover" }} />
        <span className="shade" />
        <div className="hero-in">
          <span className="kick">{t.heroKicker}</span>
          <h1>Villa Les Mouettes</h1>
          <p className="sub">{t.heroSub}</p>
          <div className="row">
            <a href="#booking" className="btn btn-primary">{t.btnBook}</a>
            <a href="#gallery" className="btn btn-ghost" style={{ borderColor: "#fff" }}>{t.btnGallery}</a>
          </div>
        </div>
      </header>

      <main className="wrap">
        <section className="stats" aria-label="Villa Les Mouettes at a glance">
          <div><p className="stat-n">5 min</p><p className="stat-l muted">{t.stat1}</p></div>
          <div><p className="stat-n">180°</p><p className="stat-l muted">{t.stat2}</p></div>
          <div><p className="stat-n num">{agg.average.toFixed(1)}/5</p><p className="stat-l muted">{t.stat3}{agg.demo && <span className="demo">{t.demo}</span>}</p></div>
          <div><p className="stat-n">Spa</p><p className="stat-l muted">{t.stat4}</p></div>
        </section>
        <hr className="rule" />

        <section id="about" className="split">
          <div>
            <span className="kicker">{t.aboutKicker}</span>
            <h2 className="h2">{t.aboutTitle}</h2>
            <p className="body" style={{ marginTop: 28 }}>{t.heroP1}</p>
            <p className="body">{t.heroP2}</p>
            <p className="body">{t.aboutP3}</p>
            <p className="label" style={{ color: "var(--color-accent-700)", margin: "28px 0 0" }}>{t.amTitle}</p>
            <div className="amen">{amen.map((a) => <span key={a}><i />{a}</span>)}</div>
            <div className="tags">{tags.map((g) => <span key={g} className="tag">{g}</span>)}</div>
          </div>
          <figure style={{ margin: 0 }}>
            <Image className="photo" src={PHOTOS.aerial} alt={ALT.aerial} width={1143} height={941} sizes="(max-width: 900px) 100vw, 560px" />
          </figure>
        </section>
        <hr className="rule" />

        <Split imageFirst kicker={`01 — ${t.villaKicker}`} title={t.f1Title} copy={[t.f1Copy]} img={PHOTOS.seaview} alt={ALT.seaview} w={1116} h={664} />
        <hr className="rule" />
        <Split kicker={`02 — ${t.villaKicker}`} title={t.f2Title} copy={[t.f2Copy]} img={PHOTOS.salon} alt={ALT.salon} w={1173} h={643} />
        <hr className="rule" />
        <Split imageFirst kicker={`03 — ${t.villaKicker}`} title={t.f3Title} copy={[t.f3Copy]} img={PHOTOS.hammam} alt={ALT.hammam} w={1171} h={658} />
        <hr className="rule" />
        <Split id="location" kicker={t.locKicker} title={t.locTitle} copy={[t.locCopy, t.locCopy2]} img={PHOTOS.terrace} alt={ALT.terrace} w={1169} h={661} />
        <hr className="rule" />

        <section id="gallery" style={{ padding: "84px 0 98px" }}>
          <span className="kicker" style={{ marginBottom: 42 }}>{t.galKicker}</span>
          <div className="gallery">
            {GALLERY.map((g) => (
              <figure key={g.src}>
                <Image src={g.src} alt={g.alt} width={800} height={600} sizes="(max-width: 700px) 100vw, 380px" />
                <figcaption>
                  <span className="t">{t[g.cap as keyof typeof t] as string}</span>
                  <span className="d muted">{t[g.capD as keyof typeof t] as string}</span>
                </figcaption>
              </figure>
            ))}
          </div>
        </section>
        <hr className="rule" />

        <section id="reviews" className="section">
          <span className="kicker" style={{ marginBottom: 42 }}>{t.revKicker}</span>
          <Reviews lang={lang} average={agg.average} count={agg.count} demo={agg.demo} real={real} seeds={seeds} />
        </section>
        <hr className="rule" />

        <section id="booking" className="section">
          <span className="kicker">{t.bookKicker}</span>
          <h2 className="h2" style={{ marginBottom: 42 }}>{t.bookTitle}</h2>
          <Booking lang={lang} />
        </section>
        <hr className="rule" />

        <section id="contact" className="section">
          <span className="kicker">{t.conKicker}</span>
          <h2 className="h2" style={{ marginBottom: 42 }}>{t.conTitle}</h2>
          <div className="book-grid" style={{ gap: "42px clamp(24px, 5vw, 96px)" }}>
            <div>
              <p className="body" style={{ margin: "0 0 28px", maxWidth: "48ch" }}>{t.conCopy}</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 14, alignItems: "flex-start" }}>
                <a href={`${SITE.whatsappHref}?text=${encodeURIComponent(lang === "fr" ? "Bonjour, je souhaite des informations sur la Villa Les Mouettes." : "Hello, I would like information about Villa Les Mouettes.")}`} target="_blank" rel="noopener" className="btn btn-primary">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d={WHATSAPP} /></svg>{t.conWhatsapp}
                </a>
                <a href={SITE.phoneHref} className="btn btn-ghost">{t.conCall} {SITE.phone}</a>
                <a href={`mailto:${SITE.email}`} className="btn btn-ghost">{SITE.email}</a>
              </div>
              <p className="label" style={{ color: "var(--color-accent-700)", margin: "42px 0 14px" }}>{t.conAddrLabel}</p>
              <a href={MAPS_HREF} target="_blank" rel="noopener" className="display" style={{ fontSize: 20, lineHeight: "28px", letterSpacing: "-0.01em", textDecoration: "underline", textUnderlineOffset: 4 }}>{SITE.addressLine} ↗</a>
              {!SITE.addressConfirmed && <p className="label" style={{ margin: "10px 0 0", color: "var(--color-accent-700)" }}>{t.demo} — {lang === "fr" ? "adresse exacte à confirmer" : "exact address to be confirmed"}</p>}
              <p className="muted" style={{ fontSize: 13, lineHeight: "22px", margin: "14px 0 0" }}>{t.conAddrNote}</p>
            </div>
            <div>
              <a className="map" href={MAPS_HREF} target="_blank" rel="noopener" aria-label={t.conMapCta}>
                <iframe src="https://www.openstreetmap.org/export/embed.html?bbox=7.4000%2C43.7350%2C7.5150%2C43.7900&layer=mapnik&marker=43.7621%2C7.4573" title="Map — Roquebrune-Cap-Martin" loading="lazy" />
                <span>{t.conMapCta}<b aria-hidden="true">↗</b></span>
              </a>
            </div>
          </div>
        </section>

        <section style={{ padding: "0 0 98px" }}><blockquote className="quote">{t.quote}</blockquote></section>
      </main>

      <section className="poster">
        <div className="poster-in">
          <h3>{t.closeTitle}</h3>
          <div className="row"><a href="#booking" className="btn btn-ghost">{t.navCta}</a></div>
        </div>
      </section>
      <div className="wrap"><footer className="foot muted">{t.footer}</footer></div>
    </>
  );
}
