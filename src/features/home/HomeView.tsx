"use client";

import { motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import styles from "./HomeView.module.css";

type HomeViewProps = {
  intro: string;
};

const SECTIONS = [
  { label: "Work", href: "/work", available: true },
  { label: "About", href: "/about", available: false },
  { label: "Blog", href: "/blog", available: false },
  { label: "Experiments", href: "/experiments", available: false },
] as const;

const EXIT_DURATION = 0.26;

/**
 * The homepage shell: a fixed viewport with the introductory statement and
 * the section index. Opening Work fades this interface away before the logo
 * field populates, so the change reads as one continuous surface.
 */
export function HomeView({ intro }: HomeViewProps) {
  const router = useRouter();
  const reducedMotion = useReducedMotion();
  const [leaving, setLeaving] = useState(false);
  const navigatingRef = useRef(false);

  const openWork = (event: React.MouseEvent<HTMLAnchorElement>) => {
    // Plain anchor semantics stay intact for modified clicks / new tabs.
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0)
      return;
    event.preventDefault();
    if (navigatingRef.current) return;
    navigatingRef.current = true;
    setLeaving(true);
    window.setTimeout(() => router.push("/work"), reducedMotion ? 0 : EXIT_DURATION * 1000);
  };

  const enter = reducedMotion
    ? { initial: { opacity: 0 }, animate: { opacity: 1 } }
    : { initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0 } };

  return (
    <motion.div
      className={styles.root}
      animate={leaving ? { opacity: 0 } : { opacity: 1 }}
      transition={{ duration: leaving ? EXIT_DURATION : 0.3, ease: [0.32, 0.08, 0.24, 1] }}
    >
      <div className={styles.column}>
        <motion.p
          className={styles.intro}
          {...enter}
          transition={{ duration: 0.5, delay: 0.05, ease: [0.32, 0.08, 0.24, 1] }}
        >
          {intro}
        </motion.p>

        <nav className={styles.nav} aria-label="Site sections">
          <ul className={styles.navList}>
            {SECTIONS.map((section, index) => (
              <motion.li
                key={section.href}
                {...enter}
                transition={{
                  duration: 0.5,
                  delay: 0.14 + index * 0.06,
                  ease: [0.32, 0.08, 0.24, 1],
                }}
              >
                {section.available ? (
                  <Link className={styles.navLink} href={section.href} onClick={openWork}>
                    {section.label}
                    <span className={styles.navArrow} aria-hidden>
                      ›
                    </span>
                  </Link>
                ) : (
                  <span className={styles.navDisabled}>
                    {section.label}
                    <span className={styles.soon}>Soon</span>
                  </span>
                )}
              </motion.li>
            ))}
          </ul>
        </nav>

        <motion.footer
          className={styles.footer}
          {...enter}
          transition={{ duration: 0.5, delay: 0.44, ease: [0.32, 0.08, 0.24, 1] }}
        >
          <span>Selected work, 2010–2026</span>
          <span>© {new Date().getFullYear()}</span>
        </motion.footer>
      </div>
    </motion.div>
  );
}
