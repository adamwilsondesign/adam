import { createImageUrlBuilder, type SanityImageSource } from "@sanity/image-url";

import { dataset, effectiveProjectId } from "../env";

const builder = createImageUrlBuilder({ projectId: effectiveProjectId, dataset });

/** Sanity image URL builder — CDN transformations, crops and hotspots. */
export function urlFor(source: SanityImageSource) {
  return builder.image(source).auto("format");
}
