"use client";

import { motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import type { NavSection, YearRange } from "@/lib/content/model";
import { DUR, EASE_EXIT, EASE_OUT } from "@/lib/motion";

import { CloudsBackground } from "./CloudsBackground";
import styles from "./HomeView.module.css";

type HomeViewProps = {
  /** The introductory statement, from site settings (Sanity-editable later). */
  intro: string;
  /** Site sections; unavailable ones render as quiet "soon" placeholders. */
  sections: NavSection[];
  workRange: YearRange;
};

const EXIT_DURATION = 0.3;

/**
 * The homepage shell: a fixed viewport with the introductory statement and
 * the section index. Opening Work fades this interface away before the logo
 * field populates, so the change reads as one continuous surface.
 */
export function HomeView({ intro, sections, workRange }: HomeViewProps) {
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

  const enter = (delay: number) =>
    reducedMotion
      ? {
          initial: { opacity: 0 },
          animate: { opacity: 1 },
          transition: { duration: 0.2, delay: delay / 2 },
        }
      : {
          initial: { opacity: 0, y: 16 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.7, delay, ease: EASE_OUT },
        };

  return (
    <motion.div
      className={styles.root}
      animate={leaving ? { opacity: 0 } : { opacity: 1 }}
      initial={false}
      transition={{
        duration: leaving ? EXIT_DURATION : DUR.fast,
        ease: leaving ? EASE_EXIT : EASE_OUT,
      }}
    >
      <CloudsBackground />
      <div className={styles.column}>
        <motion.p className={styles.intro} {...enter(0.05)}>
          {intro}
        </motion.p>

        <nav className={styles.nav} aria-label="Site sections">
          <ul className={styles.navList}>
            {sections.map((section, index) => (
              <motion.li key={section.href} {...enter(0.16 + index * 0.07)}>
                {section.available ? (
                  <Link
                    className={styles.navLink}
                    href={section.href}
                    onClick={section.href === "/work" ? openWork : undefined}
                  >
                    {section.label}
                  </Link>
                ) : (
                  <span className={styles.navDisabled}>
                    {section.label}
                    <span className={styles.soon}>soon</span>
                  </span>
                )}
              </motion.li>
            ))}
          </ul>
        </nav>

        <motion.footer className={styles.footer} {...enter(0.42)}>
          <span>
            Selected work, {workRange.start}–{workRange.end}
          </span>
          <span>© {new Date().getFullYear()}</span>
        </motion.footer>
      </div>
    </motion.div>
  );
}
