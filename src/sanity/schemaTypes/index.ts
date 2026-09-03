import type { SchemaTypeDefinition } from "sanity";

import { aboutPageType } from "./aboutPage";
import { caseStudyType } from "./caseStudy";
import { caseStudyMediaType } from "./caseStudyMedia";
import { clientType } from "./client";
import { engagementType } from "./engagement";
import { homePageType } from "./homePage";
import { siteSettingsType } from "./siteSettings";

export const schemaTypes: SchemaTypeDefinition[] = [
  siteSettingsType,
  homePageType,
  aboutPageType,
  clientType,
  engagementType,
  caseStudyType,
  caseStudyMediaType,
];
