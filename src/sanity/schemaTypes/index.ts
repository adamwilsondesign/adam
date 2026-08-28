import type { SchemaTypeDefinition } from "sanity";

import { caseStudyType } from "./caseStudy";
import { caseStudyMediaType } from "./caseStudyMedia";
import { clientType } from "./client";
import { engagementType } from "./engagement";
import { siteSettingsType } from "./siteSettings";

export const schemaTypes: SchemaTypeDefinition[] = [
  siteSettingsType,
  clientType,
  engagementType,
  caseStudyType,
  caseStudyMediaType,
];
