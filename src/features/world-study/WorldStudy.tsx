"use client";

import { useReducedMotion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";

import { ContactModal } from "@/components/chrome/ContactModal";
import { PersonalLogo } from "@/components/chrome/PersonalLogo";
import { ArrowLeftIcon, LinkedInIcon, MailIcon } from "@/components/icons";
import { CoverMarquee } from "@/features/about/CoverMarquee";
import { ExperienceTimeline } from "@/features/about/ExperienceTimeline";
import { LogoMark } from "@/features/work/LogoMark";
import {
  clientTags,
  WORK_TAGS,
  type AboutPageContent,
  type HomePageContent,
  type SiteSettings,
  type WorkClient,
  type WorkTag,
} from "@/lib/content/model";

import styles from "./WorldStudy.module.css";

type StudyState = "home" | "work" | "about";
type StudyRenderer = {
  go(state: StudyState): void;
  setEmpty(empty: boolean): void;
  setScroll(progress: number): void;
  dispose(): void;
};

type WorldStudyProps = {
  home: HomePageContent;
  about: AboutPageContent;
  settings: SiteSettings;
  clients: WorkClient[];
};

/** CMS copy above one persistent renderer; only the camera changes location. */
export function WorldStudy({ home, about, settings, clients }: WorldStudyProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<StudyRenderer | null>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const destinationRef = useRef<StudyState>("home");
  const [state, setState] = useState<StudyState>("home");
  const [destination, setDestination] = useState<StudyState>("home");
  const [settled, setSettled] = useState(true);
  const [revealed, setRevealed] = useState(true);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);
  const [tags, setTags] = useState<WorkTag[]>([...WORK_TAGS]);
  const reducedMotion = useReducedMotion() ?? false;
  const visibleClients =
    tags.length === WORK_TAGS.length
      ? clients
      : clients.filter((client) => clientTags(client).some((tag) => tags.includes(tag)));
  const empty = visibleClients.length === 0;
  const emptyRef = useRef(empty);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let cancelled = false;
    let ownedRenderer: StudyRenderer | null = null;

    void import("./study-renderer")
      .then(({ createStudyRenderer }) => {
        if (cancelled) return null;
        return createStudyRenderer(canvas, {
          onReady: () => {
            if (!cancelled) setReady(true);
          },
          onState: (next: StudyState, arrived: boolean) => {
            if (cancelled) return;
            destinationRef.current = next;
            setDestination(next);
            setSettled(arrived);
            if (!arrived) setRevealed(false);
          },
          onReveal: (next: StudyState) => {
            if (cancelled) return;
            setState(next);
            setRevealed(true);
          },
          onError: (error: Error) => {
            if (cancelled) return;
            console.error("The motion study was interrupted.", error);
            setFailed(true);
            setReady(false);
          },
        });
      })
      .then((renderer) => {
        if (!renderer) return;
        if (cancelled) {
          renderer.dispose();
          return;
        }
        ownedRenderer = renderer;
        rendererRef.current = renderer;
        renderer.setEmpty(emptyRef.current);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        console.error("The motion study could not initialize.", error);
        setFailed(true);
      });

    return () => {
      cancelled = true;
      ownedRenderer?.dispose();
      if (rendererRef.current === ownedRenderer) rendererRef.current = null;
    };
  }, []);

  useEffect(() => {
    emptyRef.current = empty;
    rendererRef.current?.setEmpty(empty);
  }, [empty]);

  const navigate = useCallback((next: StudyState) => {
    if (!rendererRef.current) return;
    if (next === "about" && destinationRef.current !== "about") {
      if (scrollerRef.current) scrollerRef.current.scrollTop = 0;
      rendererRef.current.setScroll(0);
    }
    rendererRef.current.go(next);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || contactOpen) return;
      event.preventDefault();
      navigate("home");
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [contactOpen, navigate]);

  const show = (page: StudyState) => ready && revealed && state === page && !hidden;
  const interactive = (page: StudyState) => show(page) && settled;
  const toggleTag = (tag: WorkTag) => {
    setTags((current) =>
      current.includes(tag) ? current.filter((value) => value !== tag) : [...current, tag],
    );
  };

  return (
    <div className={styles.root} data-state={destination} data-ready={ready || undefined}>
      <canvas
        ref={canvasRef}
        className={styles.environment}
        aria-hidden
        data-study-world
        data-environment-canvas
      />

      <header className={styles.header}>
        <div className={styles.headerSlot}>
          {destination !== "home" ? (
            <button
              type="button"
              className={styles.control}
              aria-label="Back"
              onClick={() => navigate("home")}
            >
              <ArrowLeftIcon />
              <span className={styles.backLabel}>Back</span>
            </button>
          ) : null}
        </div>
        <button
          type="button"
          className={styles.personalLogo}
          aria-label={`${settings.title} — home`}
          onClick={() => navigate("home")}
        >
          <PersonalLogo title={settings.title} logoUrl={settings.logoUrl} />
        </button>
        <div className={`${styles.headerSlot} ${styles.contacts}`}>
          {settings.contactUrl ? (
            <button
              type="button"
              className={styles.control}
              aria-label="Contact"
              aria-haspopup="dialog"
              aria-expanded={contactOpen}
              onClick={() => setContactOpen(true)}
            >
              <MailIcon />
            </button>
          ) : null}
          {settings.linkedinUrl ? (
            <a
              className={styles.control}
              href={settings.linkedinUrl}
              target="_blank"
              rel="noreferrer"
              aria-label="LinkedIn (opens in a new tab)"
            >
              <LinkedInIcon />
            </a>
          ) : null}
        </div>
      </header>

      {!ready ? (
        <div className={styles.loading} role="status">
          {failed ? (
            <>
              <p>The environment couldn’t load.</p>
              <button type="button" onClick={() => window.location.reload()}>
                Try again
              </button>
            </>
          ) : (
            <p>Entering the atmosphere</p>
          )}
        </div>
      ) : null}

      <main>
        <section
          className={`${styles.panel} ${styles.home}`}
          data-visible={show("home") || undefined}
          aria-hidden={!interactive("home")}
          inert={!interactive("home")}
          aria-label="Home"
        >
          <div className={styles.homeColumn}>
            <p className={styles.homeIntro}>{home.intro}</p>
            <nav className={styles.homeNav} aria-label="Site sections">
              {settings.navigation.map((section) => {
                const target = section.href === "/work" ? "work" : "about";
                return section.available && ["/work", "/about"].includes(section.href) ? (
                  <a
                    key={section.href}
                    href={section.href}
                    onClick={(event) => {
                      event.preventDefault();
                      navigate(target);
                    }}
                  >
                    {section.label}
                  </a>
                ) : (
                  <span key={section.href} className={styles.unavailable}>
                    {section.label} <span>soon</span>
                  </span>
                );
              })}
            </nav>
          </div>
          <footer className={styles.homeFooter}>
            <span>
              Selected work, {settings.workStartYear}–{settings.workEndYear}
            </span>
            <span>© {new Date().getFullYear()}</span>
          </footer>
        </section>

        <section
          className={`${styles.panel} ${styles.work}`}
          data-visible={show("work") || undefined}
          aria-hidden={!interactive("work")}
          inert={!interactive("work")}
          aria-label="Work"
        >
          <h1 className="visually-hidden">Selected work</h1>
          <ul
            className={styles.clientGrid}
            aria-label="Clients"
            data-empty={empty || undefined}
            aria-hidden={empty}
            inert={empty}
          >
            {(empty ? clients : visibleClients).map((client) => {
              const aspect = Math.max(0.35, client.logoAspect);
              const markStyle = {
                width: `${Math.min(90, 39 * Math.sqrt(aspect))}%`,
                aspectRatio: aspect,
                maxHeight: "68%",
                transform: `scale(${client.logoTreatment?.scale ?? 1})`,
              };
              const mark = (
                <span className={styles.logoMark} style={markStyle}>
                  <LogoMark logoUrl={client.logoUrl} treatment={client.logoTreatment} />
                </span>
              );
              return (
                <li key={client.id} className={styles.client}>
                  {client.caseStudy ? (
                    <a
                      href={`/work/${client.caseStudy.slug}`}
                      target="_blank"
                      rel="noreferrer"
                      className={styles.clientLink}
                      aria-label={`${client.name} — view case study in a new tab`}
                      title={client.description}
                    >
                      {mark}
                    </a>
                  ) : (
                    <span
                      className={styles.clientLink}
                      role="img"
                      aria-label={client.name}
                      title={client.description}
                    >
                      {mark}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>

          <div className={styles.emptyCaption} data-visible={empty || undefined} aria-live="polite">
            {empty ? (
              <>
                <h2>nothing to see here</h2>
                <p>select all or a tag to bring the work back</p>
              </>
            ) : null}
          </div>

          <div className={styles.filterDock} aria-label="Work filters">
            <div className={styles.tags}>
              <button
                type="button"
                aria-pressed={tags.length === WORK_TAGS.length}
                onClick={() => setTags(tags.length === WORK_TAGS.length ? [] : [...WORK_TAGS])}
              >
                All
              </button>
              {WORK_TAGS.map((tag) => (
                <button
                  type="button"
                  key={tag}
                  aria-pressed={tags.includes(tag)}
                  onClick={() => toggleTag(tag)}
                >
                  {tag}
                </button>
              ))}
            </div>
            <div className={styles.workRange}>
              <span>
                {String(visibleClients.length).padStart(2, "0")} / {clients.length}
              </span>
              <span>{settings.workStartYear}</span>
              <span className={styles.rangeLine} aria-hidden />
              <span>{settings.workEndYear}</span>
            </div>
          </div>
        </section>

        <div
          ref={scrollerRef}
          className={`${styles.panel} ${styles.aboutScroller}`}
          data-visible={show("about") || undefined}
          aria-hidden={!interactive("about")}
          inert={!interactive("about")}
          onScroll={(event) => {
            const progress = event.currentTarget.scrollTop / (window.innerHeight * 0.85);
            rendererRef.current?.setScroll(Math.min(1, Math.max(0, progress)));
          }}
        >
          <section className={styles.aboutHero} aria-label="About">
            <div className={styles.column}>
              <h1 className="visually-hidden">About</h1>
              <p className={styles.aboutIntro}>{about.intro}</p>
              <dl className={styles.facts}>
                {about.facts.map((fact) => (
                  <div key={fact.label}>
                    <dt>{fact.label}</dt>
                    <dd>{fact.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </section>

          <section className={styles.aboutSection}>
            <div className={styles.column}>
              <p className={styles.statement}>{about.careerStatement}</p>
            </div>
          </section>
          <section className={styles.aboutSection} aria-labelledby="study-experience">
            <div className={styles.column}>
              <h2 id="study-experience" className={styles.sectionLabel}>
                {about.experienceLabel}
              </h2>
            </div>
            <ExperienceTimeline label={about.experienceLabel} entries={about.experience} />
          </section>
          <section className={styles.aboutSection} aria-labelledby="study-principles">
            <div className={styles.column}>
              <h2 id="study-principles" className={styles.sectionLabel}>
                {about.principlesLabel}
              </h2>
              <ul className={styles.principles}>
                {about.principles.map((principle) => (
                  <li key={principle.title}>
                    <h3>{principle.title}</h3>
                    <p>{principle.body}</p>
                  </li>
                ))}
              </ul>
            </div>
          </section>
          <section className={styles.aboutSection}>
            <div className={`${styles.column} ${styles.shelves}`}>
              {[
                { label: about.moviesLabel, items: about.movies, direction: 1 as const },
                { label: about.booksLabel, items: about.books, direction: -1 as const },
              ].map((shelf) => (
                <div key={shelf.label} className={styles.shelf}>
                  <h2 className={styles.sectionLabel}>{shelf.label}</h2>
                  <CoverMarquee
                    label={shelf.label}
                    items={shelf.items}
                    direction={shelf.direction}
                    reducedMotion={reducedMotion || state !== "about" || !settled || hidden}
                  />
                </div>
              ))}
            </div>
          </section>
          <section className={`${styles.aboutSection} ${styles.aboutContact}`}>
            <div className={styles.column}>
              <h2>{about.contactHeading}</h2>
              <p>{about.contactBody}</p>
              {settings.contactUrl ? (
                <a href={settings.contactUrl}>{about.contactCtaLabel}</a>
              ) : null}
            </div>
          </section>
        </div>
      </main>

      <div className={styles.studyControls}>
        <span className={styles.studyLabel}>Motion study</span>
        {hidden ? (
          <nav aria-label="Explore the world" className={styles.studyNav}>
            {(["home", "work", "about"] as const).map((page) => (
              <button
                key={page}
                type="button"
                aria-current={destination === page ? "page" : undefined}
                onClick={() => navigate(page)}
                disabled={!ready}
              >
                {page}
              </button>
            ))}
          </nav>
        ) : null}
        <button type="button" aria-pressed={hidden} onClick={() => setHidden(!hidden)}>
          {hidden ? "Show content" : "Hide content"}
        </button>
      </div>

      <ContactModal
        open={contactOpen}
        contactUrl={settings.contactUrl}
        onClose={() => setContactOpen(false)}
      />
    </div>
  );
}
