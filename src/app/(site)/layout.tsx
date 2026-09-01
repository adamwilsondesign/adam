import type { Metadata } from "next";
import { draftMode } from "next/headers";

import { SiteChrome } from "@/components/chrome/SiteChrome";
import { CloudsBackground } from "@/features/home/CloudsBackground";
import { StarField } from "@/features/sky/StarField";
import { getSiteSettings, getWorkIndex } from "@/lib/content";
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
    // Site metadata is CMS-managed; the bundled marks stand in when unset.
    icons: {
      icon: settings.seo.faviconUrl ?? "/icon.svg",
      apple: "/apple-icon.png",
    },
    // Draft previews must never be indexed.
    robots: isDraft ? { index: false, follow: false } : undefined,
  };
}

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const [settings, clients] = await Promise.all([getSiteSettings(), getWorkIndex()]);
  return (
    <>
      <CloudsBackground />
      {/* Painted above the clouds: one project star per client, always. */}
      <StarField clientIds={clients.map((client) => client.id)} />
      <SiteChrome
        title={settings.title}
        logoUrl={settings.logoUrl}
        contactUrl={settings.contactUrl}
        linkedinUrl={settings.linkedinUrl}
        navigation={settings.navigation}
      />
      {children}
      {isSanityConfigured ? <LiveVisualEditing /> : null}
    </>
  );
}
