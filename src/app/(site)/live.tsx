import { draftMode } from "next/headers";
import { VisualEditing } from "next-sanity/visual-editing";

import { SanityLive } from "@/sanity/lib/live";

import { DisableDraftMode } from "./DisableDraftMode";

/**
 * Live Content + Visual Editing, rendered only when Sanity is configured.
 * `<SanityLive />` keeps published content fresh for every visitor; the
 * Visual Editing overlays load exclusively inside draft-mode sessions.
 */
export async function LiveVisualEditing() {
  const { isEnabled } = await draftMode();
  return (
    <>
      <SanityLive />
      {isEnabled ? (
        <>
          <VisualEditing />
          <DisableDraftMode />
        </>
      ) : null}
    </>
  );
}
