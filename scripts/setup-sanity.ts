/**
 * One-command Sanity bootstrap: creates the project, dataset, API tokens and
 * CORS entries, writes `.env.local`, then seeds the placeholder content.
 *
 *   npx sanity login          (once — or set SANITY_AUTH_TOKEN)
 *   npm run sanity:setup
 *
 * Flags:
 *   --name <displayName>   project display name (default "Adam Wilson — Portfolio")
 *   --project <id>         reuse an existing project id (also inferred from a
 *                          project robot token when it sees exactly one project)
 *   --dataset <name>       dataset name          (default "production")
 *   --org <organizationId> Sanity organization to create the project under
 *                          (only needed when your account belongs to several)
 *   --site-url <url>       extra CORS origin for the deployed site
 *                          (also read from NEXT_PUBLIC_SITE_URL)
 *   --skip-seed            do everything except running `npm run sanity:seed`
 *
 * The script is idempotent: with NEXT_PUBLIC_SANITY_PROJECT_ID already
 * configured it reuses that project instead of creating a new one, dataset
 * creation tolerates an existing dataset, existing tokens in `.env.local`
 * are kept, and duplicate CORS origins are ignored.
 *
 * Auth: a Sanity *user* token is required — either SANITY_AUTH_TOKEN in the
 * environment/.env.local, or the token stored by `npx sanity login`
 * (~/.config/sanity/config.json). This token is only used to talk to the
 * Management API here; it is never written to `.env.local`.
 */

import { spawnSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const API = "https://api.sanity.io/v2021-06-07";

/**
 * Node's global fetch (undici) ignores HTTP(S)_PROXY environment variables,
 * so in proxied environments (corporate networks, sandboxed CI) it bypasses
 * the proxy other tools use and gets blocked. Route it through the env proxy
 * when one is configured.
 */
async function installProxyDispatcher(): Promise<void> {
  if (!process.env.HTTPS_PROXY && !process.env.https_proxy) return;
  try {
    const { EnvHttpProxyAgent, setGlobalDispatcher } = await import("undici");
    setGlobalDispatcher(new EnvHttpProxyAgent());
  } catch {
    // undici unavailable — fetch stays direct
  }
}

function flag(name: string): string | null {
  const index = process.argv.indexOf(`--${name}`);
  if (index === -1) return null;
  const value = process.argv[index + 1];
  if (!value || value.startsWith("--")) {
    console.error(`--${name} needs a value.`);
    process.exit(1);
  }
  return value;
}

async function loadDotEnvLocal(): Promise<void> {
  for (const file of [".env.local", ".env"]) {
    try {
      const raw = await readFile(path.join(root, file), "utf8");
      for (const line of raw.split("\n")) {
        const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
        if (match && match[1] && process.env[match[1]] === undefined) {
          process.env[match[1]] = match[2]?.replace(/^["']|["']$/g, "") ?? "";
        }
      }
    } catch {
      // optional files
    }
  }
}

async function resolveAuthToken(): Promise<string> {
  if (process.env.SANITY_AUTH_TOKEN) return process.env.SANITY_AUTH_TOKEN;
  try {
    const config = JSON.parse(
      await readFile(path.join(os.homedir(), ".config/sanity/config.json"), "utf8"),
    ) as { authToken?: string };
    if (config.authToken) return config.authToken;
  } catch {
    // no CLI login on this machine
  }
  console.error(
    "No Sanity auth token found. Either run `npx sanity login` first, or create a\n" +
      "personal token at https://www.sanity.io/manage (API → Tokens) and export it\n" +
      "as SANITY_AUTH_TOKEN before re-running `npm run sanity:setup`.",
  );
  process.exit(1);
}

async function api<T>(
  token: string,
  method: "GET" | "POST" | "PUT",
  route: string,
  body?: Record<string, unknown>,
): Promise<T> {
  const response = await fetch(`${API}${route}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!response.ok) {
    let detail = `${response.status} ${response.statusText}`;
    try {
      const payload = (await response.json()) as { message?: string; error?: string };
      detail = payload.message ?? payload.error ?? detail;
    } catch {
      // non-JSON error body
    }
    throw new Error(`Sanity API ${method} ${route} failed: ${detail}`);
  }
  return (await response.json()) as T;
}

/** Update-or-append the given keys in .env.local, preserving everything else. */
async function writeEnvLocal(values: Record<string, string>): Promise<void> {
  const file = path.join(root, ".env.local");
  let lines: string[] = [];
  try {
    lines = (await readFile(file, "utf8")).split("\n");
  } catch {
    // fresh file
  }
  const pending = new Map(Object.entries(values));
  const next = lines.map((line) => {
    const match = /^\s*([A-Z0-9_]+)\s*=/.exec(line);
    const key = match?.[1];
    if (key && pending.has(key)) {
      const value = pending.get(key)!;
      pending.delete(key);
      return `${key}=${value}`;
    }
    return line;
  });
  while (next.length > 0 && next[next.length - 1] === "") next.pop();
  for (const [key, value] of pending) next.push(`${key}=${value}`);
  await writeFile(file, `${next.join("\n")}\n`, "utf8");
}

async function main(): Promise<void> {
  await loadDotEnvLocal();
  await installProxyDispatcher();
  const token = await resolveAuthToken();

  const displayName = flag("name") ?? "Adam Wilson — Portfolio";
  const dataset = flag("dataset") ?? process.env.NEXT_PUBLIC_SANITY_DATASET ?? "production";
  const siteUrl = flag("site-url") ?? process.env.NEXT_PUBLIC_SITE_URL ?? null;

  // 1. Project — configured > --project > the token's own project > create.
  let projectId = flag("project") ?? process.env.NEXT_PUBLIC_SANITY_PROJECT_ID ?? null;
  if (projectId && /^[a-z0-9-]+$/.test(projectId)) {
    console.log(`Reusing configured Sanity project ${projectId}.`);
  } else {
    // A project robot token can't create projects or list organizations, but
    // it can list the project(s) it belongs to — reuse that project.
    const visible = await api<{ id: string; displayName: string }[]>(token, "GET", "/projects");
    if (visible.length === 1) {
      projectId = visible[0]!.id;
      console.log(`Using the token's project ${projectId} (“${visible[0]!.displayName}”).`);
    } else if (visible.length > 1) {
      console.error("This token can see several projects — pick one with --project <id>:");
      for (const project of visible) console.error(`  ${project.id}  ${project.displayName}`);
      process.exit(1);
    } else {
      let organizationId = flag("org");
      if (!organizationId) {
        const organizations = await api<{ id: string; name: string }[]>(
          token,
          "GET",
          "/organizations",
        );
        if (organizations.length === 1) {
          organizationId = organizations[0]!.id;
        } else if (organizations.length > 1) {
          console.error(
            "Your account belongs to several Sanity organizations — pick one with --org <id>:",
          );
          for (const org of organizations) console.error(`  ${org.id}  ${org.name}`);
          process.exit(1);
        }
      }
      const project = await api<{ id: string }>(token, "POST", "/projects", {
        displayName,
        ...(organizationId ? { organizationId } : {}),
      });
      projectId = project.id;
      console.log(`Created Sanity project ${projectId} (“${displayName}”).`);
    }
  }

  // 2. Dataset. Check first: re-PUTting an existing dataset needs management
  //    rights some tokens (e.g. project robots) lack, and it's a no-op anyway.
  const datasets = await api<{ name: string }[]>(token, "GET", `/projects/${projectId}/datasets`);
  if (datasets.some((entry) => entry.name === dataset)) {
    console.log(`Dataset “${dataset}” already exists.`);
  } else {
    await api(token, "PUT", `/projects/${projectId}/datasets/${dataset}`, { aclMode: "public" });
    console.log(`Dataset “${dataset}” created (public read for published content).`);
  }

  // 3. Tokens — keep any already configured, mint the missing ones.
  let writeToken = process.env.SANITY_API_WRITE_TOKEN ?? null;
  if (writeToken) {
    console.log("Keeping the SANITY_API_WRITE_TOKEN already in .env.local.");
  } else {
    const minted = await api<{ key: string }>(token, "POST", `/projects/${projectId}/tokens`, {
      label: `seed + studio writes (${new Date().toISOString().slice(0, 10)})`,
      roleName: "editor",
    });
    writeToken = minted.key;
    console.log("Minted an Editor token (server-side writes / seeding).");
  }

  let readToken = process.env.SANITY_API_READ_TOKEN ?? null;
  if (readToken) {
    console.log("Keeping the SANITY_API_READ_TOKEN already in .env.local.");
  } else {
    const minted = await api<{ key: string }>(token, "POST", `/projects/${projectId}/tokens`, {
      label: `draft previews (${new Date().toISOString().slice(0, 10)})`,
      roleName: "viewer",
    });
    readToken = minted.key;
    console.log("Minted a Viewer token (draft previews / Visual Editing).");
  }

  // 4. CORS origins for the embedded Studio and Visual Editing.
  const origins = ["http://localhost:3000", ...(siteUrl ? [siteUrl.replace(/\/$/, "")] : [])];
  for (const origin of origins) {
    try {
      await api(token, "POST", `/projects/${projectId}/cors`, {
        origin,
        allowCredentials: true,
      });
      console.log(`CORS origin added: ${origin}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (/exist/i.test(message)) {
        console.log(`CORS origin already present: ${origin}`);
      } else {
        // CORS only affects the browser Studio, not seeding — warn, don't abort.
        console.warn(`Could not add CORS origin ${origin} (${message}).`);
        console.warn("Add it manually at sanity.io/manage → API → CORS origins.");
      }
    }
  }

  // 5. Persist the environment. NEXT_PUBLIC_* are the only browser-visible
  //    values; both tokens stay server-side (and are git-ignored here).
  await writeEnvLocal({
    NEXT_PUBLIC_SANITY_PROJECT_ID: projectId,
    NEXT_PUBLIC_SANITY_DATASET: dataset,
    NEXT_PUBLIC_SANITY_API_VERSION: process.env.NEXT_PUBLIC_SANITY_API_VERSION ?? "2025-08-01",
    SANITY_API_READ_TOKEN: readToken,
    SANITY_API_WRITE_TOKEN: writeToken,
  });
  console.log("Wrote .env.local (project id, dataset, API version, read + write tokens).");

  // 6. Populate the dataset with the placeholder content.
  if (process.argv.includes("--skip-seed")) {
    console.log("Skipping seed (--skip-seed). Run `npm run sanity:seed` when ready.");
  } else {
    console.log("Seeding placeholder content…");
    const seed = spawnSync("npm", ["run", "sanity:seed"], {
      cwd: root,
      stdio: "inherit",
      env: {
        ...process.env,
        NEXT_PUBLIC_SANITY_PROJECT_ID: projectId,
        NEXT_PUBLIC_SANITY_DATASET: dataset,
        SANITY_API_WRITE_TOKEN: writeToken,
      },
    });
    if (seed.status !== 0) {
      console.error("Seeding failed — fix the error above and re-run `npm run sanity:seed`.");
      process.exit(seed.status ?? 1);
    }
  }

  console.log(
    [
      "",
      "Sanity is connected. Next:",
      "  • restart `npm run dev` — the Work section now reads from Sanity",
      "  • open http://localhost:3000/studio to edit content",
      "  • deploying? copy the four values from .env.local into your host’s env",
      "    (and add the production URL as a CORS origin: --site-url or sanity.io/manage)",
    ].join("\n"),
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
