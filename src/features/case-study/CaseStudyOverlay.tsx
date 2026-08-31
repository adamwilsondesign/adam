"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { clearCaseOrigin, consumeCaseOrigin, type CaseOrigin } from "@/features/work/origin-store";
import { track } from "@/lib/analytics";
import type { CaseStudy } from "@/lib/content/model";
import { MOBILE_WORK_QUERY, useMediaQuery } from "@/lib/use-media-query";

import type { CaseSibling } from "./case-siblings";
import styles from "./CaseStudyOverlay.module.css";
import { DesktopCaseModal } from "./DesktopCaseModal";
import { MobileCaseSheet } from "./MobileCaseSheet";

type CaseStudyOverlayProps = {
  study: CaseStudy;
  /**
   * "overlay": intercepted above the live Work grid (closing goes back in
   * history). "direct": the canonical /work/[slug] page (closing pushes /work).
   */
  mode: "overlay" | "direct";
  /** All case studies (index order) for prev/next progression. */
  siblings: CaseSibling[];
};

/**
 * Hosts the desktop modal and mobile sheet variants. Both render (so the
 * server-rendered HTML is complete regardless of device) and CSS shows
 * exactly one; behaviour — focus traps, gestures, analytics — activates only
 * on the visible variant.
 */
export function CaseStudyOverlay({ study, mode, siblings }: CaseStudyOverlayProps) {
  const router = useRouter();
  const pathname = usePathname();
  const isMobile = useMediaQuery(MOBILE_WORK_QUERY);

  // A direct-loaded page keeps its (stale) children segment mounted when a
  // soft navigation swaps the slug — the new study arrives through the
  // intercepted modal slot above it. Hide this overlay the moment the URL
  // stops matching, so exactly one case-study surface exists at a time.
  const pathSlug = pathname.startsWith("/work/")
    ? decodeURIComponent(pathname.slice("/work/".length).replace(/\/$/, ""))
    : null;
  const stale = mode === "direct" && pathSlug !== study.slug;

  // Consume the click origin exactly once per overlay instance.
  const [origin] = useState<CaseOrigin | null>(() =>
    typeof window === "undefined" ? null : consumeCaseOrigin(study.slug),
  );

  useEffect(() => {
    if (mode === "direct") {
      track({ name: "case_study_opened", slug: study.slug, source: "direct" });
    }
    return () => clearCaseOrigin();
  }, [mode, study.slug]);

  const close = useCallback(() => {
    clearCaseOrigin();
    if (mode === "overlay") router.back();
    else router.push("/work");
  }, [mode, router]);

  // Sibling progression swaps the slug in place (replace, not push), so the
  // browser Back gesture still closes straight to /work.
  const navigateSibling = useCallback(
    (slug: string) => {
      clearCaseOrigin();
      track({ name: "case_study_opened", slug, source: "sibling" });
      router.replace(`/work/${slug}`, { scroll: false });
    },
    [router],
  );

  if (stale) return null;

  return (
    <>
      <div className={styles.desktopHost}>
        <DesktopCaseModal
          study={study}
          origin={origin}
          active={isMobile === false}
          siblings={siblings}
          onNavigateClose={close}
          onNavigateSibling={navigateSibling}
        />
      </div>
      <div className={styles.mobileHost}>
        <MobileCaseSheet
          study={study}
          origin={origin}
          active={isMobile === true}
          siblings={siblings}
          onNavigateClose={close}
          onNavigateSibling={navigateSibling}
        />
      </div>
    </>
  );
}
