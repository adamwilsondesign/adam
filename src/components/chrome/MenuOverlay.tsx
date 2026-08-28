"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useRef } from "react";

import { CloseIcon } from "@/components/icons";
import { useFocusTrap } from "@/lib/use-focus-trap";

import styles from "./MenuOverlay.module.css";

type MenuOverlayProps = {
  open: boolean;
  pathname: string;
  onClose: () => void;
  onNavigate: (href: string) => void;
};

const SECTIONS: { label: string; href: string; available: boolean }[] = [
  { label: "Work", href: "/work", available: true },
  { label: "About", href: "/about", available: false },
  { label: "Blog", href: "/blog", available: false },
  { label: "Experiments", href: "/experiments", available: false },
];

/** The top-left menu: site sections, with unreleased ones clearly held back. */
export function MenuOverlay({ open, pathname, onClose, onNavigate }: MenuOverlayProps) {
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
            initial={reducedMotion ? { opacity: 0 } : { opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={reducedMotion ? { opacity: 0 } : { opacity: 0, x: -12 }}
            transition={{ duration: 0.24, ease: [0.32, 0.08, 0.24, 1] }}
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
                {SECTIONS.map((section) =>
                  section.available ? (
                    <li key={section.href}>
                      <button
                        type="button"
                        className={styles.link}
                        aria-current={pathname.startsWith(section.href) ? "page" : undefined}
                        onClick={() => onNavigate(section.href)}
                      >
                        {section.label}
                      </button>
                    </li>
                  ) : (
                    <li key={section.href}>
                      <span className={styles.linkDisabled}>
                        {section.label}
                        <span className={styles.soon}>Soon</span>
                      </span>
                    </li>
                  ),
                )}
              </ul>
            </nav>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
