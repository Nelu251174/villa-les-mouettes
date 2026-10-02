import type { MetadataRoute } from "next";
import { SITE } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  // Fara domeniu configurat (NEXT_PUBLIC_SITE_URL) site-ul nu cere indexare.
  if (!SITE.siteUrl) return { rules: { userAgent: "*", disallow: "/" } };
  return { rules: { userAgent: "*", allow: "/", disallow: "/api/" }, sitemap: `${SITE.siteUrl}/sitemap.xml` };
}
