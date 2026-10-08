import type { Metadata, Viewport } from "next";
import "@fontsource-variable/archivo";
import "../globals.css";

export const metadata: Metadata = {
  title: "Admin — Villa Les Mouettes",
  robots: { index: false, follow: false },
  manifest: "/admin/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Villa Admin", statusBarStyle: "default" },
  icons: { icon: "/admin-icons/icon-192.png", apple: "/admin-icons/apple-touch-icon.png" },
};
export const viewport: Viewport = { themeColor: "#1e7a52", viewportFit: "cover", width: "device-width", initialScale: 1 };

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ro" data-accent={process.env.NEXT_PUBLIC_VLM_ACCENT ?? "green"}>
      <body>{children}</body>
    </html>
  );
}
