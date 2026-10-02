import type { Metadata } from "next";
import { notFound } from "next/navigation";
import "@fontsource-variable/archivo";
import "../globals.css";
import { LANGS, type Lang } from "@/lib/content";
import { SITE } from "@/lib/site";

export const dynamicParams = false;
export function generateStaticParams() {
  return LANGS.map((lang) => ({ lang }));
}

const TITLE = "Luxury Villa Monaco — Villa Les Mouettes | Sea View Villa with Private Pool & Spa, Roquebrune-Cap-Martin";
const DESC: Record<Lang, string> = {
  en: "Villa Les Mouettes — luxury villa rental 5 minutes from Monaco in Roquebrune-Cap-Martin, Côte d'Azur. Panoramic sea view, private pool, spa with hammam. Location de villa de luxe près de Monaco. Check availability and book direct.",
  fr: "Villa Les Mouettes — location de villa de luxe à 5 minutes de Monaco, à Roquebrune-Cap-Martin, Côte d'Azur. Vue mer panoramique, piscine privée, spa avec hammam. Luxury villa Monaco. Vérifiez les disponibilités et réservez en direct.",
};

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  if (!LANGS.includes(lang as Lang)) return {};
  const l = lang as Lang;
  return {
    metadataBase: new URL(SITE.siteUrl || "http://localhost:3100"),
    title: TITLE,
    description: DESC[l],
    alternates: { canonical: `/${l}`, languages: { en: "/en", fr: "/fr", "x-default": "/en" } },
    openGraph: { type: "website", title: TITLE, description: DESC[l], url: `/${l}`, locale: l === "fr" ? "fr_FR" : "en_GB", siteName: SITE.name, images: [{ url: "/photos/facade.jpg", alt: "Villa Les Mouettes" }] },
    twitter: { card: "summary_large_image", title: TITLE, description: DESC[l], images: ["/photos/facade.jpg"] },
    robots: SITE.siteUrl ? undefined : { index: false, follow: false }, // fara domeniu setat nu indexam
  };
}

export default async function RootLayout({ children, params }: { children: React.ReactNode; params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!LANGS.includes(lang as Lang)) notFound();
  return (
    <html lang={lang} data-accent={process.env.NEXT_PUBLIC_VLM_ACCENT ?? "green"}>
      <body>{children}</body>
    </html>
  );
}
