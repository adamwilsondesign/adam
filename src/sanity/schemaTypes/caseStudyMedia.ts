import { defineField, defineType } from "sanity";

/**
 * A single gallery item. Every item declares the ratio it is designed for so
 * the gallery can lay out mixed square and 16:9 media at a consistent height
 * without cropping.
 */
export const caseStudyMediaType = defineType({
  name: "caseStudyMedia",
  title: "Case-study media",
  type: "object",
  fields: [
    defineField({
      name: "image",
      title: "Image",
      type: "image",
      options: { hotspot: true },
      description: "Photography or interface imagery. Uploaded through the Sanity image pipeline.",
      validation: (rule) => rule.required().error("Gallery items need an image."),
    }),
    defineField({
      name: "alt",
      title: "Alternative text",
      type: "string",
      description: "Describes the image for screen readers and when the image cannot load.",
      validation: (rule) => rule.required().error("Alt text is required on every image."),
    }),
    defineField({
      name: "caption",
      title: "Caption",
      type: "string",
      description: "Optional caption shown with the image.",
    }),
    defineField({
      name: "aspect",
      title: "Intended aspect ratio",
      type: "string",
      options: {
        list: [
          { title: "Square (1:1)", value: "square" },
          { title: "Widescreen (16:9)", value: "16:9" },
        ],
        layout: "radio",
        direction: "horizontal",
      },
      description: "The frame this image is designed for. The gallery never crops media.",
      validation: (rule) => rule.required().error("Choose square or 16:9."),
    }),
  ],
  preview: {
    select: { media: "image", title: "alt", aspect: "aspect" },
    prepare({ media, title, aspect }) {
      return { media, title: title ?? "Untitled image", subtitle: aspect };
    },
  },
});
