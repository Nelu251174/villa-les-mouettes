import type { MetadataRoute } from "next";
import { SITE } from "@/lib/site";

// Franceza (fr-FR) este versiunea principala si x-default; engleza e alternativa pentru public international.
export default function sitemap(): MetadataRoute.Sitemap {
  const base = SITE.siteUrl;
  const languages = { "fr-FR": `${base}/fr`, "fr-MC": `${base}/fr`, en: `${base}/en`, "x-default": `${base}/fr` };
  const lastModified = new Date();
  return [
    { url: `${base}/fr`, lastModified, changeFrequency: "weekly", priority: 1, alternates: { languages } },
    { url: `${base}/en`, lastModified, changeFrequency: "weekly", priority: 0.8, alternates: { languages } },
  ];
}
