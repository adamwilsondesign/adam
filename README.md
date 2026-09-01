# Adam Wilson — Portfolio

A production portfolio built as one continuous visual shell: a fixed-viewport
homepage, a filterable client-logo field (the **Work** state), and
deep-linkable case-study overlays — with **Sanity** as the production content
source.

**Stack:** Next.js (App Router) · React · TypeScript (strict) · next-sanity
(Live Content API, Draft Mode, Visual Editing, TypeGen) · Motion ·
@use-gesture · CSS Modules · Vitest · Playwright.

---

## Quick start (no Sanity account needed)

```bash
npm install
npm run dev
```

Open http://localhost:3000. Without Sanity credentials, development
automatically serves the generated **local fixture content** (40 fictional
clients, 8 case studies) through the same normalized content model the CMS
uses — every feature works, including case-study deep links.

> Production builds are stricter: they **fail with a configuration error**
> unless Sanity is configured or fixture content is explicitly opted in with
> `NEXT_PUBLIC_CONTENT_SOURCE=fixtures` (what `npm run build:test` does).

## Scripts

| Script                   | Purpose                                                                                              |
| ------------------------ | ---------------------------------------------------------------------------------------------------- |
| `npm run dev`            | Dev server (fixtures or Sanity, depending on env)                                                    |
| `npm run build`          | Production build (requires Sanity, or the explicit opt-in)                                           |
| `npm run build:test`     | Production build pinned to fixture content                                                           |
| `npm run start`          | Serve the production build                                                                           |
| `npm run lint`           | ESLint                                                                                               |
| `npm run format`         | Prettier (write) — `format:check` to verify                                                          |
| `npm run typecheck`      | `tsc --noEmit`                                                                                       |
| `npm test`               | Vitest unit tests (filtering, grid math, normalization)                                              |
| `npm run test:e2e`       | Playwright tests (routing, state restoration, night mode, mobile)                                    |
| `npm run placeholders`   | Regenerate fixture data, SVG logos, WebP imagery, icons                                              |
| `npm run sanity:studio`  | Standalone Studio dev server (Studio is also embedded at `/studio`)                                  |
| `npm run sanity:schema`  | Extract `schema.json` from the Studio schema                                                         |
| `npm run sanity:typegen` | Extract schema **and** regenerate `src/sanity/types.generated.ts`                                    |
| `npm run sanity:setup`   | Create the Sanity project + dataset + tokens, write `.env.local`, seed                               |
| `npm run sanity:seed`    | Import placeholder content into your Sanity dataset (`-- --dry-run` to validate without credentials) |

---

## Sanity setup

### One command (recommended)

```bash
npx sanity login     # once — or export SANITY_AUTH_TOKEN (sanity.io/manage → API → Tokens)
npm run sanity:setup
```

`sanity:setup` talks to the Sanity Management API and does everything below in
one pass: creates the project (or reuses `NEXT_PUBLIC_SANITY_PROJECT_ID` if
already configured), ensures the `production` dataset, mints an Editor and a
Viewer token, adds `http://localhost:3000` (plus `--site-url <url>`) as CORS
origins, writes all five values into `.env.local`, and runs the placeholder
seed. It is idempotent — re-running never duplicates projects, overwrites
existing tokens in `.env.local`, or clobbers non-placeholder content. Flags:
`--name`, `--dataset`, `--org <id>` (when your account has several
organizations), `--site-url <url>`, `--skip-seed`.

Then restart `npm run dev` — the Work section switches from fixtures to the
Content Lake automatically, and `/studio` mounts the Studio.

### Manual steps (equivalent)

1. **Create a project** at [sanity.io](https://www.sanity.io/) (or
   `npx sanity init` and note the project id — the schema in this repo is
   authoritative, no need to scaffold one).
2. **Configure the environment** — copy `.env.example` to `.env.local`:

   ```text
   NEXT_PUBLIC_SANITY_PROJECT_ID=your-project-id
   NEXT_PUBLIC_SANITY_DATASET=production
   NEXT_PUBLIC_SANITY_API_VERSION=2025-08-01
   SANITY_API_READ_TOKEN=…   # Viewer token — draft previews & live drafts
   SANITY_API_WRITE_TOKEN=…  # Editor token — used ONLY by sanity:seed
   ```

   Only `NEXT_PUBLIC_*` values reach the browser. The read token is
   server-side; the write token is used exclusively by the seed script.

3. **Add CORS + preview origins** in sanity.io → API for your dev and
   production URLs (e.g. `http://localhost:3000`, your domain), with
   credentials allowed, so the embedded Studio and Visual Editing work.
4. **Seed placeholder content** (optional but recommended for a first run):

   ```bash
   npm run sanity:seed
   ```

   The seed is explicitly invoked, idempotent, and **only writes documents
   with the `placeholder-` id prefix** (plus a `createIfNotExists` for site
   settings, which never overwrites existing settings). Remove all
   placeholders later with `npm run sanity:seed -- --remove`.

5. **Restart `npm run dev`** — the site switches from fixtures to the
   Content Lake automatically, and `/studio` mounts the Studio.

### Editing content

- **Studio:** `/studio` — Site settings (singleton) and Clients. Each client
  has identity (name, SVG logo, one-sentence description), engagements
  (years + tags; these drive the Work filter), and at most one case study
  (slug, titles, Portable Text body, hero, gallery with per-item square/16:9
  intent, SEO fields).
- **Logos** are Sanity _file_ assets restricted to SVG. Uploads should have a
  transparent background, clean vector paths, a sensible `viewBox`, and no
  unnecessary fixed colours — the site recolours them per theme and uses
  them as alpha masks for the case-study morph transitions.
- **Live content:** published edits reach visitors without a redeploy (Live
  Content API via `defineLive`; `<SanityLive />` is mounted in the site
  layout).
- **Draft previews / Visual Editing:** open a document in Studio →
  **Presentation** to preview drafts with click-to-edit overlays. Preview
  sessions are authorized through `/api/draft-mode/enable` (secret verified
  against the Content Lake); leave via the floating "Previewing drafts"
  control or `/api/draft-mode/disable`. Draft pages are never indexed.

### After schema or query changes

```bash
npm run sanity:typegen
```

regenerates `schema.json` and `src/sanity/types.generated.ts`. Run it after
any change to `src/sanity/schemaTypes/**` or `src/sanity/lib/queries.ts`, and
commit the results. The normalization layer
(`src/lib/content/normalize.ts`) compiles against these types, so drift shows
up as type errors.

### Replacing placeholder content

All portfolio content lives in Sanity — **no component edits are needed**:

1. Seed (optional), then add real clients in Studio, or edit the seeded
   placeholder documents in place.
2. When real content is complete, delete the remaining placeholders:
   `npm run sanity:seed -- --remove` (placeholder assets can be pruned from
   Studio → Media; they're all prefixed `placeholder--`).
3. Fixture files (`content/fixtures/`, `public/placeholders/`) only serve
   credential-less development and CI; they never leak into a configured
   production build.

### Content validation & placeholder guards

`src/lib/content/validate.ts` runs once per server process from the content
facade and reports duplicate slugs, inverted engagement ranges, missing
required copy, missing alt text, and placeholder leakage (example.com URLs,
placeholder contact addresses).

- **Placeholder mode** (fixtures): structural problems are errors; placeholder
  leakage is a warning — the documented demo build never fails for being a
  demo.
- **Production mode** (Sanity configured, or
  `NEXT_PUBLIC_CONTENT_VALIDATION=production`): leakage becomes an error and
  fails the build with an actionable report.

Independently of validation, `src/lib/content/placeholder-guard.ts` sanitizes
every external/contact URL at the facade: an example.com project CTA or a
placeholder email can never render in **any** build — the control is omitted
instead. The Contact control appears only once a real address exists (Sanity
site settings → Contact, or `NEXT_PUBLIC_CONTACT_URL` while on fixtures).

### Optical logo fields → Sanity mapping

Equal grid cells get optically balanced marks via
`src/features/work/optical.ts`, driven by per-client fields:

| Model field                | Sanity field                       | Purpose                                            |
| -------------------------- | ---------------------------------- | -------------------------------------------------- |
| `logoAspect`               | `client.logoAspect`                | Intrinsic width ÷ height; automatic sizing input.  |
| `logoTreatment.scale`      | `client.logoTreatment.scale`       | Exceptional multiplier on the automatic size.      |
| `logoTreatment.padding`    | `client.logoTreatment.padding`     | Extra breathing room inside the cell (0–0.2).      |
| `logoTreatment.alignment`  | `client.logoTreatment.alignment`   | `center` / `start` / `end` within the cell.        |
| `logoTreatment.lightUrl`   | `client.logoTreatment.logoLight`   | Light-theme asset override (mask handles theming). |
| `logoTreatment.darkUrl`    | `client.logoTreatment.logoDark`    | Dark-theme asset override.                         |
| `logoTreatment.compactUrl` | `client.logoTreatment.compactLogo` | Denser mark for very small (pinched) cells.        |

Aspect-ratio defaults are computed by the placeholder generator (from each
SVG's viewBox) and entered per client in Studio for real logos; every
treatment field is optional and most clients need none.

---

## Architecture

```text
content/fixtures/         generated fixture data (fixture adapter + seed input)
public/placeholders/      generated SVG logos + WebP imagery for fixtures
scripts/                  placeholder generator, Sanity seed
src/
  app/                    App Router routes
    (site)/               portfolio shell (chrome + Sanity Live/Visual Editing)
      page.tsx            homepage
      work/               Work state
        page.tsx          grid page (client state lives here)
        [slug]/page.tsx   canonical, crawlable case-study page
        @modal/(.)[slug]  intercepted overlay above the live grid
    studio/[[...tool]]    embedded Sanity Studio
    api/draft-mode/       preview enable/disable
  components/             shell chrome, icons, 404 view
  features/
    home | work | case-study
  lib/
    content/              model · normalize · fixtures · sanity-source · facade
    analytics.ts          provider-agnostic event layer
  sanity/                 env · schemas · queries · live · image · structure
```

**Content pipeline.** Server components call the facade
(`src/lib/content`), which resolves to the Sanity source (via `sanityFetch`)
or the fixture adapter. Both produce the same serializable model
(`src/lib/content/model.ts`); filtering and layout code never touch
CMS-specific shapes.

**Routes and state.** `/` and `/work` are server-rendered; the Work grid is
a client island holding filter/composition state. Opening a case study from
the grid navigates to `/work/[slug]` through an **intercepting route**: the
URL updates with a real history entry while the grid stays mounted, so Back
(or Escape/Close) restores the exact previous composition. Direct loads of
`/work/[slug]` render the full page — default Work state beneath the opened
case study — with Sanity-authored metadata, canonicals, OG/Twitter cards and
CreativeWork JSON-LD. Filters, year range, zoom and pan never appear in the
URL (only case slugs are shareable); leaving for the homepage and returning
restores the exploration through an in-memory session snapshot
(`src/features/work/work-state-store.ts`). The mobile info card participates
in history via a same-URL state entry so the device back gesture dismisses
it.

**Filter model.** An explicit **All** chip is the default: no individual tag
is selected. Selecting a tag exits All; further tags expand the set with
inclusive OR; deselecting the last tag (or pressing All) restores the full
collection. Actions that would empty the grid are rejected with a pulse and
an announcement, and pills that would do so are pre-marked subdued
(`aria-disabled`). The live `NN / 40` count sits beside the slider.

**Composition continuity.** The entrance is randomized once per visit.
Filtering never reshuffles survivors: they keep their relative order (gaps
collapse forward) and newcomers append in a deterministic per-session order
(`nextOrder` in `src/features/work/shuffle.ts`). The quiet shuffle control in
the dock is the one way to re-randomize.

**Night, permanently.** The deep green-black night environment is the art
direction, not a theme: there is no toggle, no stored preference and no
theme initialization. One palette in `globals.css` serves every surface.

## Analytics

`src/lib/analytics.ts` defines typed events (opening/leaving Work, tag and
year changes, informational opens, case-study opens, media views, external
links) and logs them in development. Connect any provider
without touching interface code:

```ts
import { setAnalyticsProvider } from "@/lib/analytics";
setAnalyticsProvider((event) => myProvider.track(event.name, event));
```

## Testing

```bash
npm test            # unit tests: All/OR/date-overlap filter logic, zero-result
                    # prevention, spatial-continuity ordering, optical logo
                    # normalization, grid math, content validation + guards
npm run test:e2e    # Playwright: direct URLs + refresh, 404s, Back/Forward
                    # state restoration, focus trap + Escape + focus return,
                    # zero-result rejection, survivor stability, rapid filter
                    # interruption, roving tabindex + skip link, tooltip
                    # hover/focus/sticky, slider keyboard, reduced motion,
                    # night mode, mobile flows
```

Playwright builds and serves the fixture bundle itself. In sandboxes with a
preinstalled browser, point it at the binary instead of downloading:
`PLAYWRIGHT_CHROMIUM_EXECUTABLE=/opt/pw-browsers/chromium npm run test:e2e`.

## Deployment (Vercel)

The repo currently ships a `vercel.json` that sets
`NEXT_PUBLIC_CONTENT_SOURCE=fixtures` at build time — the **explicit**
opt-in that lets the site deploy on placeholder content before a Sanity
project exists. It is inert once Sanity is configured (Sanity always takes
precedence), but delete the file when you go live to restore the strict
"no CMS, no build" guarantee.

**Placeholder deploy (current default):** push and import into Vercel —
no configuration needed. Canonical URLs fall back to the Vercel production
domain; set `NEXT_PUBLIC_SITE_URL=https://your-domain` once you attach a
custom domain.

**Connecting Sanity:**

1. Set the environment variables from `.env.example` in Vercel:
   `NEXT_PUBLIC_SANITY_PROJECT_ID`, `NEXT_PUBLIC_SANITY_DATASET`,
   `NEXT_PUBLIC_SANITY_API_VERSION`, `SANITY_API_READ_TOKEN`, and
   `NEXT_PUBLIC_SITE_URL=https://your-domain` (canonical URLs, sitemap,
   structured data).
2. Seed or author content first (`npm run sanity:seed` locally) so the Work
   grid isn't empty.
3. Add the production URL to the Sanity project's CORS origins. This is
   **load-bearing for the public site**, not just Studio: client logos are
   rendered as CSS masks fetched from `cdn.sanity.io`, and mask-image
   requests are CORS-checked — from an origin that isn't allowlisted the
   CDN answers 403 and every logo renders invisible.
4. Redeploy (env vars are inlined at build time) and remove `vercel.json`'s
   fixture opt-in. Published Sanity edits then update the live site without
   redeploys; `/studio` is served from the same deployment (and excluded
   from robots + the sitemap).

Any Node host works the same way (`npm run build` + `npm run start`).

## Known limitations

- **Future sections** (About, Blog, Experiments) are routed nowhere yet by
  design — menu and homepage show them as held-back states. Adding them is
  additive: new segments under `(site)/`, new schema types, new queries.
- **`sanityFetch` result typing** is bridged with per-query casts in
  `src/lib/content/sanity-source.ts` because next-sanity currently nests its
  own `@sanity/client`, which TypeGen's generated overloads can't reach.
  Re-run `sanity:typegen` after query changes and the casts stay honest.
- **Placeholder visuals** are deliberately abstract; Lighthouse performance
  with real photography will depend on the uploaded assets (the gallery
  already lazy-loads and serves responsive sizes via the Sanity CDN).
- The e2e suite runs Chromium (desktop + iPhone-sized mobile emulation);
  Safari and Firefox have not been exercised in this environment. WebKit and
  Firefox projects can be added to `playwright.config.ts` wherever those
  binaries are available — the interactions use standard pointer/touch
  events and CSS masks with `-webkit-` fallbacks, but verify the mobile
  pinch/pan behaviour on a real iPhone before launch.
