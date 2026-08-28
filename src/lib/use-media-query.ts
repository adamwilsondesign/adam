"use client";

import { useEffect, useLayoutEffect, useState } from "react";

const useIsomorphicLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

/**
 * Media-query state. Returns null during server rendering and resolves
 * before first paint on the client, so variant choices don't flash.
 */
export function useMediaQuery(query: string): boolean | null {
  const [matches, setMatches] = useState<boolean | null>(null);

  useIsomorphicLayoutEffect(() => {
    const list = window.matchMedia(query);
    setMatches(list.matches);
    const onChange = (event: MediaQueryListEvent) => setMatches(event.matches);
    list.addEventListener("change", onChange);
    return () => list.removeEventListener("change", onChange);
  }, [query]);

  return matches;
}

export const MOBILE_WORK_QUERY = "(max-width: 767px)";
