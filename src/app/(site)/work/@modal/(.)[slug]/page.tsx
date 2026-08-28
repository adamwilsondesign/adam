import { notFound } from "next/navigation";

import { CaseStudyOverlay } from "@/features/case-study/CaseStudyOverlay";
import { getCaseStudy } from "@/lib/content";

/**
 * Intercepted case-study overlay: renders above the still-mounted Work grid
 * when a logo is opened from the grid. Direct visits to /work/[slug] use the
 * full page in ../[slug]/page.tsx instead.
 */
export default async function CaseStudyModalPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const study = await getCaseStudy(slug);
  if (!study) notFound();
  return <CaseStudyOverlay study={study} mode="overlay" />;
}
