"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { clearCaseOrigin, consumeCaseOrigin, type CaseOrigin } from "@/features/work/origin-store";
import { track } from "@/lib/analytics";
import type { CaseStudy } from "@/lib/content/model";
import { MOBILE_WORK_QUERY, useMediaQuery } from "@/lib/use-media-query";

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
};

/**
 * Hosts the desktop modal and mobile sheet variants. Both render (so the
 * server-rendered HTML is complete regardless of device) and CSS shows
 * exactly one; behaviour — focus traps, gestures, analytics — activates only
 * on the visible variant.
 */
export function CaseStudyOverlay({ study, mode }: CaseStudyOverlayProps) {
  const router = useRouter();
  const isMobile = useMediaQuery(MOBILE_WORK_QUERY);

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

  return (
    <>
      <div className={styles.desktopHost}>
        <DesktopCaseModal
          study={study}
          origin={origin}
          active={isMobile === false}
          onNavigateClose={close}
        />
      </div>
      <div className={styles.mobileHost}>
        <MobileCaseSheet
          study={study}
          origin={origin}
          active={isMobile === true}
          onNavigateClose={close}
        />
      </div>
    </>
  );
}
