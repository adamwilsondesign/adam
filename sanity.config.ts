"use client";

/**
 * Sanity Studio configuration, mounted at /studio by
 * src/app/studio/[[...tool]]/page.tsx and used by the Sanity CLI
 * (schema extraction, TypeGen, `sanity dev`).
 */

import { visionTool } from "@sanity/vision";
import { defineConfig } from "sanity";
import { presentationTool } from "sanity/presentation";
import { structureTool } from "sanity/structure";

import { apiVersion, dataset, effectiveProjectId } from "./src/sanity/env";
import { resolve } from "./src/sanity/presentation/resolve";
import { schemaTypes } from "./src/sanity/schemaTypes";
import { structure } from "./src/sanity/structure";

export default defineConfig({
  name: "portfolio",
  title: "Adam Wilson — Portfolio",
  basePath: "/studio",
  projectId: effectiveProjectId,
  dataset,
  schema: {
    types: schemaTypes,
    // Site settings is a singleton created once (by the seed script or the
    // structure pane) — keep it out of the "new document" menus.
    templates: (templates) =>
      templates.filter((template) => template.schemaType !== "siteSettings"),
  },
  document: {
    actions: (actions, context) =>
      context.schemaType === "siteSettings"
        ? actions.filter(({ action }) => action !== "delete" && action !== "duplicate")
        : actions,
  },
  plugins: [
    structureTool({ structure }),
    presentationTool({
      resolve,
      previewUrl: {
        initial: process.env.SANITY_STUDIO_PREVIEW_URL ?? "/",
        previewMode: {
          enable: "/api/draft-mode/enable",
          disable: "/api/draft-mode/disable",
        },
      },
    }),
    ...(process.env.NODE_ENV === "development"
      ? [visionTool({ defaultApiVersion: apiVersion })]
      : []),
  ],
});
