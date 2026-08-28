import {
  defineDocuments,
  defineLocations,
  type PresentationPluginOptions,
} from "sanity/presentation";

/**
 * Maps documents to frontend routes for the Presentation tool, so editors can
 * jump between Studio fields and the pages they affect.
 */
export const resolve: PresentationPluginOptions["resolve"] = {
  mainDocuments: defineDocuments([
    {
      route: "/work/:slug",
      filter: `_type == "client" && caseStudy.slug.current == $slug`,
    },
  ]),
  locations: {
    siteSettings: defineLocations({
      message: "Site settings shape every page.",
      locations: [
        { title: "Homepage", href: "/" },
        { title: "Work", href: "/work" },
      ],
    }),
    client: defineLocations({
      select: {
        name: "name",
        caseStudySlug: "caseStudy.slug.current",
        caseStudyTitle: "caseStudy.title",
      },
      resolve: (doc) => ({
        locations: [
          { title: "Work grid", href: "/work" },
          ...(doc?.caseStudySlug
            ? [
                {
                  title: `Case study: ${doc.caseStudyTitle ?? doc.name ?? doc.caseStudySlug}`,
                  href: `/work/${doc.caseStudySlug}`,
                },
              ]
            : []),
        ],
      }),
    }),
  },
};
