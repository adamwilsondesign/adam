import type { Metadata } from "next";

import { HomeView } from "@/features/home/HomeView";
import { getSiteSettings } from "@/lib/content";
import { siteUrl } from "@/lib/site-url";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

export default async function HomePage() {
  const settings = await getSiteSettings();

  const personJsonLd = {
    "@context": "https://schema.org",
    "@type": "Person",
    name: settings.title,
    description: settings.seo.description,
    url: siteUrl(),
    knowsAbout: ["Interface design", "Interaction design", "Product strategy"],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(personJsonLd) }}
      />
      <HomeView intro={settings.description} />
    </>
  );
}
