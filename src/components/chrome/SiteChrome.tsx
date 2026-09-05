"use client";

import { AnimatePresence, motion } from "motion/react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { ArrowLeftIcon, LinkedInIcon, MailIcon } from "@/components/icons";
import type { NavSection } from "@/lib/content/model";
import { interceptShellNavigation } from "@/lib/shell-navigation";

import { ContactModal } from "./ContactModal";
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

/** Persistent home logo, contact controls and contextual Back navigation. */
export function SiteChrome({ title, logoUrl, contactUrl, linkedinUrl }: SiteChromeProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [contactOpen, setContactOpen] = useState(false);

  const mode =
    pathname === "/"
      ? "home"
      : pathname === "/secret"
        ? "secret"
        : pathname.startsWith("/work")
          ? "work"
          : pathname.startsWith("/about")
            ? "about"
            : "other";

  useEffect(() => {
    router.prefetch("/work");
    router.prefetch("/about");
  }, [router]);

  const navigate = (href: string) => {
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
            {mode === "work" || mode === "about" ? (
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

        {/* Contact and LinkedIn stay available on every route. */}
        <div className={`${styles.slot} ${styles.rightSlot}`}>
          <div className={`${styles.slotItem} ${styles.controlGroup}`}>
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
    </>
  );
}
