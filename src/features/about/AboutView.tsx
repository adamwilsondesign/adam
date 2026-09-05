"use client";

import { useReducedMotion } from "motion/react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { setAboutScrollProgress } from "@/features/sky/sky-director";
import type { AboutPageContent } from "@/lib/content/model";
import { setShellNavigationInterceptor } from "@/lib/shell-navigation";

import { claimAboutArrival, consumeAboutArrival } from "./about-transition";
import { ABOUT_TIMINGS, AboutScene, type AboutScenePhase } from "./AboutScene";
import { CoverMarquee } from "./CoverMarquee";
import { ExperienceTimeline } from "./ExperienceTimeline";
import styles from "./AboutView.module.css";

type AboutViewProps = {
  content: AboutPageContent;
  /** Sanitized contact URL from site settings; null hides the CTA. */
  contactUrl: string | null;
};

/**
 * The About page: a fixed valley environment (AboutScene) with the page's
 * own scroller above it. Arriving from the homepage plays the descent —
 * content held back until the environment settles; leaving through the shell
 * reverses it. One normalized scroll progress drives the environment's
 * forward travel while the text scrolls conventionally.
 */
export function AboutView({ content, contactUrl }: AboutViewProps) {
  const router = useRouter();
  const reducedMotion = useReducedMotion() ?? false;

  /* Resolved in the initializer so the first client render can't mismatch
     the descent decision (arrivals only happen on soft navigation, so the
     server markup — always "settled" — is never hydrated against them).
     Reduced motion lands settled directly: the root's entry crossfade is the
     whole arrival. */
  const [arriving] = useState(
    () => typeof window !== "undefined" && !reducedMotion && consumeAboutArrival(),
  );
  const [isMobile] = useState(() => typeof window !== "undefined" && window.innerWidth < 768);
  const timings = isMobile ? ABOUT_TIMINGS.mobile : ABOUT_TIMINGS.desktop;

  const [phase, setPhase] = useState<AboutScenePhase>(arriving ? "arriving" : "settled");
  const [revealed, setRevealed] = useState(!arriving);
  const [locked, setLocked] = useState(arriving);
  const [leaving, setLeaving] = useState(false);
  const navigatingRef = useRef(false);
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const scrollProgressRef = useRef(0);

  /* The arrival timeline: environment first, copy at ~1.05s, interaction
     released just after, settled at the end. */
  useEffect(() => {
    // A pending flag never outlives this mount, whichever way it resolved.
    claimAboutArrival();
    if (!arriving) return;
    /* Once an exit begins, arrival timers stand down — a straggling settle
       or guard firing mid-reverse would flip the copy and pose back on. */
    const unlessLeaving = (apply: () => void) => () => {
      if (!navigatingRef.current) apply();
    };
    const reveal = window.setTimeout(
      unlessLeaving(() => setRevealed(true)),
      timings.reveal,
    );
    const unlock = window.setTimeout(
      unlessLeaving(() => setLocked(false)),
      timings.unlock,
    );
    const settle = window.setTimeout(
      unlessLeaving(() => setPhase("settled")),
      timings.arrival,
    );
    /* Never leave the page locked if a timer is lost to a background tab. */
    const guard = window.setTimeout(
      unlessLeaving(() => {
        setPhase("settled");
        setRevealed(true);
        setLocked(false);
      }),
      timings.arrival + 1500,
    );
    return () => {
      window.clearTimeout(reveal);
      window.clearTimeout(unlock);
      window.clearTimeout(settle);
      window.clearTimeout(guard);
    };
  }, [arriving, reducedMotion, timings]);

  /* Shell navigation (back control, logo, menu) reverses the arrival: copy
     fades first, a deep-scrolled page resets invisibly, then the camera
     rises back through the clouds and the route changes underneath it. */
  useEffect(() => {
    setShellNavigationInterceptor((href) => {
      if (navigatingRef.current) return true;
      navigatingRef.current = true;
      setLeaving(true);
      setRevealed(false);
      if (href === "/" && !reducedMotion) {
        window.setTimeout(() => {
          setPhase("leaving");
        }, ABOUT_TIMINGS.contentFade);
        window.setTimeout(
          () => router.push(href),
          ABOUT_TIMINGS.contentFade + ABOUT_TIMINGS.reverse + 60,
        );
      } else {
        window.setTimeout(() => router.push(href), reducedMotion ? ABOUT_TIMINGS.reducedFade : 220);
      }
      return true;
    });
    return () => setShellNavigationInterceptor(null);
  }, [router, reducedMotion]);

  const onScroll = (event: React.UIEvent<HTMLDivElement>) => {
    const progress = event.currentTarget.scrollTop / (window.innerHeight * 0.85);
    scrollProgressRef.current = Math.min(1, Math.max(0, progress));
    // The surreal orb observes the valley travel through the sky director.
    setAboutScrollProgress(scrollProgressRef.current);
  };

  /* Leaving About returns the shared scroll observer to its resting value. */
  useEffect(() => () => setAboutScrollProgress(0), []);

  return (
    <div
      className={styles.root}
      data-revealed={revealed || undefined}
      data-locked={locked || undefined}
      data-leaving={leaving || undefined}
      data-settled-entry={!arriving || undefined}
    >
      <AboutScene
        phase={phase}
        arrivalMs={timings.arrival}
        scrollProgress={scrollProgressRef}
        reducedMotion={reducedMotion}
      />

      <div ref={scrollerRef} className={styles.scroller} onScroll={onScroll}>
        <section className={styles.hero}>
          <h1 className="visually-hidden">About</h1>
          <div className={styles.column}>
            <p className={styles.intro}>{content.intro}</p>
            <dl className={styles.facts}>
              {content.facts.map((fact) => (
                <div key={fact.label} className={styles.fact}>
                  <dt>{fact.label}</dt>
                  <dd>{fact.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        <div className={styles.body}>
          <section className={styles.section}>
            <div className={styles.column}>
              <p className={styles.statement}>{content.careerStatement}</p>
            </div>
          </section>

          <section className={styles.section} aria-labelledby="about-experience">
            <div className={styles.column}>
              <h2 id="about-experience" className={styles.sectionLabel}>
                {content.experienceLabel}
              </h2>
            </div>
            <ExperienceTimeline label={content.experienceLabel} entries={content.experience} />
          </section>

          <section className={styles.section} aria-labelledby="about-principles">
            <div className={styles.column}>
              <h2 id="about-principles" className={styles.sectionLabel}>
                {content.principlesLabel}
              </h2>
              <ul className={styles.principles}>
                {content.principles.map((principle) => (
                  <li key={principle.title} className={styles.principle}>
                    <h3>{principle.title}</h3>
                    <p>{principle.body}</p>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          <section className={styles.section}>
            <div className={`${styles.column} ${styles.shelves}`}>
              <div className={styles.shelf} aria-labelledby="about-movies">
                <h2 id="about-movies" className={styles.sectionLabel}>
                  {content.moviesLabel}
                </h2>
                <CoverMarquee
                  label={content.moviesLabel}
                  items={content.movies}
                  direction={1}
                  reducedMotion={reducedMotion}
                />
              </div>
              <div className={styles.shelf} aria-labelledby="about-books">
                <h2 id="about-books" className={styles.sectionLabel}>
                  {content.booksLabel}
                </h2>
                <CoverMarquee
                  label={content.booksLabel}
                  items={content.books}
                  direction={-1}
                  reducedMotion={reducedMotion}
                />
              </div>
            </div>
          </section>

          <section className={styles.contact}>
            <div className={styles.column}>
              <h2 className={styles.contactHeading}>{content.contactHeading}</h2>
              <p className={styles.contactBody}>{content.contactBody}</p>
              {contactUrl ? (
                <a className={styles.cta} href={contactUrl}>
                  {content.contactCtaLabel}
                </a>
              ) : null}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
