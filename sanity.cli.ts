import { defineCliConfig } from "sanity/cli";

import { dataset, effectiveProjectId } from "./src/sanity/env";

export default defineCliConfig({
  api: {
    projectId: effectiveProjectId,
    dataset,
  },
});
