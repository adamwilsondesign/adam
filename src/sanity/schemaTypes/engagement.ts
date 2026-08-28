import { defineField, defineType } from "sanity";
import { WORK_TAG_VALUES, workTagList } from "./workTags";

const YEAR_MIN = 1990;
const YEAR_MAX = 2100;

/**
 * A single period of work with a client. Filtering on the Work grid is
 * engagement-aware: a client is visible only when at least one engagement
 * matches both the active tags and the selected year range.
 */
export const engagementType = defineType({
  name: "engagement",
  title: "Engagement",
  type: "object",
  fields: [
    defineField({
      name: "startYear",
      title: "Start year",
      type: "number",
      description: "First year of this engagement (inclusive).",
      validation: (rule) =>
        rule.required().integer().min(YEAR_MIN).max(YEAR_MAX).error("Enter a four-digit year."),
    }),
    defineField({
      name: "endYear",
      title: "End year",
      type: "number",
      description:
        "Last year of this engagement (inclusive). Same as start year for one-year work.",
      validation: (rule) => [
        rule.required().integer().min(YEAR_MIN).max(YEAR_MAX).error("Enter a four-digit year."),
        rule.custom((endYear, context) => {
          const startYear = (context.parent as { startYear?: number } | undefined)?.startYear;
          if (typeof endYear === "number" && typeof startYear === "number" && endYear < startYear) {
            return "End year cannot precede the start year.";
          }
          return true;
        }),
      ],
    }),
    defineField({
      name: "tags",
      title: "Tags",
      type: "array",
      of: [{ type: "string" }],
      options: { list: workTagList, layout: "grid" },
      description: "What kind of work this engagement was. Drives the Work filter.",
      validation: (rule) => [
        rule.required().min(1).error("Every engagement needs at least one tag."),
        rule.custom((tags) => {
          const invalid = (tags ?? []).filter(
            (tag) => !(WORK_TAG_VALUES as readonly string[]).includes(String(tag)),
          );
          return invalid.length === 0 || `Unknown tag: ${invalid.join(", ")}`;
        }),
      ],
    }),
    defineField({
      name: "label",
      title: "Internal label",
      type: "string",
      description: "Optional note for your own reference (not shown on the site).",
    }),
    defineField({
      name: "description",
      title: "Engagement description",
      type: "string",
      description: "Optional sentence about this specific engagement.",
    }),
  ],
  preview: {
    select: { startYear: "startYear", endYear: "endYear", tags: "tags", label: "label" },
    prepare({ startYear, endYear, tags, label }) {
      const years = startYear === endYear ? `${startYear}` : `${startYear}–${endYear}`;
      return {
        title: label ? `${years} · ${label}` : years,
        subtitle: (tags ?? []).join(", "),
      };
    },
  },
});
