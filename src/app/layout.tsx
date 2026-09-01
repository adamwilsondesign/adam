import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";

import { siteUrl } from "@/lib/site-url";

import "./globals.css";

/**
 * Two voices, both bundled locally so builds never fetch fonts: Inter is the
 * quiet grotesque for all functional copy (the reference's Basis Grotesque
 * stand-in), and Cormorant Garamond Light is the ultra-light display serif
 * (the PP Eiko stand-in) reserved for the largest editorial moments.
 */
const inter = localFont({
  src: "../fonts/inter-variable.woff2",
  weight: "100 900",
  display: "swap",
  variable: "--font-inter",
});

const displaySerif = localFont({
  src: "../fonts/cormorant-garamond-latin-300-normal.woff2",
  weight: "300",
  display: "swap",
  variable: "--font-display-serif",
});

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: "Portfolio",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#000000",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // Night is the permanent art direction: one palette, no theme switching,
    // nothing to initialize before paint.
    <html lang="en" className={`${inter.variable} ${displaySerif.variable}`}>
      <body>{children}</body>
    </html>
  );
}
