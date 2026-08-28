"use client";

import { useEffect } from "react";

import styles from "./error.module.css";

/** Route-level error boundary for site pages. */
export default function SiteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className={styles.root}>
      <p className={styles.code} aria-hidden>
        Error
      </p>
      <h1 className={styles.title}>Something broke on this page.</h1>
      <p className={styles.hint}>
        {error.digest ? `Reference ${error.digest}. ` : null}
        Trying again usually resolves it.
      </p>
      <button type="button" className={styles.retry} onClick={reset}>
        Try again
      </button>
    </main>
  );
}
