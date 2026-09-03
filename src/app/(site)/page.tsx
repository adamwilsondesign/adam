import type { Metadata } from "next";

import { HomeView } from "@/features/home/HomeView";
import { getHomePage, getSiteSettings } from "@/lib/content";
import { siteUrl } from "@/lib/site-url";

export async function generateMetadata(): Promise<Metadata> {
  const home = await getHomePage();
  return {
    alternates: { canonical: "/" },
    // Optional homepage overrides; the layout's site metadata fills the rest.
    ...(home.seo.title ? { title: home.seo.title } : {}),
    ...(home.seo.description ? { description: home.seo.description } : {}),
  };
}

export default async function HomePage() {
  const [settings, home] = await Promise.all([getSiteSettings(), getHomePage()]);

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
      <HomeView
        intro={home.intro}
        sections={settings.navigation}
        workRange={{ start: settings.workStartYear, end: settings.workEndYear }}
      />
    </>
  );
}
