import type { Metadata } from "next";
import "@fontsource-variable/archivo";
import "../globals.css";

export const metadata: Metadata = { title: "Admin — Villa Les Mouettes", robots: { index: false, follow: false } };

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-accent={process.env.NEXT_PUBLIC_VLM_ACCENT ?? "green"}>
      <body>{children}</body>
    </html>
  );
}
