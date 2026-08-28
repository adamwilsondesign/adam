import { defineArrayMember, defineField, defineType } from "sanity";

/**
 * The single, definitive case study a client can carry. Lives inline on the
 * client document — a client has either zero or one case study, never a
 * chooser between several.
 */
export const caseStudyType = defineType({
  name: "caseStudy",
  title: "Case study",
  type: "object",
  groups: [
    { name: "content", title: "Content", default: true },
    { name: "media", title: "Media" },
    { name: "seo", title: "SEO" },
  ],
  fields: [
    defineField({
      name: "slug",
      title: "Slug",
      type: "slug",
      group: "content",
      description: "Becomes the public URL: /work/<slug>. Keep it short and stable.",
      options: {
        source: (doc) => (doc as { name?: string }).name ?? "",
        isUnique: async (slug, context) => {
          const { document, getClient } = context;
          const client = getClient({ apiVersion: "2025-08-01" });
          const id = document?._id.replace(/^drafts\./, "") ?? "";
          const params = { draft: `drafts.${id}`, published: id, slug };
          const count = await client.fetch<number>(
            `count(*[_type == "client" && caseStudy.slug.current == $slug && !(_id in [$draft, $published])])`,
            params,
          );
          return count === 0;
        },
      },
      validation: (rule) => rule.required().error("A case study needs a slug for its URL."),
    }),
    defineField({
      name: "title",
      title: "Project title",
      type: "string",
      group: "content",
      validation: (rule) => rule.required().error("Give the project a title."),
    }),
    defineField({
      name: "subtitle",
      title: "Subtitle",
      type: "string",
      group: "content",
      description: "One short line under the title.",
    }),
    defineField({
      name: "displayDate",
      title: "Display date override",
      type: "string",
      group: "content",
      description:
        "Optional. Shown instead of the date range derived from engagements, e.g. “Winter 2021”.",
    }),
    defineField({
      name: "shortDescription",
      title: "Short description",
      type: "text",
      rows: 2,
      group: "content",
      description: "One or two sentences. Used in previews and as the SEO description fallback.",
      validation: (rule) => rule.required().max(300),
    }),
    defineField({
      name: "body",
      title: "Description",
      type: "array",
      group: "content",
      description: "The main written case study. Keep it restrained — a few paragraphs.",
      of: [
        defineArrayMember({
          type: "block",
          styles: [{ title: "Normal", value: "normal" }],
          lists: [],
          marks: {
            decorators: [
              { title: "Strong", value: "strong" },
              { title: "Emphasis", value: "em" },
            ],
            annotations: [
              defineField({
                name: "link",
                title: "Link",
                type: "object",
                fields: [
                  defineField({
                    name: "href",
                    title: "URL",
                    type: "url",
                    validation: (rule) =>
                      rule.uri({ scheme: ["http", "https", "mailto"] }).required(),
                  }),
                ],
              }),
            ],
          },
        }),
      ],
    }),
    defineField({
      name: "externalUrl",
      title: "External project URL",
      type: "url",
      group: "content",
      description: "Optional link to the live project.",
      validation: (rule) => rule.uri({ scheme: ["http", "https"] }),
    }),
    defineField({
      name: "heroImage",
      title: "Hero image",
      type: "image",
      group: "media",
      options: { hotspot: true },
      description:
        "Fills the logo mask on hover and opens the case study. Use a wide (16:9) image.",
      fields: [
        defineField({
          name: "alt",
          title: "Alternative text",
          type: "string",
          validation: (rule) => rule.required().error("Alt text is required on the hero image."),
        }),
      ],
      validation: (rule) => rule.required().error("Case studies need a hero image."),
    }),
    defineField({
      name: "gallery",
      title: "Gallery",
      type: "array",
      group: "media",
      of: [defineArrayMember({ type: "caseStudyMedia" })],
      description: "Mixed square and 16:9 media, shown at a consistent height without cropping.",
      validation: (rule) => rule.required().min(1).error("Add at least one gallery item."),
    }),
    defineField({
      name: "seoTitle",
      title: "SEO title",
      type: "string",
      group: "seo",
      description: "Optional. Defaults to “<Project title> — <Client name>”.",
    }),
    defineField({
      name: "seoDescription",
      title: "SEO description",
      type: "text",
      rows: 2,
      group: "seo",
      description: "Optional. Defaults to the short description.",
    }),
    defineField({
      name: "ogImage",
      title: "Open Graph image",
      type: "image",
      group: "seo",
      description: "Optional social-preview image. Defaults to the hero image.",
    }),
  ],
  preview: {
    select: { title: "title", subtitle: "subtitle", media: "heroImage" },
  },
});
