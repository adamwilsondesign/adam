import type { Metadata } from "next";

import styles from "./secret.module.css";

export const metadata: Metadata = {
  title: "…",
  robots: { index: false, follow: false },
};

/**
 * The bottom of the fall. Reached only through the doorway in the emptied
 * Work grid. Deliberately outside the theme — black, quiet, unfinished.
 * Something will be built down here.
 */
export default function SecretPage() {
  return (
    <main className={styles.root}>
      <div className={styles.center}>
        <p className={styles.line}>you found the door.</p>
        <p className={styles.sub}>something will be built down here.</p>
      </div>
    </main>
  );
}
