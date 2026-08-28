"use client";

import { usePathname } from "next/navigation";
import { useSyncExternalStore } from "react";

import styles from "./DisableDraftMode.module.css";

const subscribeNoop = () => () => undefined;

/**
 * Floating control to leave draft mode — hidden inside the Presentation
 * tool's iframe, where Studio owns the preview lifecycle.
 */
export function DisableDraftMode() {
  const pathname = usePathname();
  const environment = useSyncExternalStore(
    subscribeNoop,
    () => (window.self !== window.top ? "iframe" : "top"),
    () => "server",
  );
  if (environment !== "top") return null;
  return (
    <a
      className={styles.button}
      href={`/api/draft-mode/disable?to=${encodeURIComponent(pathname)}`}
    >
      Previewing drafts — click to exit
    </a>
  );
}
