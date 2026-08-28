"use client";

/**
 * Lets the currently mounted page state intercept shell-level navigation
 * (the header logo, back control, menu links) so it can play its exit
 * animation before the route actually changes — keeping home ⇄ work feeling
 * like one continuous interface rather than page loads.
 */

type ShellNavigationInterceptor = (href: string) => boolean;

let interceptor: ShellNavigationInterceptor | null = null;

export function setShellNavigationInterceptor(next: ShellNavigationInterceptor | null): void {
  interceptor = next;
}

/**
 * Returns true when an interceptor took over (it becomes responsible for
 * completing the navigation); false when the caller should navigate normally.
 */
export function interceptShellNavigation(href: string): boolean {
  return interceptor ? interceptor(href) : false;
}
