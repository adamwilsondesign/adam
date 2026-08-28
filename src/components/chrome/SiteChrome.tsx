"use client";

import { AnimatePresence, motion } from "motion/react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { ArrowLeftIcon, MenuIcon, ThemeIcon } from "@/components/icons";
import { useTheme } from "@/components/theme/ThemeProvider";
import { interceptShellNavigation } from "@/lib/shell-navigation";

import { MenuOverlay } from "./MenuOverlay";
import { PersonalLogo } from "./PersonalLogo";
import styles from "./SiteChrome.module.css";

type SiteChromeProps = {
  title: string;
  logoUrl: string | null;
  contactUrl: string | null;
};

const slotTransition = { duration: 0.16, ease: "easeOut" as const };

/**
 * The persistent shell chrome: menu / back at top left, the personal logo
 * centred, theme and contact at top right (homepage only). It stays mounted
 * across routes so the shell reads as one continuous interface.
 */
export function SiteChrome({ title, logoUrl, contactUrl }: SiteChromeProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { toggleTheme } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);

  const mode = pathname === "/" ? "home" : pathname.startsWith("/work") ? "work" : "other";

  useEffect(() => {
    router.prefetch("/work");
  }, [router]);

  const navigate = (href: string) => {
    setMenuOpen(false);
    if (pathname === href) return;
    if (!interceptShellNavigation(href)) router.push(href);
  };

  return (
    <>
      <header className={styles.header}>
        <div className={styles.slot}>
          <AnimatePresence mode="wait" initial={false}>
            {mode === "work" ? (
              <motion.div
                key="back"
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
            ) : (
              <motion.div
                key="menu"
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
            )}
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

        <div className={`${styles.slot} ${styles.rightSlot}`}>
          <AnimatePresence initial={false}>
            {mode !== "work" && (
              <motion.div
                key="home-controls"
                className={styles.controlGroup}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={slotTransition}
              >
                <button
                  type="button"
                  className={styles.control}
                  aria-label="Toggle colour theme"
                  onClick={toggleTheme}
                >
                  <ThemeIcon />
                </button>
                {contactUrl ? (
                  <a className={styles.control} href={contactUrl}>
                    <span className={`${styles.controlLabel} ${styles.controlLabelKeep}`}>
                      Contact
                    </span>
                  </a>
                ) : null}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </header>

      <MenuOverlay
        open={menuOpen}
        pathname={pathname}
        onClose={() => setMenuOpen(false)}
        onNavigate={navigate}
      />
    </>
  );
}
