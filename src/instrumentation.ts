/**
 * Server bootstrap (Next.js instrumentation convention).
 *
 * Node's built-in fetch (undici) ignores HTTP(S)_PROXY environment variables,
 * so in proxied environments (corporate networks, sandboxed CI) every
 * `sanityFetch` would bypass the proxy and be blocked at the network edge.
 * When an env proxy is configured, install undici's env-aware dispatcher so
 * global fetch honours it. Everywhere else this is a no-op.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("@/lib/proxy-fetch");
  }
}
