import { defineArrayMember, defineField, defineType } from "sanity";

/**
 * The About page's editable content. A singleton (one document, id
 * "aboutPage"). Everything textual on the page lives here; the environment
 * (clouds, mountains, motion) stays in code by design.
 */
export const aboutPageType = defineType({
  name: "aboutPage",
  title: "About page",
  type: "document",
  groups: [
    { name: "opening", title: "Opening", default: true },
    { name: "sections", title: "Sections" },
    { name: "collections", title: "Movies & books" },
    { name: "seo", title: "Metadata" },
  ],
  fields: [
    defineField({
      name: "intro",
      title: "Introduction",
      type: "text",
      rows: 3,
      group: "opening",
      description: "First-person opening statement shown in the valley viewport.",
      validation: (rule) => rule.required().max(400),
    }),
    defineField({
      name: "facts",
      title: "Facts row",
      type: "array",
      group: "opening",
      description: "Compact label/value pairs (location, current role, years of experience).",
      of: [
        defineArrayMember({
          type: "object",
          name: "fact",
          fields: [
            defineField({
              name: "label",
              title: "Label",
              type: "string",
              validation: (r) => r.required(),
            }),
            defineField({
              name: "value",
              title: "Value",
              type: "string",
              validation: (r) => r.required(),
            }),
          ],
          preview: { select: { title: "value", subtitle: "label" } },
        }),
      ],
      validation: (rule) => rule.max(4),
    }),
    defineField({
      name: "careerStatement",
      title: "Career / approach statement",
      type: "text",
      rows: 4,
      group: "sections",
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "experienceLabel",
      title: "Experience section label",
      type: "string",
      group: "sections",
      initialValue: "Experience",
    }),
    defineField({
      name: "experience",
      title: "Work experience",
      type: "array",
      group: "sections",
      description:
        "Timeline entries, oldest first. Drag to reorder — the order here is the order on the page.",
      of: [
        defineArrayMember({
          type: "object",
          name: "experienceEntry",
          fields: [
            defineField({
              name: "year",
              title: "Year",
              type: "string",
              description: "Start year of the role, e.g. “2015”.",
              validation: (r) => r.required(),
            }),
            defineField({
              name: "title",
              title: "Title",
              type: "string",
              validation: (r) => r.required(),
            }),
            defineField({
              name: "employer",
              title: "Employer",
              type: "string",
              validation: (r) => r.required(),
            }),
          ],
          preview: { select: { title: "title", subtitle: "year" } },
        }),
      ],
    }),
    defineField({
      name: "principlesLabel",
      title: "Principles section label",
      type: "string",
      group: "sections",
      initialValue: "What I care about",
    }),
    defineField({
      name: "principles",
      title: "Principles",
      type: "array",
      group: "sections",
      of: [
        defineArrayMember({
          type: "object",
          name: "principle",
          fields: [
            defineField({
              name: "title",
              title: "Title",
              type: "string",
              validation: (r) => r.required(),
            }),
            defineField({
              name: "body",
              title: "Line",
              type: "text",
              rows: 2,
              validation: (r) => r.required(),
            }),
          ],
          preview: { select: { title: "title" } },
        }),
      ],
      validation: (rule) => rule.max(4),
    }),
    defineField({
      name: "moviesLabel",
      title: "Movies section label",
      type: "string",
      group: "collections",
      initialValue: "Favourite movies",
    }),
    defineField({
      name: "movies",
      title: "Favourite movies",
      type: "array",
      group: "collections",
      description: "Cover artwork carries the title — design the title into the image.",
      of: [
        defineArrayMember({
          type: "object",
          name: "movieItem",
          fields: [
            defineField({
              name: "title",
              title: "Title",
              type: "string",
              validation: (r) => r.required(),
            }),
            defineField({ name: "year", title: "Year", type: "number" }),
            defineField({ name: "cover", title: "Cover artwork", type: "image" }),
            defineField({
              name: "alt",
              title: "Alternative text",
              type: "string",
              validation: (r) => r.required(),
            }),
          ],
          preview: { select: { title: "title", media: "cover" } },
        }),
      ],
    }),
    defineField({
      name: "booksLabel",
      title: "Books section label",
      type: "string",
      group: "collections",
      initialValue: "Favourite books",
    }),
    defineField({
      name: "books",
      title: "Favourite books",
      type: "array",
      group: "collections",
      of: [
        defineArrayMember({
          type: "object",
          name: "bookItem",
          fields: [
            defineField({
              name: "title",
              title: "Title",
              type: "string",
              validation: (r) => r.required(),
            }),
            defineField({ name: "author", title: "Author", type: "string" }),
            defineField({ name: "cover", title: "Cover artwork", type: "image" }),
            defineField({
              name: "alt",
              title: "Alternative text",
              type: "string",
              validation: (r) => r.required(),
            }),
          ],
          preview: { select: { title: "title", subtitle: "author", media: "cover" } },
        }),
      ],
    }),
    defineField({
      name: "contactHeading",
      title: "Contact heading",
      type: "string",
      group: "sections",
    }),
    defineField({
      name: "contactBody",
      title: "Contact invitation",
      type: "text",
      rows: 3,
      group: "sections",
    }),
    defineField({
      name: "contactCtaLabel",
      title: "Contact button label",
      type: "string",
      group: "sections",
      initialValue: "Get in touch",
    }),
    defineField({
      name: "seoTitle",
      title: "SEO title",
      type: "string",
      group: "seo",
      initialValue: "About",
    }),
    defineField({
      name: "seoDescription",
      title: "SEO description",
      type: "text",
      rows: 2,
      group: "seo",
    }),
  ],
  preview: {
    prepare: () => ({ title: "About page" }),
  },
});
