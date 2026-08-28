import { defineArrayMember, defineField, defineType } from "sanity";

/**
 * A client relationship. Appears exactly once in the Work grid; its
 * engagements drive filtering, and it optionally carries one case study.
 */
export const clientType = defineType({
  name: "client",
  title: "Client",
  type: "document",
  groups: [
    { name: "identity", title: "Identity", default: true },
    { name: "work", title: "Work" },
    { name: "caseStudy", title: "Case study" },
  ],
  fields: [
    defineField({
      name: "name",
      title: "Client name",
      type: "string",
      group: "identity",
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "slug",
      title: "Slug",
      type: "slug",
      group: "identity",
      options: { source: "name" },
      description: "Stable identifier for the client (used internally, not as a public URL).",
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "logo",
      title: "Logo (SVG)",
      type: "file",
      group: "identity",
      options: { accept: "image/svg+xml,.svg" },
      description:
        "Monochrome SVG only. Requirements: transparent background; clean vector paths (no embedded raster images); a sensible viewBox; no unnecessary fixed colours — the site recolours and masks the artwork, so shapes should be solid fills or strokes.",
      validation: (rule) =>
        rule.required().custom((file) => {
          const asset = (file as { asset?: { _ref?: string } } | undefined)?.asset;
          if (!asset?._ref) return true; // required() reports the missing file
          return asset._ref.endsWith("-svg") || "The logo must be an SVG file.";
        }),
    }),
    defineField({
      name: "logoAspect",
      title: "Logo aspect ratio (width ÷ height)",
      type: "number",
      group: "identity",
      description:
        "Intrinsic width ÷ height of the SVG viewBox (e.g. 4.5 for a wide wordmark, 1 for a square symbol). Drives automatic optical sizing in the grid. Defaults to 1 when empty.",
      validation: (rule) => rule.min(0.2).max(12),
    }),
    defineField({
      name: "logoTreatment",
      title: "Optical overrides",
      type: "object",
      group: "identity",
      description:
        "Exceptional per-client adjustments to the automatic optical sizing. Leave empty for almost every client.",
      options: { collapsible: true, collapsed: true },
      fields: [
        defineField({
          name: "scale",
          title: "Scale multiplier",
          type: "number",
          description: "Multiplies the automatic size (0.5–1.5; 1 = automatic).",
          validation: (rule) => rule.min(0.5).max(1.5),
        }),
        defineField({
          name: "padding",
          title: "Extra padding",
          type: "number",
          description: "Extra breathing room inside the cell, 0–0.2 (fraction of the cell).",
          validation: (rule) => rule.min(0).max(0.2),
        }),
        defineField({
          name: "alignment",
          title: "Horizontal alignment",
          type: "string",
          options: { list: ["center", "start", "end"], layout: "radio" },
        }),
        defineField({
          name: "logoLight",
          title: "Light-theme logo (SVG)",
          type: "file",
          options: { accept: "image/svg+xml,.svg" },
          description:
            "Only for logos that cannot be recoloured as a mask; the main logo already adapts to both themes.",
        }),
        defineField({
          name: "logoDark",
          title: "Dark-theme logo (SVG)",
          type: "file",
          options: { accept: "image/svg+xml,.svg" },
        }),
        defineField({
          name: "compactLogo",
          title: "Compact mark (SVG)",
          type: "file",
          options: { accept: "image/svg+xml,.svg" },
          description: "Denser alternate mark used when cells become very small (mobile pinch).",
        }),
      ],
    }),
    defineField({
      name: "description",
      title: "Informational description",
      type: "string",
      group: "identity",
      description: "One sentence shown in the tooltip / info card for this client.",
      validation: (rule) => [rule.required(), rule.max(200).warning("Keep it to one sentence.")],
    }),
    defineField({
      name: "hidden",
      title: "Hide from the site",
      type: "boolean",
      group: "identity",
      initialValue: false,
      description: "Temporarily remove this client from the Work grid without deleting it.",
    }),
    defineField({
      name: "engagements",
      title: "Engagements",
      type: "array",
      group: "work",
      of: [defineArrayMember({ type: "engagement" })],
      description:
        "Each period of work with its own years and tags. Filtering matches tag and year range against the same engagement.",
      validation: (rule) => rule.required().min(1).error("Add at least one engagement."),
    }),
    defineField({
      name: "caseStudy",
      title: "Case study",
      type: "caseStudy",
      group: "caseStudy",
      description: "Optional. A client has at most one definitive case study.",
    }),
  ],
  orderings: [
    {
      title: "Client name",
      name: "nameAsc",
      by: [{ field: "name", direction: "asc" }],
    },
  ],
  preview: {
    select: {
      title: "name",
      hidden: "hidden",
      caseStudyTitle: "caseStudy.title",
      engagements: "engagements",
    },
    prepare({ title, hidden, caseStudyTitle, engagements }) {
      const spans = ((engagements ?? []) as { startYear?: number; endYear?: number }[])
        .map((e) => (e.startYear === e.endYear ? `${e.startYear}` : `${e.startYear}–${e.endYear}`))
        .join(", ");
      const parts = [
        spans,
        caseStudyTitle ? `Case study: ${caseStudyTitle}` : null,
        hidden ? "Hidden" : null,
      ];
      return {
        title: title ?? "Untitled client",
        subtitle: parts.filter(Boolean).join(" · "),
      };
    },
  },
});
