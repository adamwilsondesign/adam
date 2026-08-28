import type { StructureResolver } from "sanity/structure";

/**
 * Studio structure for a solo portfolio owner: pinned site settings above the
 * client list. Future sections (About, Blog, Experiments) join this list.
 */
export const structure: StructureResolver = (S) =>
  S.list()
    .title("Portfolio")
    .items([
      S.listItem()
        .title("Site settings")
        .id("siteSettings")
        .child(S.document().schemaType("siteSettings").documentId("siteSettings")),
      S.divider(),
      S.documentTypeListItem("client").title("Clients"),
    ]);
