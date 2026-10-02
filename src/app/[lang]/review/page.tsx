import Link from "next/link";
import { notFound } from "next/navigation";
import ReviewForm from "@/components/ReviewForm";
import { I18N, LANGS, type Lang } from "@/lib/content";
import { readReviewToken } from "@/lib/token";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

export default async function ReviewPage({ params, searchParams }: { params: Promise<{ lang: string }>; searchParams: Promise<{ token?: string }> }) {
  const { lang: raw } = await params;
  if (!LANGS.includes(raw as Lang)) notFound();
  const lang = raw as Lang;
  const t = I18N[lang];
  const { token } = await searchParams;
  const valid = !!token && !!readReviewToken(token);
  return (
    <main className="wrap" style={{ padding: "84px var(--gutter)", maxWidth: 720 }}>
      <span className="kicker">{t.revKicker}</span>
      <h1 className="h2" style={{ marginBottom: 28 }}>{t.revFormTitle}</h1>
      {valid ? <ReviewForm lang={lang} token={token!} /> : <p className="body">{t.revTokenBad}</p>}
      <p style={{ marginTop: 42 }}><Link href={`/${lang}#reviews`}>{t.back}</Link></p>
    </main>
  );
}
