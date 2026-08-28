import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { CaseStudyOverlay } from "@/features/case-study/CaseStudyOverlay";
import { WorkView } from "@/features/work/WorkView";
import {
  getCaseSiblings,
  getCaseStudy,
  getCaseStudySlugs,
  getSiteSettings,
  getWorkIndex,
} from "@/lib/content";
import { siteUrl } from "@/lib/site-url";

type CaseStudyParams = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  try {
    const slugs = await getCaseStudySlugs();
    return slugs.map(({ slug }) => ({ slug }));
  } catch {
    // Without content configuration at build time, fall back to on-demand rendering.
    return [];
  }
}

export async function generateMetadata({ params }: CaseStudyParams): Promise<Metadata> {
  const { slug } = await params;
  const study = await getCaseStudy(slug);
  if (!study) return { title: "Not found" };
  return {
    title: study.seo.title,
    description: study.seo.description,
    alternates: { canonical: `/work/${study.slug}` },
    openGraph: {
      type: "article",
      title: study.seo.title,
      description: study.seo.description,
      url: `${siteUrl()}/work/${study.slug}`,
      images: study.seo.ogImageUrl ? [{ url: study.seo.ogImageUrl }] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: study.seo.title,
      description: study.seo.description,
      images: study.seo.ogImageUrl ? [study.seo.ogImageUrl] : undefined,
    },
  };
}

/**
 * Canonical, crawlable case-study page. Renders the default Work state with
 * the case-study experience open above it, so hard refreshes and direct
 * links land in the same designed interface.
 */
export default async function CaseStudyPage({ params }: CaseStudyParams) {
  const { slug } = await params;
  const [settings, clients, study, siblings] = await Promise.all([
    getSiteSettings(),
    getWorkIndex(),
    getCaseStudy(slug),
    getCaseSiblings(),
  ]);
  if (!study) notFound();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CreativeWork",
    name: study.title,
    headline: study.seo.title,
    description: study.seo.description,
    url: `${siteUrl()}/work/${study.slug}`,
    image: study.seo.ogImageUrl ?? study.hero.url,
    creator: { "@type": "Person", name: settings.title },
    about: study.clientName,
    keywords: study.tags.join(", "),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <WorkView
        clients={clients}
        bounds={{ start: settings.workStartYear, end: settings.workEndYear }}
      />
      <CaseStudyOverlay study={study} mode="direct" siblings={siblings} />
    </>
  );
}
