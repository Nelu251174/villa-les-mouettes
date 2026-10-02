import type { MetadataRoute } from "next";
import { SITE } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = SITE.siteUrl || "http://localhost:3100";
  return ["en", "fr"].map((l) => ({ url: `${base}/${l}`, alternates: { languages: { en: `${base}/en`, fr: `${base}/fr` } } }));
}
