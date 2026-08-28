"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useRef } from "react";

import { CloseIcon } from "@/components/icons";
import type { NavSection } from "@/lib/content/model";
import { EASE_OUT } from "@/lib/motion";
import { useFocusTrap } from "@/lib/use-focus-trap";

import styles from "./MenuOverlay.module.css";

type MenuOverlayProps = {
  open: boolean;
  pathname: string;
  /** Available sections only — unreleased ones are hidden, never teased. */
  sections: NavSection[];
  onClose: () => void;
  onNavigate: (href: string) => void;
};

/** The top-left menu over the homepage: the available site sections. */
export function MenuOverlay({ open, pathname, sections, onClose, onNavigate }: MenuOverlayProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const reducedMotion = useReducedMotion();
  useFocusTrap(panelRef, open, { onEscape: onClose });

  return (
    <AnimatePresence>
      {open && (
        <div className={styles.root}>
          <motion.button
            type="button"
            className={styles.scrim}
            aria-label="Close menu"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label="Site menu"
            className={styles.panel}
            initial={reducedMotion ? { opacity: 0 } : { opacity: 0, x: -18 }}
            animate={{ opacity: 1, x: 0 }}
            exit={reducedMotion ? { opacity: 0 } : { opacity: 0, x: -18 }}
            transition={{ duration: 0.42, ease: EASE_OUT }}
          >
            <button
              type="button"
              className={styles.close}
              aria-label="Close menu"
              onClick={onClose}
            >
              <CloseIcon />
            </button>
            <nav aria-label="Site sections">
              <ul className={styles.list}>
                {sections.map((section, index) => (
                  <motion.li
                    key={section.href}
                    initial={reducedMotion ? { opacity: 0 } : { opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.5, delay: 0.08 + index * 0.05, ease: EASE_OUT }}
                  >
                    <button
                      type="button"
                      className={styles.link}
                      aria-current={pathname.startsWith(section.href) ? "page" : undefined}
                      onClick={() => onNavigate(section.href)}
                    >
                      {section.label}
                    </button>
                  </motion.li>
                ))}
              </ul>
            </nav>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
