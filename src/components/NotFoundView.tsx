import Link from "next/link";

import styles from "./NotFoundView.module.css";

/**
 * The designed 404 state: same fixed shell, monochrome, restrained. Used for
 * unknown URLs and unknown or unpublished case-study slugs.
 */
export function NotFoundView() {
  return (
    <main className={styles.root}>
      <p className={styles.code} aria-hidden>
        404
      </p>
      <h1 className={styles.title}>This page isn’t part of the portfolio.</h1>
      <p className={styles.hint}>The work moved, or the address never existed.</p>
      <nav className={styles.links} aria-label="Recovery">
        <Link className={styles.link} href="/">
          Home
        </Link>
        <Link className={styles.link} href="/work">
          Work
        </Link>
      </nav>
    </main>
  );
}
