import type { StructureResolver } from "sanity/structure";

/**
 * Studio structure for a solo portfolio owner: pinned site settings above the
 * client list, with focused slices of the (large) client collection. Future
 * sections (About, Blog, Experiments) join this list.
 */
export const structure: StructureResolver = (S) =>
  S.list()
    .title("Portfolio")
    .items([
      S.listItem()
        .title("Site settings")
        .id("siteSettings")
        .child(S.document().schemaType("siteSettings").documentId("siteSettings")),
      S.listItem()
        .title("Home page")
        .id("homePage")
        .child(S.document().schemaType("homePage").documentId("homePage")),
      S.listItem()
        .title("About page")
        .id("aboutPage")
        .child(S.document().schemaType("aboutPage").documentId("aboutPage")),
      S.divider(),
      S.listItem()
        .title("Clients")
        .id("clients")
        .child(
          S.documentTypeList("client")
            .title("Clients")
            .defaultOrdering([{ field: "name", direction: "asc" }]),
        ),
      S.listItem()
        .title("Case studies")
        .id("caseStudies")
        .child(
          S.documentTypeList("client")
            .title("Clients with a case study")
            .filter('_type == "client" && defined(caseStudy)')
            .defaultOrdering([{ field: "caseStudy.title", direction: "asc" }]),
        ),
      S.listItem()
        .title("Hidden clients")
        .id("hiddenClients")
        .child(
          S.documentTypeList("client")
            .title("Hidden from the site")
            .filter('_type == "client" && hidden == true')
            .defaultOrdering([{ field: "name", direction: "asc" }]),
        ),
    ]);
