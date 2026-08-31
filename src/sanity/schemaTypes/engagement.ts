import { defineField, defineType } from "sanity";
import { WORK_TAG_VALUES, workTagList } from "./workTags";

const YEAR_MIN = 1995;
const YEAR_MAX = new Date().getFullYear() + 1;

/** Selectable years, most recent first (next year included for ongoing work). */
const yearList = Array.from({ length: YEAR_MAX - YEAR_MIN + 1 }, (_, index) => {
  const year = YEAR_MAX - index;
  return { title: String(year), value: year };
});

/**
 * A single period of work with a client. Filtering on the Work grid is
 * engagement-aware: a client is visible only when at least one engagement
 * matches both the active tags and the selected year range.
 */
export const engagementType = defineType({
  name: "engagement",
  title: "Engagement",
  type: "object",
  fieldsets: [
    {
      name: "period",
      title: "Period",
      description:
        "The years this engagement ran, inclusive on both ends. The Work grid's year slider matches clients against these.",
      options: { columns: 2 },
    },
  ],
  fields: [
    defineField({
      name: "startYear",
      title: "From",
      type: "number",
      fieldset: "period",
      options: { list: yearList },
      description: "First year of the engagement.",
      validation: (rule) => rule.required().integer().min(YEAR_MIN).max(YEAR_MAX),
    }),
    defineField({
      name: "endYear",
      title: "To",
      type: "number",
      fieldset: "period",
      options: { list: yearList },
      description: "Last year. Pick the same year as “From” for one-year work.",
      validation: (rule) => [
        rule.required().integer().min(YEAR_MIN).max(YEAR_MAX),
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
      description:
        "Tick every kind of work this engagement covered — these are the filter chips on the Work page.",
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
