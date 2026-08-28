import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";

import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { siteUrl } from "@/lib/site-url";
import { THEME_INIT_SCRIPT } from "@/lib/theme";

import "./globals.css";

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
    { media: "(prefers-color-scheme: light)", color: "#f4f2ee" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // suppressHydrationWarning: THEME_INIT_SCRIPT adjusts data-theme pre-paint.
    <html lang="en" data-theme="dark" suppressHydrationWarning className={GeistSans.variable}>
      <body>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
