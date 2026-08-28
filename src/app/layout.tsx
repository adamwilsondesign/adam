import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";

import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { siteUrl } from "@/lib/site-url";
import { THEME_INIT_SCRIPT } from "@/lib/theme";

import "./globals.css";

/**
 * The single typeface: Inter (the reference system's stand-in for SF Pro,
 * covering both display and text roles). Bundled locally so builds never
 * fetch fonts.
 */
const inter = localFont({
  src: "../fonts/inter-variable.woff2",
  weight: "100 900",
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: "Portfolio",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // suppressHydrationWarning: THEME_INIT_SCRIPT adjusts data-theme pre-paint.
    <html lang="en" data-theme="light" suppressHydrationWarning className={inter.variable}>
      <body>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
