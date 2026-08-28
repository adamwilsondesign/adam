/**
 * The fixed engagement tag list. Filtering, schema validation and the Studio
 * UI all derive from this single definition.
 *
 * Keep in sync with `WORK_TAGS` in src/lib/content/model.ts — the frontend
 * validates tags against that list at normalization time, so an out-of-sync
 * value would be dropped rather than crash the grid.
 */
export const WORK_TAG_VALUES = [
  "AI",
  "AR",
  "Crypto",
  "R&D",
  "Hardware",
  "Enterprise",
  "Startup",
  "Consumer",
] as const;

export const workTagList = WORK_TAG_VALUES.map((tag) => ({ title: tag, value: tag }));
