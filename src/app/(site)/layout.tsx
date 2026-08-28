import type { Metadata } from "next";
import { draftMode } from "next/headers";

import { SiteChrome } from "@/components/chrome/SiteChrome";
import { getSiteSettings } from "@/lib/content";
import { siteUrl } from "@/lib/site-url";
import { isSanityConfigured } from "@/sanity/env";

import { LiveVisualEditing } from "./live";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSiteSettings();
  const isDraft = isSanityConfigured && (await draftMode()).isEnabled;
  return {
    title: {
      default: settings.seo.title,
      template: `%s — ${settings.title}`,
    },
    description: settings.seo.description,
    openGraph: {
      type: "website",
      siteName: settings.title,
      title: settings.seo.title,
      description: settings.seo.description,
      url: siteUrl(),
      images: settings.seo.ogImageUrl ? [{ url: settings.seo.ogImageUrl }] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: settings.seo.title,
      description: settings.seo.description,
      images: settings.seo.ogImageUrl ? [settings.seo.ogImageUrl] : undefined,
    },
    // Draft previews must never be indexed.
    robots: isDraft ? { index: false, follow: false } : undefined,
  };
}

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const settings = await getSiteSettings();
  return (
    <>
      <SiteChrome
        title={settings.title}
        logoUrl={settings.logoUrl}
        contactUrl={settings.contactUrl}
      />
      {children}
      {isSanityConfigured ? <LiveVisualEditing /> : null}
    </>
  );
}
