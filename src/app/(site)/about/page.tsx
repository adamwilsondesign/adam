import type { Metadata } from "next";

import { AboutView } from "@/features/about/AboutView";
import { getAboutPage, getSiteSettings } from "@/lib/content";

export async function generateMetadata(): Promise<Metadata> {
  const about = await getAboutPage();
  return {
    title: about.seo.title,
    description: about.seo.description,
    alternates: { canonical: "/about" },
  };
}

export default async function AboutPage() {
  const [about, settings] = await Promise.all([getAboutPage(), getSiteSettings()]);
  return <AboutView content={about} contactUrl={settings.contactUrl} />;
}
