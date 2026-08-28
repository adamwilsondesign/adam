import { isSanityConfigured } from "@/sanity/env";

import { Studio } from "./Studio";

/**
 * Embedded Sanity Studio. Excluded from indexing (see the studio metadata
 * re-export and robots.ts) and from portfolio navigation. Without Sanity
 * credentials the route explains how to connect a project instead.
 */
export { metadata, viewport } from "next-sanity/studio";

export default function StudioPage() {
  if (!isSanityConfigured) {
    return (
      <main
        style={{
          position: "fixed",
          inset: 0,
          display: "grid",
          placeItems: "center",
          padding: 24,
        }}
      >
        <div style={{ maxWidth: 480, lineHeight: 1.6, fontSize: 14 }}>
          <h1 style={{ fontSize: 18, marginBottom: 12 }}>Sanity Studio is not configured</h1>
          <p style={{ color: "var(--color-fg-muted)", margin: 0 }}>
            Set <code>NEXT_PUBLIC_SANITY_PROJECT_ID</code> (and optionally{" "}
            <code>NEXT_PUBLIC_SANITY_DATASET</code>) in <code>.env.local</code>, restart the dev
            server, and this route will mount the Studio. The site currently runs on local fixture
            content — see the README’s “Sanity setup” section for the full workflow.
          </p>
        </div>
      </main>
    );
  }
  return <Studio />;
}
