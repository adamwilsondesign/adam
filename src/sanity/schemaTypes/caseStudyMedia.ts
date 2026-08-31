import { defineField, defineType } from "sanity";

/**
 * A single gallery item: an image or a video. Every item declares the ratio
 * it is designed for so the gallery can lay out mixed square and 16:9 media
 * at a consistent height without cropping. Videos come from an upload or an
 * external file URL.
 */
export const caseStudyMediaType = defineType({
  name: "caseStudyMedia",
  title: "Case-study media",
  type: "object",
  fields: [
    defineField({
      name: "mediaType",
      title: "Media type",
      type: "string",
      initialValue: "image",
      options: {
        list: [
          { title: "Image", value: "image" },
          { title: "Video", value: "video" },
        ],
        layout: "radio",
        direction: "horizontal",
      },
    }),
    defineField({
      name: "image",
      title: "Image",
      type: "image",
      options: { hotspot: true },
      description: "Photography or interface imagery. Uploaded through the Sanity image pipeline.",
      hidden: ({ parent }) => parent?.mediaType === "video",
      validation: (rule) =>
        rule.custom((value, context) => {
          const parent = context.parent as { mediaType?: string } | undefined;
          if ((parent?.mediaType ?? "image") !== "image") return true;
          return value?.asset ? true : "Image items need an uploaded image.";
        }),
    }),
    defineField({
      name: "video",
      title: "Video file",
      type: "file",
      options: { accept: "video/*" },
      description: "Upload the video (MP4/WebM), or provide a video URL below instead.",
      hidden: ({ parent }) => parent?.mediaType !== "video",
      validation: (rule) =>
        rule.custom((value, context) => {
          const parent = context.parent as { mediaType?: string; videoUrl?: string } | undefined;
          if (parent?.mediaType !== "video") return true;
          if (value?.asset || parent?.videoUrl) return true;
          return "Video items need an uploaded file or a video URL.";
        }),
    }),
    defineField({
      name: "videoUrl",
      title: "Video URL",
      type: "url",
      description:
        "Direct link to a hosted video file (e.g. an .mp4). Used when no file is uploaded.",
      hidden: ({ parent }) => parent?.mediaType !== "video",
      validation: (rule) => rule.uri({ scheme: ["https", "http"] }),
    }),
    defineField({
      name: "poster",
      title: "Poster image",
      type: "image",
      description: "Optional still shown before the video plays.",
      hidden: ({ parent }) => parent?.mediaType !== "video",
    }),
    defineField({
      name: "alt",
      title: "Alternative text",
      type: "string",
      description: "Describes the image or video for screen readers and when it cannot load.",
      validation: (rule) => rule.required().error("Alt text is required on every media item."),
    }),
    defineField({
      name: "caption",
      title: "Caption",
      type: "string",
      description: "Optional caption shown with the media.",
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
      description: "The frame this media is designed for. The gallery never crops media.",
      validation: (rule) => rule.required().error("Choose square or 16:9."),
    }),
  ],
  preview: {
    select: { media: "image", poster: "poster", title: "alt", aspect: "aspect", type: "mediaType" },
    prepare({ media, poster, title, aspect, type }) {
      const isVideo = type === "video";
      return {
        media: isVideo ? (poster ?? undefined) : media,
        title: title ?? (isVideo ? "Untitled video" : "Untitled image"),
        subtitle: isVideo ? `video · ${aspect}` : aspect,
      };
    },
  },
});
