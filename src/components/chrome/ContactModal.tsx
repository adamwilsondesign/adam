"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useId, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";

import { CloseIcon } from "@/components/icons";
import { EASE_EXIT, EASE_OUT } from "@/lib/motion";
import { useFocusTrap } from "@/lib/use-focus-trap";

import styles from "./ContactModal.module.css";

type ContactModalProps = {
  open: boolean;
  /** `mailto:` address (or URL) the composed message is sent through. */
  contactUrl: string | null;
  onClose: () => void;
};

type Fields = {
  name: string;
  email: string;
  company: string;
  position: string;
  message: string;
};

const EMPTY: Fields = { name: "", email: "", company: "", position: "", message: "" };

/**
 * The contact dialog: a ruled plate over a frosted page. Name, email and
 * message are required; company and position optional. There is no form
 * backend yet — submitting composes the message into the configured mailto:
 * address and opens the visitor's mail app. (TODO: swap the mailto compose
 * for a real endpoint when one exists.)
 */
export function ContactModal({ open, contactUrl, onClose }: ContactModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const reducedMotion = useReducedMotion();
  const titleId = useId();
  const [fields, setFields] = useState<Fields>(EMPTY);
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  useFocusTrap(panelRef, open, { onEscape: onClose });

  const mailAddress = contactUrl?.startsWith("mailto:")
    ? (contactUrl.slice("mailto:".length).split("?")[0] ?? "")
    : null;

  const set =
    (key: keyof Fields) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setFields((current) => ({ ...current, [key]: event.target.value }));

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!mailAddress) return;
    const subject = `Portfolio contact — ${fields.name}`;
    const bodyLines = [
      fields.message,
      "",
      "—",
      `${fields.name} <${fields.email}>`,
      [fields.position, fields.company].filter(Boolean).join(", "),
    ].filter((line) => line !== null);
    const href = `mailto:${mailAddress}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(bodyLines.join("\n"))}`;
    window.location.href = href;
    onClose();
    setFields(EMPTY);
  };

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className={styles.root}>
          <motion.button
            type="button"
            className={styles.scrim}
            aria-label="Close contact form"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.24, ease: EASE_OUT }}
          />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className={styles.panel}
            initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={
              reducedMotion
                ? { opacity: 0, transition: { duration: 0.14 } }
                : { opacity: 0, y: 12, transition: { duration: 0.22, ease: EASE_EXIT } }
            }
            transition={{ duration: 0.4, ease: EASE_OUT }}
          >
            <button type="button" className={styles.close} aria-label="Close" onClick={onClose}>
              <CloseIcon />
            </button>

            <h2 id={titleId} className={styles.title}>
              Get in touch
            </h2>
            <p className={styles.subtitle}>
              Tell me a little about your project — I’ll reply by email.
            </p>

            <form className={styles.form} onSubmit={handleSubmit}>
              <div className={styles.row}>
                <label className={styles.field}>
                  <span className={styles.label}>name *</span>
                  <input
                    className={styles.input}
                    type="text"
                    name="name"
                    autoComplete="name"
                    required
                    value={fields.name}
                    onChange={set("name")}
                  />
                </label>
                <label className={styles.field}>
                  <span className={styles.label}>email *</span>
                  <input
                    className={styles.input}
                    type="email"
                    name="email"
                    autoComplete="email"
                    required
                    value={fields.email}
                    onChange={set("email")}
                  />
                </label>
              </div>
              <div className={styles.row}>
                <label className={styles.field}>
                  <span className={styles.label}>company</span>
                  <input
                    className={styles.input}
                    type="text"
                    name="organization"
                    autoComplete="organization"
                    value={fields.company}
                    onChange={set("company")}
                  />
                </label>
                <label className={styles.field}>
                  <span className={styles.label}>position</span>
                  <input
                    className={styles.input}
                    type="text"
                    name="organization-title"
                    autoComplete="organization-title"
                    value={fields.position}
                    onChange={set("position")}
                  />
                </label>
              </div>
              <label className={styles.field}>
                <span className={styles.label}>message *</span>
                <textarea
                  className={`${styles.input} ${styles.textarea}`}
                  name="message"
                  rows={5}
                  required
                  value={fields.message}
                  onChange={set("message")}
                />
              </label>

              <div className={styles.actions}>
                <button type="submit" className={styles.submit} disabled={!mailAddress}>
                  send message
                </button>
                <p className={styles.note}>
                  {mailAddress
                    ? "opens your mail app with the message ready to send"
                    : "no contact address is configured yet"}
                </p>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
