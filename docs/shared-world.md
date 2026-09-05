# Shared world renderer

The site layout owns one persistent WebGL renderer. The DOM content, Sanity data facade, case studies, filters and navigation remain separate and unchanged. `WorldEnvironment` lazily loads the renderer; changing route does not recreate it.

`StarField` is now a flight controller. It writes project stars into a fixed GPU buffer and updates work travel on the shared frame clock. About publishes scroll/exit intent and reveals its content using the actual descent progress. Retargeted camera segments retain their incoming velocity; the About rig uses an analytic damped spring.

The scene uses composed terrain geometry, a mineral-textured sphere and monoliths, and bounded textured cloud banks with one slow shared wind. Cloud detail is prepared ahead of time, not raymarched across the viewport. Geometry is never regenerated on resize or route changes. The doorway is geometry, with a 256 × 512 live render of the same world through its opening. Its accessible button and fallback illustration stay in the content layer.

## Assets

`public/world/cloud-sculpted.webp` is an original generated transparent cloud bank. The PNG master is retained alongside it. It was generated for this project from a text description (silver/graphite moonlit valley cloud, no landscape, UI, or reference-image pixels). It is used as a texture on moving world-space geometry, not as a page background.

`mineral.png` is an original seamless periodic texture. `node scripts/generate-world-assets.mjs` regenerates it and the procedural prototype cloud atlas. The sculpted cloud asset is not overwritten by that script.

## Budgets and diagnostics

Append `?worldDebug=1` on first load to show rolling p95 frame interval, draw calls, triangle count and render scale. This is a frame-pacing diagnostic, not a GPU timer or proof of performance across devices. It stays active through soft navigation until refresh. Metrics are not sent anywhere.

The background pixel ratio is capped at 1.5 desktop / 1.25 phone widths. Sustained slow frames lower resolution to a floor of 65%; recovery requires a much longer fast window. Content resolution is unaffected. Hidden pages pause rendering. Reduced-motion mode uses a fixed scene and redraws only when its state changes. A missing/lost WebGL context shows a static fallback while keeping the transition completion clock alive.

## Verification

Run `npm run typecheck`, `npm run lint`, `npm test`, and a production build. `npm run build:test` explicitly uses local fixtures for hermetic checks; do not apply that environment override to the deployed CMS-connected build.

Review Home → Work → Home, Home → About → scroll → Home, clear/restore filters, doorway interaction, direct route loads, and phone layouts. Test with actual low-power devices before asserting a universal frame-rate guarantee. The original e2e suite disables scenery, so it is not a rendering-performance test.
