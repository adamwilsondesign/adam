/**
 * Provider-agnostic analytics.
 *
 * The site reports a small set of typed interaction events through `track`.
 * No provider ships by default: events are logged to the console in
 * development and dropped in production until a provider is registered.
 *
 * To connect a provider (Vercel Analytics, Plausible, a custom endpoint...),
 * call `setAnalyticsProvider` once from a client component, e.g.:
 *
 *   setAnalyticsProvider((event) => plausible(event.name, { props: event }));
 *
 * Events:
 *   work_opened / work_closed         entering and leaving the Work state
 *   work_tag_toggled                  a tag pill change (rejected = blocked
 *                                     because it would have emptied the grid)
 *   work_years_changed                a settled year-range change
 *   client_info_opened                informational tooltip/card opened
 *   case_study_opened                 case study opened (grid or direct URL)
 *   case_study_media_viewed           a gallery item scrolled into view
 *   external_link_followed            outbound project link clicked
 *   theme_changed                     light/dark toggle
 */

import type { WorkTag } from "@/lib/content/model";

export type AnalyticsEvent =
  | { name: "work_opened" }
  | { name: "work_closed" }
  | { name: "work_tag_toggled"; tag: WorkTag; active: boolean; rejected: boolean }
  | { name: "work_tags_cleared" }
  | { name: "work_shuffled" }
  | { name: "work_years_changed"; start: number; end: number }
  | { name: "client_info_opened"; clientId: string }
  | { name: "case_study_opened"; slug: string; source: "grid" | "direct" }
  | { name: "case_study_media_viewed"; slug: string; index: number }
  | { name: "external_link_followed"; slug: string; url: string }
  | { name: "theme_changed"; theme: "light" | "dark" };

export type AnalyticsProvider = (event: AnalyticsEvent) => void;

let provider: AnalyticsProvider | null = null;

export function setAnalyticsProvider(next: AnalyticsProvider | null): void {
  provider = next;
}

export function track(event: AnalyticsEvent): void {
  if (process.env.NODE_ENV === "development") {
    console.debug("[analytics]", event.name, event);
  }
  try {
    provider?.(event);
  } catch {
    // Analytics must never break the interface.
  }
}
