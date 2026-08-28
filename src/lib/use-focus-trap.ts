"use client";

import { useEffect, useRef, type RefObject } from "react";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

type FocusTrapOptions = {
  onEscape?: () => void;
  /**
   * What to focus when the trap activates: a selector, or "container" to
   * focus the trapped element itself (give it tabIndex={-1}) — avoids a
   * focus ring on controls when a dialog opens from a pointer interaction.
   */
  initialFocus?: string | "container";
};

/**
 * Traps Tab focus inside `ref` while `active`, dismisses on Escape, and
 * restores focus to the previously focused element when released.
 */
export function useFocusTrap(
  ref: RefObject<HTMLElement | null>,
  active: boolean,
  options: FocusTrapOptions = {},
): void {
  const optionsRef = useRef(options);
  useEffect(() => {
    optionsRef.current = options;
  });

  useEffect(() => {
    if (!active) return;
    const container = ref.current;
    if (!container) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;

    const focusables = () =>
      Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (element) => element.offsetParent !== null || element === document.activeElement,
      );

    const initialSelector = optionsRef.current.initialFocus;
    const initial =
      initialSelector === "container"
        ? container
        : ((initialSelector ? container.querySelector<HTMLElement>(initialSelector) : null) ??
          focusables()[0] ??
          container);
    initial.focus({ preventScroll: true });

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        optionsRef.current.onEscape?.();
        return;
      }
      if (event.key !== "Tab") return;
      const items = focusables();
      if (items.length === 0) {
        event.preventDefault();
        return;
      }
      const first = items[0] as HTMLElement;
      const last = items[items.length - 1] as HTMLElement;
      const current = document.activeElement as HTMLElement | null;
      if (event.shiftKey && (current === first || !container.contains(current))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (current === last || !container.contains(current))) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown, true);
    return () => {
      document.removeEventListener("keydown", handleKeyDown, true);
      previouslyFocused?.focus({ preventScroll: true });
    };
  }, [ref, active]);
}
