"use client";
import { useEffect } from "react";
import { worldState } from "@/features/world/world-state";
export type AboutScenePhase = "arriving" | "settled" | "leaving";
export const ABOUT_TIMINGS = {
  desktop: { arrival: 1700, reveal: 1050, unlock: 1300 },
  mobile: { arrival: 1200, reveal: 760, unlock: 950 },
  /** The reverse ascent (a true inverse of the descent); navigation
   *  completes just after it. */
  reverse: 780,
  /** Content fades out before the environment starts moving. */
  contentFade: 200,
  /** Reduced motion swaps the descent for a plain crossfade. */
  reducedFade: 350,
} as const;

type AboutSceneProps = {
  phase: AboutScenePhase;
  /** Descent length for this viewport (ABOUT_TIMINGS.desktop/mobile). */
  arrivalMs: number;
  /** Normalized scroll progress, 0 at the hero → 1 fully editorial. */
  scrollProgress: React.RefObject<number>;
  reducedMotion: boolean;
};

/** About contributes camera intent; the layout owns the persistent world. */
export function AboutScene({ phase }: AboutSceneProps) {
  useEffect(() => {
    worldState.aboutActive = true;
    worldState.aboutPhase = phase;
    return () => {
      worldState.aboutActive = false;
    };
  }, [phase]);
  return null;
}
