import { defineField, defineType } from "sanity";

/**
 * The homepage's editable copy. A singleton (one document, id "homePage").
 * Site-wide details (name, contact, navigation, footer) live in Site
 * settings; this document is only what the homepage itself says.
 */
export const homePageType = defineType({
  name: "homePage",
  title: "Home page",
  type: "document",
  fields: [
    defineField({
      name: "intro",
      title: "Introduction",
      type: "text",
      rows: 3,
      description: "The homepage headline — the large serif statement.",
      validation: (rule) => rule.required().max(300),
    }),
    defineField({
      name: "seoTitle",
      title: "SEO title override",
      type: "string",
      description: "Optional. Defaults to the site metadata title.",
    }),
    defineField({
      name: "seoDescription",
      title: "SEO description override",
      type: "text",
      rows: 2,
      description: "Optional. Defaults to the site metadata description.",
    }),
  ],
  preview: {
    prepare: () => ({ title: "Home page" }),
  },
});
