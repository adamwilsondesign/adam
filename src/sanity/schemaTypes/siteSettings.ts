import { defineField, defineType } from "sanity";

/**
 * Singleton with site-wide values. The Work year-slider bounds live here so
 * they are never hard-coded across components.
 */
export const siteSettingsType = defineType({
  name: "siteSettings",
  title: "Site settings",
  type: "document",
  groups: [
    { name: "identity", title: "Identity", default: true },
    { name: "work", title: "Work" },
    { name: "seo", title: "SEO" },
  ],
  fields: [
    defineField({
      name: "title",
      title: "Site title",
      type: "string",
      group: "identity",
      description: "Your name as shown in the interface and metadata.",
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "description",
      title: "Site description",
      type: "text",
      rows: 3,
      group: "identity",
      description: "The introductory statement on the homepage.",
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "logo",
      title: "Personal logo (SVG)",
      type: "file",
      group: "identity",
      options: { accept: "image/svg+xml,.svg" },
      description:
        "Optional monochrome SVG wordmark shown in the header. Transparent background, clean paths, sensible viewBox, no fixed colours. A typographic wordmark is used when empty.",
    }),
    defineField({
      name: "contactUrl",
      title: "Contact",
      type: "string",
      group: "identity",
      description: "Either a mailto: address or an https:// URL for the Contact control.",
      validation: (rule) =>
        rule.custom((value) => {
          if (!value) return true;
          return /^(mailto:.+@.+|https:\/\/.+)/.test(value)
            ? true
            : "Use a mailto: address or an https:// URL.";
        }),
    }),
    defineField({
      name: "navigation",
      title: "Site sections",
      type: "array",
      group: "identity",
      description:
        "Sections in display order. Unavailable sections are hidden from the interface entirely (never shown as “soon”).",
      of: [
        {
          type: "object",
          fields: [
            defineField({
              name: "label",
              title: "Label",
              type: "string",
              validation: (rule) => rule.required(),
            }),
            defineField({
              name: "href",
              title: "Path",
              type: "string",
              description: "Root-relative path, e.g. /work.",
              validation: (rule) =>
                rule
                  .required()
                  .custom((value) =>
                    typeof value === "string" && value.startsWith("/")
                      ? true
                      : "Use a root-relative path starting with /.",
                  ),
            }),
            defineField({
              name: "available",
              title: "Available",
              type: "boolean",
              initialValue: false,
            }),
          ],
          preview: {
            select: { title: "label", subtitle: "href", available: "available" },
            prepare({ title, subtitle, available }) {
              return {
                title: title ?? "Section",
                subtitle: `${subtitle}${available ? "" : " · hidden"}`,
              };
            },
          },
        },
      ],
    }),
    defineField({
      name: "workStartYear",
      title: "Work range start",
      type: "number",
      group: "work",
      initialValue: 2010,
      description: "First year selectable on the Work year slider.",
      validation: (rule) => rule.required().integer().min(1990).max(2100),
    }),
    defineField({
      name: "workEndYear",
      title: "Work range end",
      type: "number",
      group: "work",
      initialValue: 2026,
      description: "Last year selectable on the Work year slider.",
      validation: (rule) => [
        rule.required().integer().min(1990).max(2100),
        rule.custom((end, context) => {
          const start = (context.document as { workStartYear?: number } | undefined)?.workStartYear;
          if (typeof end === "number" && typeof start === "number" && end < start) {
            return "The end of the range cannot precede its start.";
          }
          return true;
        }),
      ],
    }),
    defineField({
      name: "seoTitle",
      title: "Default SEO title",
      type: "string",
      group: "seo",
      description: "Used for the homepage and as the title template fallback.",
    }),
    defineField({
      name: "seoDescription",
      title: "Default SEO description",
      type: "text",
      rows: 2,
      group: "seo",
    }),
    defineField({
      name: "defaultOgImage",
      title: "Default Open Graph image",
      type: "image",
      group: "seo",
      description: "Social-preview image used when a page has no image of its own.",
    }),
  ],
  preview: {
    select: { title: "title" },
    prepare({ title }) {
      return { title: title ?? "Site settings", subtitle: "Singleton" };
    },
  },
});
