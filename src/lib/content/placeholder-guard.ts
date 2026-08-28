/**
 * Placeholder-content guards.
 *
 * The fixture data intentionally carries example.com project URLs and no
 * real contact address so nothing invented can be mistaken for real content.
 * These helpers make that guarantee structural: every URL passes through a
 * sanitizer at the content facade, so a placeholder value can never render
 * as a live CTA or contact link in any build — the control is omitted
 * instead. Validation (validate.ts) additionally reports these values as
 * errors when production content validation is enabled.
 */

const PLACEHOLDER_HOSTS = new Set([
  "example.com",
  "www.example.com",
  "example.org",
  "www.example.org",
  "example.net",
  "www.example.net",
]);

const PLACEHOLDER_EMAIL_PATTERN = /@(example\.(com|org|net)|test\.[a-z]+)$/i;

export function isPlaceholderExternalUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    return PLACEHOLDER_HOSTS.has(new URL(url).hostname.toLowerCase());
  } catch {
    return false;
  }
}

export function isPlaceholderContactUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  if (url.toLowerCase().startsWith("mailto:")) {
    const address = url.slice("mailto:".length).split("?")[0] ?? "";
    return PLACEHOLDER_EMAIL_PATTERN.test(address.trim());
  }
  return isPlaceholderExternalUrl(url);
}

/** Returns the URL, or null when it is a placeholder that must not render. */
export function sanitizeExternalUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  return isPlaceholderExternalUrl(url) ? null : url;
}

/** Returns the contact URL, or null when it is a placeholder. */
export function sanitizeContactUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  return isPlaceholderContactUrl(url) ? null : url;
}
