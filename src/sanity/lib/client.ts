import { createClient } from "next-sanity";

import { apiVersion, dataset, effectiveProjectId } from "../env";

/**
 * Shared Sanity client. Content is served from the CDN with the published
 * perspective; `defineLive` and the draft-mode route layer drafts on top.
 */
export const client = createClient({
  projectId: effectiveProjectId,
  dataset,
  apiVersion,
  useCdn: true,
  perspective: "published",
  stega: { studioUrl: "/studio" },
});
