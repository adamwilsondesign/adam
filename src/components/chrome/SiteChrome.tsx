"use client";

import { AnimatePresence, motion } from "motion/react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { ArrowLeftIcon, LinkedInIcon, MailIcon, MenuIcon, ThemeIcon } from "@/components/icons";
import { useTheme } from "@/components/theme/ThemeProvider";
import type { NavSection } from "@/lib/content/model";
import { interceptShellNavigation } from "@/lib/shell-navigation";

import { ContactModal } from "./ContactModal";
import { MenuOverlay } from "./MenuOverlay";
import { PersonalLogo } from "./PersonalLogo";
import styles from "./SiteChrome.module.css";

type SiteChromeProps = {
  title: string;
  logoUrl: string | null;
  contactUrl: string | null;
  linkedinUrl: string | null;
  navigation: NavSection[];
};

const slotTransition = { duration: 0.18, ease: [0.22, 1, 0.36, 1] as const };

/**
 * The persistent shell chrome: back (or menu) at top left, the personal logo
 * centred, theme and contact at top right on every route. It stays mounted
 * across routes so the shell reads as one continuous interface.
 *
 * The header resolves instantly per route (the left-slot swap crossfades in
 * place, so no impossible combination ever renders); the menu appears only
 * when more than one section exists for it to navigate, since a menu that
 * duplicates the visible homepage index adds nothing.
 */
export function SiteChrome({
  title,
  logoUrl,
  contactUrl,
  linkedinUrl,
  navigation,
}: SiteChromeProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { toggleTheme } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);

  const mode =
    pathname === "/"
      ? "home"
      : pathname === "/secret"
        ? "secret"
        : pathname.startsWith("/work")
          ? "work"
          : "other";
  const availableSections = navigation.filter((section) => section.available);
  const showMenu = availableSections.length > 1;

  useEffect(() => {
    router.prefetch("/work");
  }, [router]);

  const navigate = (href: string) => {
    setMenuOpen(false);
    if (pathname === href) return;
    if (!interceptShellNavigation(href)) router.push(href);
  };

  // Down the secret hole every piece of normal chrome disappears; only a
  // way back remains.
  if (mode === "secret") {
    return (
      <button
        type="button"
        className={styles.secretBack}
        onClick={() => {
          if (window.history.length > 1) router.back();
          else router.push("/");
        }}
      >
        <ArrowLeftIcon />
        <span>back</span>
      </button>
    );
  }

  return (
    <>
      <header className={styles.header}>
        <div className={styles.slot}>
          <AnimatePresence initial={false}>
            {mode === "work" ? (
              <motion.div
                key="back"
                className={styles.slotItem}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={slotTransition}
              >
                <button type="button" className={styles.control} onClick={() => navigate("/")}>
                  <ArrowLeftIcon />
                  <span className={styles.controlLabel}>Back</span>
                </button>
              </motion.div>
            ) : showMenu ? (
              <motion.div
                key="menu"
                className={styles.slotItem}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={slotTransition}
              >
                <button
                  type="button"
                  className={styles.control}
                  aria-haspopup="dialog"
                  aria-expanded={menuOpen}
                  onClick={() => setMenuOpen(true)}
                >
                  <MenuIcon />
                  <span className={styles.controlLabel}>Menu</span>
                </button>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>

        <div className={styles.centerSlot}>
          <button
            type="button"
            className={styles.logoButton}
            aria-label={`${title} — home`}
            onClick={() => navigate("/")}
          >
            <PersonalLogo title={title} logoUrl={logoUrl} />
          </button>
        </div>

        {/* Theme, contact and LinkedIn stay available on every route. */}
        <div className={`${styles.slot} ${styles.rightSlot}`}>
          <div className={`${styles.slotItem} ${styles.controlGroup}`}>
            <button
              type="button"
              className={styles.control}
              aria-label="Toggle colour theme"
              onClick={toggleTheme}
            >
              <ThemeIcon />
            </button>
            {contactUrl ? (
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
            {linkedinUrl ? (
              <a
                className={styles.control}
                href={linkedinUrl}
                target="_blank"
                rel="noreferrer"
                aria-label="LinkedIn (opens in a new tab)"
              >
                <LinkedInIcon />
              </a>
            ) : null}
          </div>
        </div>
      </header>

      <ContactModal
        open={contactOpen}
        contactUrl={contactUrl}
        onClose={() => setContactOpen(false)}
      />

      {showMenu ? (
        <MenuOverlay
          open={menuOpen}
          pathname={pathname}
          sections={availableSections}
          onClose={() => setMenuOpen(false)}
          onNavigate={navigate}
        />
      ) : null}
    </>
  );
}
