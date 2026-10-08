export async function GET() {
  const manifest = {
    id: "/admin",
    name: "Villa Les Mouettes — Admin",
    short_name: "Villa Admin",
    description: "Rezervări, calendar și alerte pentru Villa Les Mouettes.",
    lang: "ro",
    start_url: "/admin",
    scope: "/admin",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f3f2f2",
    theme_color: "#1e7a52",
    icons: [
      { src: "/admin-icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/admin-icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/admin-icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
  return new Response(JSON.stringify(manifest), { headers: { "content-type": "application/manifest+json; charset=utf-8", "cache-control": "no-cache" } });
}
