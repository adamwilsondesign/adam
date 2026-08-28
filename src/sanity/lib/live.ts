import { defineLive } from "next-sanity/live";

import "@/lib/proxy-fetch";

import { readToken } from "../env";
import { client } from "./client";

/**
 * Live Content API wiring. `sanityFetch` caches with sync tags so published
 * edits reach visitors without a redeploy; `<SanityLive />` (rendered in the
 * root layout when Sanity is configured) keeps those tags fresh.
 *
 * The token stays on the server for published traffic; it is only shared with
 * the browser during an authenticated draft-mode session so editors can
 * live-preview drafts.
 */
const token = readToken();

export const { sanityFetch, SanityLive } = defineLive({
  client,
  serverToken: token,
  browserToken: token,
});
