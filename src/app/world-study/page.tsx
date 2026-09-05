import type { Metadata } from "next";
import dynamic from "next/dynamic";

import { WorldStudy } from "@/features/world-study/WorldStudy";
import { getAboutPage, getHomePage, getSiteSettings, getWorkIndex } from "@/lib/content";

const MotionReview =
  process.env.NODE_ENV === "development"
    ? dynamic(() => import("@/features/dev/MotionReview").then((module) => module.MotionReview))
    : () => null;

export const metadata: Metadata = {
  title: "Motion study",
  description: "A working study of the portfolio's continuous environment.",
  robots: { index: false, follow: false },
};

/** The study has its own environment, outside the existing site's renderer. */
export default async function WorldStudyPage() {
  const [home, about, settings, clients] = await Promise.all([
    getHomePage(),
    getAboutPage(),
    getSiteSettings(),
    getWorkIndex(),
  ]);

  return (
    <>
      <WorldStudy home={home} about={about} settings={settings} clients={clients} />
      <MotionReview />
    </>
  );
}
