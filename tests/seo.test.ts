import { describe, expect, it } from "vitest";
import robots from "../src/app/robots";
import sitemap from "../src/app/sitemap";

describe("SEO / indexare", () => {
  it("robots permite indexarea site-ului si blocheaza admin si API", () => {
    const r = robots();
    const rule = (Array.isArray(r.rules) ? r.rules[0] : r.rules) as { allow?: string; disallow?: string | string[] };
    expect(rule.allow).toBe("/");
    expect(rule.disallow).toEqual(expect.arrayContaining(["/api/", "/admin"]));
    expect(r.sitemap).toBe("https://villalesmouettes.com/sitemap.xml");
  });
  it("sitemap are adrese reale (nu localhost), franceza prima, cu hreflang fr-FR si x-default franceza", () => {
    const s = sitemap();
    expect(s.map((x) => x.url)).toEqual(["https://villalesmouettes.com/fr", "https://villalesmouettes.com/en"]);
    for (const e of s) {
      expect(e.url).not.toContain("localhost");
      expect(e.alternates?.languages).toEqual({ "fr-FR": "https://villalesmouettes.com/fr", "fr-MC": "https://villalesmouettes.com/fr", en: "https://villalesmouettes.com/en", "x-default": "https://villalesmouettes.com/fr" });
    }
  });
});
