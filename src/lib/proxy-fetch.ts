import "server-only";

import { EnvHttpProxyAgent, setGlobalDispatcher } from "undici";

/**
 * Node's built-in fetch (undici) ignores HTTP(S)_PROXY environment variables,
 * so in proxied environments (corporate networks, sandboxed CI) server-side
 * fetches bypass the proxy and get blocked at the network edge. When an env
 * proxy is configured, install undici's env-aware dispatcher so global fetch
 * honours it. Everywhere else this module is a no-op.
 *
 * Imported for its side effect from the Sanity server modules (build-time
 * prerender workers execute those directly) and from instrumentation.ts
 * (running server).
 */
if (process.env.HTTPS_PROXY || process.env.https_proxy) {
  setGlobalDispatcher(new EnvHttpProxyAgent());
}
