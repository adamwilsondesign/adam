/**
 * Canonical site origin for absolute URLs in metadata, the sitemap and
 * structured data. Configure NEXT_PUBLIC_SITE_URL in production; Vercel
 * deployments fall back to the deployment URL.
 */
export function siteUrl(): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  if (configured) return configured.replace(/\/$/, "");
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}
